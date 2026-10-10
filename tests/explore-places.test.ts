import assert from "node:assert/strict";
import test from "node:test";
import {
  createExploreHandler,
  alreadyPlanned,
  exploreTags,
  exploreArticle,
} from "../supabase/functions/_shared/explore-places.ts";
import { parsePlace } from "../supabase/functions/_shared/validation.ts";
import {
  createDetailsHandler,
  createAssistantHandler,
} from "../supabase/functions/_shared/handlers.ts";
import type { Item } from "../supabase/functions/_shared/trip-places.ts";
const id = "11111111-1111-4111-8111-111111111111";
const env = (key: string) =>
  ({
    SUPABASE_URL: "https://db.test",
    SUPABASE_ANON_KEY: "public",
    GEMINI_API_KEY: "secret",
  })[key];
const json = (body: unknown) =>
  new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
  });
const request = (body: unknown = { tripId: id }, signed = true) =>
  new Request("https://fn.test", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(signed ? { Authorization: "Bearer token" } : {}),
    },
    body: JSON.stringify(body),
  });
function page(n: number, title = `Museum ${n}`) {
  return {
    pageid: n,
    title,
    coordinates: [{ lat: 34.69 + n / 10000, lon: 135.5 }],
    terms: { description: ["museum in Osaka, Japan"] },
  };
}
function setup(
  access = true,
  destination = "Osaka, Japan",
  items: Partial<Item>[] = [],
) {
  const calls: URL[] = [];
  const fetcher: typeof fetch = async (url, init) => {
    const u = new URL(String(url));
    calls.push(u);
    if (u.hostname === "db.test") {
      assert.equal(
        new Headers(init?.headers).get("Authorization"),
        "Bearer token",
      );
      if (u.pathname === "/auth/v1/user")
        return json({ id: "user", is_anonymous: false });
      if (u.pathname.endsWith("/trips"))
        return json(access ? [{ id, destination }] : []);
      if (u.pathname.endsWith("/itinerary_items")) return json(items);
      if (u.pathname.endsWith("/consume_assistant_request")) return json(true);
    }
    if (u.hostname === "generativelanguage.googleapis.com")
      return json({
        candidates: [
          { finishReason: "STOP", content: { parts: [{ text: "A museum." }] } },
        ],
      });
    if (u.searchParams.get("generator") === "geosearch")
      return json({
        query: {
          pages: [
            ...Array.from({ length: 30 }, (_, i) => page(i + 1)),
            page(1),
          ],
        },
      });
    if (u.searchParams.get("titles") === "Osaka, Japan|Osaka")
      return json({
        query: {
          pages: [
            {
              ...page(100, "Osaka"),
              terms: { description: ["city in Japan"] },
            },
          ],
        },
      });
    if (u.searchParams.get("titles") === "Japan")
      return json({
        query: {
          pages: [
            {
              ...page(100, "Japan"),
              terms: { description: ["island country in East Asia"] },
            },
          ],
        },
      });
    if (u.searchParams.get("prop") === "info")
      return json({ query: { pages: [{ pageid: 1, title: "Museum 1" }] } });
    if (u.searchParams.has("pageids"))
      return json({ query: { pages: [page(2)] } });
    if (u.searchParams.get("prop")?.includes("extracts"))
      return json({
        query: {
          pages: [
            {
              ...page(2),
              extract: "Museum description.",
              fullurl: "https://en.wikipedia.org/wiki/Museum_2",
            },
          ],
        },
      });
    throw new Error(`Unexpected URL ${u}`);
  };
  return { calls, fetcher, handler: createExploreHandler({ env, fetcher }) };
}
test("Explore rejects unsigned requests before network access", async () => {
  const s = setup();
  assert.equal((await s.handler(request({}, false))).status, 401);
  assert.equal(s.calls.length, 0);
});
test("Explore denies inaccessible trip before public lookup", async () => {
  const s = setup(false);
  assert.equal((await s.handler(request())).status, 404);
  assert.equal(s.calls.length, 2);
});
test("Explore selects at most 20 unique places and excludes itinerary redirects", async () => {
  const s = setup(true, "Osaka, Japan", [
    { title: "Alternate museum name", location_name: "Alias" },
  ]);
  const res = await s.handler(request());
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.places.length, 20);
  assert.equal(new Set(data.places.map((p: { id: string }) => p.id)).size, 20);
  assert.ok(!data.places.some((p: { id: string }) => p.id === "wiki:en:1"));
  assert.ok(data.places.every((p: { tripId?: string }) => !p.tripId));
});
test("Explore rejects a country destination instead of guessing a city", async () => {
  const s = setup(true, "Japan");
  assert.equal((await s.handler(request())).status, 422);
  assert.ok(!s.calls.some((u) => u.searchParams.has("generator")));
});
test("exclusion matches names, aliases, activity title text and saved coordinates", () => {
  const p = { ...page(2, "Osaka Castle"), terms: { alias: ["Osakajo"] } };
  for (const item of [
    { title: "Visit Osaka Castle" },
    { location_name: "Osakajo" },
    { latitude: p.coordinates[0].lat, longitude: p.coordinates[0].lon },
  ])
    assert.equal(
      alreadyPlanned(
        p,
        [
          {
            id,
            trip_id: id,
            title: "",
            location_name: null,
            description: null,
            activity_category: null,
            latitude: null,
            longitude: null,
            position: 0,
            ...item,
          },
        ],
        new Set(),
      ),
      true,
    );
  assert.equal(
    alreadyPlanned(p, [{ title: "Other site" } as Item], new Set()),
    false,
  );
});
test("visitor categories exclude stations and demolished attractions", () => {
  assert.deepEqual(
    exploreTags({
      title: "Central station",
      terms: { description: ["railway station near a castle"] },
    }),
    [],
  );
  assert.deepEqual(
    exploreTags({
      title: "Old Tower",
      terms: { description: ["demolished observation tower"] },
    }),
    [],
  );
  assert.deepEqual(exploreTags({ title: "Theme park" }), ["Entertainment"]);
  assert.deepEqual(exploreTags({ title: "Castle garden" }), [
    "Heritage",
    "Nature",
  ]);
});
test("Explore IDs cannot inject arbitrary URLs or wiki parameters", () => {
  assert.equal(parsePlace({ placeId: "wiki:en:123" }), "wiki:en:123");
  for (const value of [
    "wiki:en:0",
    "wiki:en:1|2",
    "wiki:fr:1",
    "https://example.com",
    "wiki:en:1&x=2",
  ])
    assert.throws(() => parsePlace({ placeId: value }));
});
test("Explore article resolution validates coordinates", async () => {
  await assert.rejects(() =>
    exploreArticle("wiki:en:2", async () =>
      json({ query: { pages: [{ pageid: 2, title: "Not a place" }] } }),
    ),
  );
});
test("Explore details and Ask AI accept public place identities after authentication", async () => {
  const s = setup();
  const details = await createDetailsHandler({ env, fetcher: s.fetcher })(
    request({ placeId: "wiki:en:2" }),
  );
  assert.equal(details.status, 200);
  assert.equal((await details.json()).name, "Museum 2");
  const chat = await createAssistantHandler({ env, fetcher: s.fetcher })(
    request({ placeId: "wiki:en:2", question: "What is this?", history: [] }),
  );
  assert.equal(chat.status, 200);
  assert.equal((await chat.json()).answer, "A museum.");
  assert.ok(!s.calls.some((u) => u.pathname.endsWith("/itinerary_items")));
});
