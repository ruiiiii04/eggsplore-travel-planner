import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

type MockResponse = { status: number; body: unknown };

function loadHandler(options: {
  auth?: MockResponse;
  quota?: MockResponse | "network_error";
  groq?: MockResponse;
}) {
  const envValues: Record<string, string> = {
    SUPABASE_URL: "https://project.example",
    SUPABASE_ANON_KEY: "anon-test-key",
    GROQ_API_KEY: "groq-test-key",
    GROQ_MODEL: "test-model",
  };
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  let handler: ((request: Request) => Promise<Response> | Response) | undefined;
  const reply = (mock: MockResponse) => new Response(JSON.stringify(mock.body), { status: mock.status });
  const mockFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    requests.push({ url, init });
    if (url.endsWith("/auth/v1/user")) return reply(options.auth ?? { status: 200, body: { id: "user-1" } });
    if (url.endsWith("/rest/v1/rpc/consume_cost_estimate_request")) {
      if (options.quota === "network_error") throw new Error("network unavailable");
      return reply(options.quota ?? { status: 200, body: true });
    }
    if (url.includes("api.groq.com")) return reply(options.groq ?? {
      status: 200,
      body: { choices: [{ message: { content: JSON.stringify({
        food: { low: 10, high: 20 }, transport: { low: 10, high: 20 },
        stay: { low: 10, high: 20 }, activities: { low: 10, high: 20 },
        shopping: { low: 10, high: 20 }, other: { low: 10, high: 20 },
      }) } }] },
    });
    throw new Error(`Unexpected request: ${url}`);
  };
  const source = readFileSync(
    new URL("../supabase/functions/estimate-costs/index.ts", import.meta.url),
    "utf8",
  );
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  runInNewContext(compiled, {
    exports: {},
    Deno: {
      serve(value: typeof handler) { handler = value; },
      env: { get: (name: string) => envValues[name] },
    },
    fetch: mockFetch,
    Request,
    Response,
    AbortController,
    setTimeout,
    clearTimeout,
    console: { error() {} },
  });
  assert(handler);
  return { handler, requests };
}

const request = () => new Request("https://function.example/estimate-costs", {
  method: "POST",
  headers: { authorization: "Bearer user-token", "content-type": "application/json" },
  body: JSON.stringify({ destination: "Osaka" }),
});

test("valid cost estimate consumes its own quota before calling Groq", async () => {
  const { handler, requests } = loadHandler({});
  const response = await handler!(request());
  assert.equal(response.status, 200);
  assert.deepEqual(requests.map((item) => item.url.includes("/auth/v1/user")
    ? "auth/v1/user"
    : item.url.split("/").slice(-2).join("/")), [
    "auth/v1/user",
    "rpc/consume_cost_estimate_request",
    "chat/completions",
  ]);
  assert.equal(requests[1].init?.headers && (requests[1].init.headers as Record<string, string>).Authorization, "Bearer user-token");
});

test("quota denial returns 429 and never calls the paid model", async () => {
  const { handler, requests } = loadHandler({ quota: { status: 200, body: false } });
  const response = await handler!(request());
  assert.equal(response.status, 429);
  assert.equal(requests.some((item) => item.url.includes("api.groq.com")), false);
});

test("quota service failure fails closed before calling the paid model", async () => {
  const { handler, requests } = loadHandler({ quota: { status: 503, body: { message: "down" } } });
  const response = await handler!(request());
  assert.equal(response.status, 503);
  assert.equal(requests.some((item) => item.url.includes("api.groq.com")), false);
});

test("quota transport errors fail closed before calling the paid model", async () => {
  const { handler, requests } = loadHandler({ quota: "network_error" });
  const response = await handler!(request());
  assert.equal(response.status, 503);
  assert.equal(requests.some((item) => item.url.includes("api.groq.com")), false);
});

test("unexpected quota response fails closed before calling the paid model", async () => {
  const { handler, requests } = loadHandler({ quota: { status: 200, body: null } });
  const response = await handler!(request());
  assert.equal(response.status, 503);
  assert.equal(requests.some((item) => item.url.includes("api.groq.com")), false);
});

test("invalid destinations do not consume quota", async () => {
  const { handler, requests } = loadHandler({});
  const invalid = new Request("https://function.example/estimate-costs", {
    method: "POST",
    headers: { authorization: "Bearer user-token", "content-type": "application/json" },
    body: JSON.stringify({ destination: " " }),
  });
  const response = await handler!(invalid);
  assert.equal(response.status, 400);
  assert.equal(requests.some((item) => item.url.includes("consume_cost_estimate_request")), false);
});
