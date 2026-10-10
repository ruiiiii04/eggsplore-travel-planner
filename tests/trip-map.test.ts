import assert from "node:assert/strict";
import test from "node:test";
import {
  category,
  coordinates,
  distance,
  resolveArticle,
  type Item,
} from "../supabase/functions/_shared/trip-places.ts";
import { createTripMapHandler } from "../supabase/functions/_shared/trip-map-handler.ts";
import {
  createAssistantHandler,
  createDetailsHandler,
} from "../supabase/functions/_shared/handlers.ts";
const tripId = "11111111-1111-4111-8111-111111111111";
const placeId = "22222222-2222-4222-8222-222222222222";
const env = (name: string) =>
  ({
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_ANON_KEY: "public",
    GEMINI_API_KEY: "secret",
  })[name];
const response = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
const request = (body: unknown, signed = true) =>
  new Request("https://example.com", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(signed ? { Authorization: "Bearer user-token" } : {}),
    },
    body: JSON.stringify(body),
  });
function item(changes: Partial<Item> = {}): Item {
  return {
    id: placeId,
    trip_id: tripId,
    title: "Visit landmark",
    location_name: "Map Test Tower",
    description: "Saved plan",
    activity_category: "sightseeing",
    latitude: 35,
    longitude: 135,
    position: 0,
    ...changes,
  };
}
function fixture(rows: Item[], allow = true) {
  const urls: string[] = [];
  const fetcher: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    urls.push(url.href);
    if (url.hostname === "example.supabase.co") {
      assert.equal(
        new Headers(init?.headers).get("authorization"),
        "Bearer user-token",
      );
      if (url.pathname === "/auth/v1/user")
        return response({ id: "user", is_anonymous: false });
      if (url.pathname === "/rest/v1/trips")
        return response(
          allow
            ? [{ id: tripId, title: "Test trip", destination: "Test City" }]
            : [],
        );
      if (url.pathname === "/rest/v1/itinerary_items")
        return response(allow ? rows : []);
    }
    throw new Error(`Unexpected external call ${url.href}`);
  };
  return { fetcher, urls };
}
test("categories use stored values, legacy categories and Other without AI", () => {
  assert.equal(category(item()), "Attraction");
  assert.equal(category(item({ activity_category: "food" })), "Food");
  assert.equal(
    category(
      item({ activity_category: null, description: "category:transport" }),
    ),
    "Transport",
  );
  assert.equal(category(item({ activity_category: "shopping" })), "Shopping");
  assert.equal(
    category(item({ activity_category: null, description: "A visit" })),
    "Other",
  );
});
test("coordinates reject null, NaN, strings and out of range but accept zero", () => {
  for (const pair of [
    [null, null],
    [NaN, 2],
    [91, 2],
    [1, 181],
    ["35", 135],
  ])
    assert.equal(coordinates(...(pair as [unknown, unknown])), null);
  assert.deepEqual(coordinates(0, 0), { latitude: 0, longitude: 0 });
  assert.equal(
    distance({ latitude: 1, longitude: 2 }, { latitude: 1, longitude: 2 }),
    0,
  );
});
test("trip map rejects unauthenticated requests before database or Wikipedia", async () => {
  const { fetcher, urls } = fixture([]);
  const result = await createTripMapHandler({ env, fetcher })(
    request({ tripId }, false),
  );
  assert.equal(result.status, 401);
  assert.deepEqual(urls, []);
});
test("trip map denies an inaccessible trip before reading itinerary", async () => {
  const { fetcher, urls } = fixture([], false);
  const result = await createTripMapHandler({ env, fetcher })(
    request({ tripId }),
  );
  assert.equal(result.status, 404);
  assert.equal(urls.length, 2);
});
test("saved coordinates produce pins without external geocoding", async () => {
  const { fetcher, urls } = fixture([item()]);
  const result = await createTripMapHandler({ env, fetcher })(
    request({ tripId }),
  );
  assert.equal(result.status, 200);
  const value = await result.json();
  assert.equal(value.places[0].id, placeId);
  assert.equal(value.places[0].latitude, 35);
  assert.equal(value.places[0].coordinateSource, "saved");
  assert.deepEqual(value.places[0].tags, ["Attractions"]);
  assert.deepEqual(value.unresolved, []);
  assert.equal(value.nextOffset, null);
  assert.equal(urls.length, 3);
});
test("a full page advertises the next offset", async () => {
  const { fetcher, urls } = fixture(
    Array.from({ length: 4 }, (_, i) => item({ position: i })),
  );
  const value = await (
    await createTripMapHandler({ env, fetcher })(request({ tripId, offset: 4 }))
  ).json();
  assert.equal(value.nextOffset, 8);
  assert.equal(new URL(urls[2]).searchParams.get("offset"), "4");
  assert.equal(new URL(urls[2]).searchParams.get("trip_id"), `eq.${tripId}`);
});
test("missing coordinates remain visible as unresolved when lookup fails", async () => {
  const { fetcher } = fixture([item({ latitude: null, longitude: null })]);
  const value = await (
    await createTripMapHandler({ env, fetcher })(request({ tripId }))
  ).json();
  assert.deepEqual(value.places, []);
  assert.equal(value.unresolved[0].id, placeId);
  assert.match(value.unresolved[0].reason, /lookup failed/);
});
test("invalid trip ID and invalid offset are rejected", async () => {
  for (const body of [
    { tripId: "not-a-trip" },
    { tripId, offset: -1 },
    { tripId, offset: "0" },
  ]) {
    const { fetcher } = fixture([]);
    assert.equal(
      (await createTripMapHandler({ env, fetcher })(request(body))).status,
      400,
    );
  }
});
test("details and AI reject inaccessible item before Wikipedia, quota or Gemini", async () => {
  for (const factory of [createDetailsHandler, createAssistantHandler]) {
    const { fetcher, urls } = fixture([], false);
    const result = await factory({ env, fetcher })(
      request({ placeId, question: "What can I see?" }),
    );
    assert.equal(result.status, 404);
    assert.equal(urls.length, 2);
    assert.ok(
      urls.every(
        (url) =>
          !url.includes("googleapis") &&
          !url.includes("wikipedia") &&
          !url.includes("rpc"),
      ),
    );
  }
});
function wikiFetch(
  name: string,
  title: string,
  lat: number,
  lon: number,
  disambiguation = false,
): typeof fetch {
  return async (input) => {
    const url = new URL(String(input));
    assert.equal(url.hostname, "en.wikipedia.org");
    const isDestination = url.searchParams.get("titles") === "Testville";
    return response({
      query: {
        pages: [
          {
            title: isDestination ? "Testville" : title,
            coordinates: [
              { lat: isDestination ? 35 : lat, lon: isDestination ? 135 : lon },
            ],
            pageprops:
              disambiguation && !isDestination ? { disambiguation: "" } : {},
          },
        ],
      },
    });
  };
}
test("exact nearby article resolves a pin and article identity", async () => {
  const name = "Exact Test Museum";
  const match = await resolveArticle(
    name,
    "Testville",
    null,
    wikiFetch(name, name, 35.01, 135.01),
  );
  assert.equal(match?.article, name);
  assert.equal(match?.latitude, 35.01);
});
test("same-name distant article is rejected", async () => {
  const name = "Far Test Museum";
  assert.equal(
    await resolveArticle(name, "Testville", null, wikiFetch(name, name, 1, 2)),
    null,
  );
});
test("nearby different-name article is rejected", async () => {
  const name = "Specific Test Cafe";
  assert.equal(
    await resolveArticle(
      name,
      "Testville",
      null,
      wikiFetch(name, "Testville", 35, 135),
    ),
    null,
  );
});
test("disambiguation page is never used for place details", async () => {
  const name = "Ambiguous Test Museum";
  assert.equal(
    await resolveArticle(
      name,
      "Testville",
      null,
      wikiFetch(name, name, 35, 135, true),
    ),
    null,
  );
});
test("saved coordinate anchors article matching even without destination", async () => {
  const name = "Saved Point Museum";
  const match = await resolveArticle(
    name,
    "",
    { latitude: 35, longitude: 135 },
    wikiFetch(name, name, 35.005, 135),
  );
  assert.equal(match?.article, name);
});

test("matched Wikidata image works even when the article has no lead photo", async () => {
  const { fetchPlaceDetails } =
    await import("../supabase/functions/_shared/places.ts");
  const fetcher: typeof fetch = async (input) => {
    const url = new URL(String(input));
    if (url.hostname === "www.wikidata.org")
      return response({
        entities: {
          Q777: {
            claims: {
              P18: [
                {
                  rank: "normal",
                  mainsnak: { datavalue: { value: "Selected museum.jpg" } },
                },
              ],
            },
          },
        },
      });
    if (url.searchParams.get("prop") === "imageinfo")
      return response({
        query: {
          pages: [
            {
              imageinfo: [
                {
                  mime: "image/jpeg",
                  url: "https://upload.wikimedia.org/museum.jpg",
                  descriptionurl:
                    "https://commons.wikimedia.org/wiki/File:Selected_museum.jpg",
                  extmetadata: {
                    LicenseUrl: {
                      value: "https://creativecommons.org/licenses/by/4.0/",
                    },
                    LicenseShortName: { value: "CC BY 4.0" },
                    Artist: { value: "Photographer" },
                  },
                },
              ],
            },
          ],
        },
      });
    return response({
      query: {
        pages: [
          {
            title: "Selected Museum",
            fullurl: "https://en.wikipedia.org/wiki/Selected_Museum",
            extract: "About this museum",
          },
        ],
      },
    });
  };
  const result = await fetchPlaceDetails(placeId, fetcher, true, {
    name: "Selected Museum",
    article: "Selected Museum",
    area: "Test City",
    language: "en",
    photoEntityId: "Q777",
  });
  assert.equal(result.placeId, placeId);
  assert.equal(result.photos.length, 1);
  assert.equal(result.photos[0].id, "Selected museum.jpg");
  assert.equal(result.photos[0].author, "Photographer");
});
