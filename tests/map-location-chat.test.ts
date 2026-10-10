import { test } from "node:test";
import assert from "node:assert/strict";
import { createLocationSearchHandler } from "../supabase/functions/_shared/location-search.ts";
import { categoryVibes } from "../supabase/functions/_shared/location-categories.ts";
import { parseAssistantResponse } from "../supabase/functions/_shared/assistant-response.ts";
import { cleanChatText } from "../src/features/live-assistant/services/chatText.ts";
import { parseLocation, parseLocationParam, savedLocationColumns } from "../src/features/trips/location/model.ts";
import { vibeTags } from "../supabase/functions/_shared/trip-places.ts";

const tripId = "11111111-1111-4111-8111-111111111111";
const config: Record<string, string> = {
  SUPABASE_URL: "https://fixture.invalid", SUPABASE_ANON_KEY: "public-fixture",
  GEOAPIFY_API_KEY: "geoapify-fixture",
};
const request = (token = "fixture", query = "Hualin Temple") => new Request("https://fixture.invalid/location-search", {
  method: "POST", headers: { "content-type": "application/json", ...(token ? { authorization: "Bearer " + token } : {}) },
  body: JSON.stringify({ tripId, query }),
});
function network(access = true) {
  const calls: string[] = [];
  const fetcher: typeof fetch = async (input) => {
    const url = String(input); calls.push(url);
    if (url.endsWith("/auth/v1/user")) return Response.json({ id: "user-1" });
    if (url.includes("/rest/v1/trips")) return Response.json(access ? [{ id: tripId, destination: "Guangzhou, China" }] : []);
    if (url.includes("api.geoapify.com")) return Response.json({ results: [
      { place_id: "temple-1", name: "Hualin Temple", formatted: "Guangzhou, China", lat: 23.1, lon: 113.2, category: "religion.place_of_worship.buddhism" },
      { place_id: "bad", name: "Invalid", lat: 100, lon: 200 },
    ] });
    throw new Error("Unexpected network call");
  };
  return { fetcher, calls };
}
test("location search authenticates before contacting a provider", async () => {
  const n = network();
  const handler = createLocationSearchHandler({ env: (key) => config[key], fetcher: n.fetcher });
  assert.equal((await handler(request(""))).status, 401);
  assert.equal(n.calls.length, 0);
});
test("location search denies an inaccessible trip before Geoapify", async () => {
  const n = network(false);
  const handler = createLocationSearchHandler({ env: (key) => config[key], fetcher: n.fetcher });
  assert.equal((await handler(request())).status, 404);
  assert.equal(n.calls.length, 2);
});
test("location search returns valid identities, addresses, coordinates and categories", async () => {
  const n = network();
  const handler = createLocationSearchHandler({ env: (key) => config[key], fetcher: n.fetcher });
  const response = await handler(request());
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.places.length, 1);
  assert.equal(data.places[0].providerId, "temple-1");
  assert.equal(data.places[0].address, "Guangzhou, China");
  assert.equal(data.places[0].latitude, 23.1);
  assert.deepEqual(data.places[0].categories, ["religion.place_of_worship.buddhism"]);
  assert.ok(!JSON.stringify(data).includes("geoapify-fixture"));
  const providerRequest = new URL(n.calls[2]);
  assert.match(providerRequest.searchParams.get("text")!, /Guangzhou/);
});
test("missing Geoapify config explains setup and allows saving without a pin", async () => {
  const n = network();
  const handler = createLocationSearchHandler({ env: (key) => key === "GEOAPIFY_API_KEY" ? undefined : config[key], fetcher: n.fetcher });
  const response = await handler(request());
  assert.equal(response.status, 503);
  assert.match((await response.json()).error.message, /GEOAPIFY_API_KEY/);
  assert.equal(n.calls.length, 3);
});
test("new locations round-trip through Explore handoff and save their coordinates", () => {
  const value = { provider: "wikipedia", providerId: "wiki:en:123", name: "Temple",
    address: "Guangzhou", latitude: 23.1, longitude: 113.2, categories: [] };
  const selected = parseLocationParam(JSON.stringify(value));
  assert.deepEqual(selected, value);
  assert.deepEqual(savedLocationColumns(selected), { latitude: 23.1, longitude: 113.2,
    location_provider: "wikipedia", location_provider_id: "wiki:en:123", location_address: "Guangzhou", location_categories: [] });
  assert.equal(parseLocationParam("{broken"), null);
  assert.equal(parseLocation({ ...value, latitude: 91 }), null);
  assert.equal(parseLocation({ ...value, longitude: "113.2" }), null);
  assert.equal(savedLocationColumns(null).latitude, null);
  assert.equal(savedLocationColumns(null).location_provider_id, null);
});
test("provider categories enrich vibes without replacing explicit tags", () => {
  assert.deepEqual(categoryVibes(["religion.place_of_worship"]), ["Heritage", "Tranquility"]);
  assert.deepEqual(categoryVibes(["commercial.department_store"]), ["Shopping"]);
  assert.deepEqual(vibeTags({ activity_category: "sightseeing", description: null,
    location_categories: ["religion.place_of_worship"], vibe_tags: ["Arts"] }), ["Heritage", "Tranquility", "Arts"]);
});
test("structured Gemini replies contain clean text and response-specific follow-ups", () => {
  const reply = parseAssistantResponse(JSON.stringify({
    answer: "**Hualin Temple** is known for its Buddhist heritage.\n* Look for the main hall.",
    followUps: ["What features should I look for in the main hall?", "What is its Buddhist history?", "How should I behave inside?"],
  }));
  assert.equal(reply.answer, "Hualin Temple is known for its Buddhist heritage.\n\u2022 Look for the main hall.");
  assert.equal(reply.followUps.length, 3);
  assert.match(reply.followUps[0], /main hall/);
});
test("follow-ups are bounded and malformed structured answers are not shown as JSON", () => {
  const reply = parseAssistantResponse(JSON.stringify({ answer: "A temple.", followUps: ["One?", "One?", 42, "x".repeat(161), "Two?", "Three?", "Four?"] }));
  assert.deepEqual(reply.followUps, ["One?", "Two?", "Three?"]);
  assert.equal(parseAssistantResponse('{"answer":"truncated').answer, "");
  assert.equal(parseAssistantResponse("Legacy plain text").answer, "Legacy plain text");
  assert.equal(cleanChatText("## History\n**Ancient** temple.\n* Visit respectfully."), "History\nAncient temple.\n\u2022 Visit respectfully.");
});

test("missing Geoapify key returns selectable Wikipedia locations and rejects invalid pins", async () => {
  const n = network();
  const handler = createLocationSearchHandler({
    env: (key) => key === "GEOAPIFY_API_KEY" ? undefined : config[key],
    fetcher: async (input, init) => {
      if (String(input).includes("wikipedia.org")) return Response.json({ query: { pages: [
        { pageid: 12, title: "Tempozan Harbor Village", coordinates: [{ lat: 34.65, lon: 135.43 }] },
        { pageid: 13, title: "Ambiguous", pageprops: { disambiguation: "" }, coordinates: [{ lat: 34, lon: 135 }] },
        { pageid: 14, title: "No location" },
      ] } });
      return n.fetcher(input, init);
    },
  });
  const response = await handler(request("fixture", "Tempozan Harbor Village"));
  assert.equal(response.status, 200);
  const { places } = await response.json();
  assert.equal(places.length, 1);
  assert.equal(places[0].providerId, "wiki:en:12");
  assert.equal(parseLocation(places[0])?.latitude, 34.65);
});

test("location queries do not duplicate a city already present in the input", async () => {
  const n = network();
  const handler = createLocationSearchHandler({ env: (key) => config[key], fetcher: n.fetcher });
  await handler(request("fixture", "Hualin Temple, Guangzhou"));
  assert.equal(new URL(n.calls[2]).searchParams.get("text"), "Hualin Temple, Guangzhou");
});

test("empty autocomplete falls back to full-address geocoding before Wikipedia", async () => {
  const n = network();
  const calls: string[] = [];
  const handler = createLocationSearchHandler({ env: (key) => config[key], fetcher: async (input, init) => {
    const url = String(input); calls.push(url);
    if (url.includes("geocode/autocomplete")) return Response.json({ results: [] });
    if (url.includes("geocode/search")) return Response.json({ results: [
      { place_id: "address-match", name: "Harbor Village", formatted: "Osaka, Japan", lat: 34.65, lon: 135.43 },
    ] });
    return n.fetcher(input, init);
  } });
  const response = await handler(request("fixture", "Harbor Village"));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).places[0].providerId, "address-match");
  assert.equal(calls.filter((url) => url.includes("geocode/")).length, 2);
  assert.ok(!calls.some((url) => url.includes("wikipedia.org")));
});
