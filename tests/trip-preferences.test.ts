import { test } from "node:test";
import assert from "node:assert/strict";
import {
  tripPreferenceGuidance,
  tripPreferencePayload,
} from "../src/features/trips/creation/preferences";

test("trip templates expand into concrete generation guidance", () => {
  assert.deepEqual(tripPreferenceGuidance("Foodie Adventure", []), [
    "Foodie Adventure: local cuisine, street food, markets, and notable food neighborhoods",
  ]);
});

test("custom templates are deduplicated and capped at six", () => {
  assert.deepEqual(
    tripPreferenceGuidance("Custom", ["Nature Retreat", "Nature Retreat", "Beach Trip"]),
    [
      "Nature Retreat: nature, scenic walks, hiking, and wellness with a calm pace",
      "Beach Trip: beaches, swimming, coastal scenery, and a relaxed pace",
    ],
  );
});

test("skipping preferences stores no trip-specific guidance", () => {
  assert.deepEqual(tripPreferenceGuidance("", []), []);
});

test("the same selected preferences are sent to itinerary AI and persisted on the trip", () => {
  const payload = tripPreferencePayload("Custom", [
    "Foodie Adventure",
    "Nature Retreat",
  ]);
  assert.deepEqual(payload.generationPreferences, [
    "Foodie Adventure: local cuisine, street food, markets, and notable food neighborhoods",
    "Nature Retreat: nature, scenic walks, hiking, and wellness with a calm pace",
  ]);
  assert.deepEqual(payload.travelPreferences, payload.generationPreferences);
});

test("generate-itinerary includes trip preferences in the Gemini prompt", async () => {
  let handler: ((request: Request) => Promise<Response>) | undefined;
  const runtime = globalThis as unknown as { Deno?: unknown };
  const oldDeno = runtime.Deno;
  const oldFetch = globalThis.fetch;
  let prompt = "";

  runtime.Deno = {
    serve: (fn: typeof handler) => {
      handler = fn;
    },
    env: {
      get: (name: string) =>
        ({
          GEMINI_API_KEY: "gemini-test",
          GEMINI_MODEL: "test-model",
        })[name as "GEMINI_API_KEY" | "GEMINI_MODEL"],
    },
  };
  globalThis.fetch = async (_url, init) => {
    prompt = JSON.parse(String(init?.body)).contents[0].parts[0].text;
    return Response.json({
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  days: [
                    {
                      date: "2026-10-14",
                      activities: [
                        {
                          time: "09:00",
                          title: "Local food market",
                          description: "Explore local dishes and market stalls.",
                          location: "City centre",
                        },
                        {
                          time: "13:00",
                          title: "Food street",
                          description: "Try popular neighborhood restaurants.",
                          location: "Old town",
                        },
                      ],
                    },
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
    await import("../supabase/functions/generate-itinerary/index");
    assert(handler);
    const response = await handler!(
      new Request("https://functions.test/generate-itinerary", {
        method: "POST",
        headers: { authorization: "Bearer test-user-token" },
        body: JSON.stringify({
          destination: "Kuala Lumpur",
          startDate: "2026-10-14",
          endDate: "2026-10-14",
          tripType: "group",
          budget: "RM 2,000 - RM 5,000",
          preferences: [
            "Foodie Adventure: local cuisine and street food",
            "Nature Retreat: scenic walks and a calm pace",
          ],
        }),
      }),
    );

    assert.equal(response.status, 200);
    assert(prompt.includes("Destination: Kuala Lumpur"));
    assert(prompt.includes("Foodie Adventure: local cuisine and street food"));
    assert(prompt.includes("Nature Retreat: scenic walks and a calm pace"));
    assert(prompt.includes("Trip type: group."));
    assert.deepEqual(
      (await response.json()).itinerary.days[0].date,
      "2026-10-14",
    );
  } finally {
    globalThis.fetch = oldFetch;
    if (oldDeno === undefined) delete runtime.Deno;
    else runtime.Deno = oldDeno;
  }
});
