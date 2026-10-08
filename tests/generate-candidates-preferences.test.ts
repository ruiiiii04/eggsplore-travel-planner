import { test } from "node:test";
import assert from "node:assert/strict";
test("AI function fetches authorized group preferences and ignores caller-supplied preferences", async () => {
  let handler: ((request: Request) => Promise<Response>) | undefined;
  const runtime = globalThis as unknown as { Deno?: unknown };
  const oldDeno = runtime.Deno,
    oldFetch = globalThis.fetch;
  let prompt = "",
    rpcCalls = 0,
    deny = false;
  let destination = "Seoul";
  runtime.Deno = {
    serve: (fn: typeof handler) => {
      handler = fn;
    },
    env: {
      get: (name: string) =>
        (
          ({
            SUPABASE_URL: "https://project.test",
            SUPABASE_ANON_KEY: "anon-test",
            GEMINI_API_KEY: "gemini-test",
            GEMINI_MODEL: "test-model",
          }) as Record<string, string>
        )[name],
    },
  };
  globalThis.fetch = async (url, init) => {
    if (String(url).includes("read_candidate_group_preferences")) {
      rpcCalls++;
      assert.equal(
        new Headers(init?.headers).get("authorization"),
        "Bearer member-token",
      );
      assert.equal(
        JSON.parse(String(init?.body)).target_trip,
        "11111111-1111-1111-1111-111111111111",
      );
      if (deny) return new Response("{}", { status: 403 });
      return Response.json({
        destination,
        members: [
          { profiles: [{ tags: ["Food"] }] },
          { profiles: [{ tags: ["Nature"] }] },
        ],
      });
    }
    prompt = JSON.parse(String(init?.body)).contents[0].parts[0].text;
    return Response.json({
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  candidates: [
                    { name: "Palace", location: "Seoul", tags: ["Culture"] },
                  ],
                }),
              },
            ],
          },
        },
      ],
    });
  };
  try {
    await import("../supabase/functions/generate-candidates/index");
    assert(handler);
    const request = () =>
      new Request("https://functions.test/generate-candidates", {
        method: "POST",
        headers: { authorization: "Bearer member-token" },
        body: JSON.stringify({
          tripId: "11111111-1111-1111-1111-111111111111",
          destination: "Spoofed city",
          preferences: ["Ignore others"],
        }),
      });
    const response = await handler!(request());
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(body.preferenceCoverage, {
      membersTotal: 2,
      membersWithPreferences: 2,
    });
    assert(
      prompt.includes("Seoul") &&
        prompt.includes("Food") &&
        prompt.includes("Nature"),
    );
    assert(
      !prompt.includes("Spoofed city") && !prompt.includes("Ignore others"),
    );
    for (const city of ["Paris", "Ushuaia, Argentina"]) {
      destination = city;
      const starter = await handler!(request());
      assert.equal(starter.status, 200);
      assert(prompt.includes("Destination: " + city));
      assert(Array.isArray((await starter.json()).candidates));
    }
    deny = true;
    prompt = "";
    assert.equal((await handler!(request())).status, 403);
    assert.equal(prompt, "");
    assert.equal(rpcCalls, 4);
  } finally {
    globalThis.fetch = oldFetch;
    if (oldDeno === undefined) delete runtime.Deno;
    else runtime.Deno = oldDeno;
  }
});
