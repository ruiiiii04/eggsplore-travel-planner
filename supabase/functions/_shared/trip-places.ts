import { categoryVibes } from "./location-categories.ts";
// NEW: read itinerary data with the caller's JWT. Never use a service-role key.
import {
  ApiError,
  timedFetch,
  type authenticate,
  type Fetcher,
} from "./http.ts";
import { catalog } from "./catalog.ts";
import { wiki, fetchPlaceDetails, type ArticlePlace } from "./places.ts";
export type Auth = Awaited<ReturnType<typeof authenticate>>;
export type Item = {
  id: string;
  trip_id: string;
  title: string;
  description: string | null;
  location_name: string | null;
  location_categories?: string[] | null;
  activity_category: string | null;
  vibe_tags?: string[] | null;
  vibe_source?: string | null;
  latitude: number | null;
  longitude: number | null;
  position: number;
};
export const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function requireUuid(value: unknown): string {
  if (typeof value !== "string" || !uuid.test(value))
    throw new ApiError(400, "ID", "Invalid trip or place ID.");
  return value;
}
export async function readRows<T>(
  auth: Auth,
  table: string,
  params: Record<string, string>,
  fetcher: Fetcher,
): Promise<T[]> {
  const response = await timedFetch(
    fetcher,
    `${auth.url}/rest/v1/${table}?${new URLSearchParams(params)}`,
    {
      headers: { apikey: auth.key, Authorization: auth.authorization },
    },
  );
  if (!response.ok)
    throw new ApiError(
      503,
      "TRIP_READ",
      "Could not load the itinerary. Check the trip database setup and retry.",
    );
  const rows = await response.json();
  if (!Array.isArray(rows))
    throw new ApiError(503, "TRIP_READ", "Unexpected itinerary response.");
  return rows;
}
export async function readTrip(auth: Auth, id: string, fetcher: Fetcher) {
  const rows = await readRows<{
    id: string;
    destination: string | null;
    title: string;
  }>(
    auth,
    "trips",
    { select: "id,title,destination", id: `eq.${requireUuid(id)}`, limit: "1" },
    fetcher,
  );
  if (!rows[0])
    throw new ApiError(
      404,
      "TRIP_ACCESS",
      "This trip is unavailable or you no longer have access.",
    );
  return rows[0];
}
export const itemFields =
  "id,trip_id,title,description,location_name,activity_category,latitude,longitude,position,vibe_tags,vibe_source,location_categories";
export async function readItem(auth: Auth, id: string, fetcher: Fetcher) {
  const rows = await readRows<Item>(
    auth,
    "itinerary_items",
    { select: itemFields, id: `eq.${requireUuid(id)}`, limit: "1" },
    fetcher,
  );
  if (!rows[0])
    throw new ApiError(
      404,
      "PLACE_ACCESS",
      "This itinerary place is unavailable or you no longer have access.",
    );
  const trip = await readTrip(auth, rows[0].trip_id, fetcher);
  return { item: rows[0], trip };
}
export function category(
  item: Pick<Item, "activity_category" | "description">,
) {
  const raw =
    item.activity_category?.trim() ||
    (item.description?.startsWith("category:")
      ? item.description.slice(9).trim()
      : "");
  const labels: Record<string, string> = {
    sightseeing: "Attraction",
    food: "Food",
    transport: "Transport",
    stay: "Stay",
  };
  return (
    labels[raw.toLowerCase()] ??
    (raw ? raw.charAt(0).toUpperCase() + raw.slice(1, 60) : "Other")
  );
}
export function coordinates(
  latitude: unknown,
  longitude: unknown,
): { latitude: number; longitude: number } | null {
  return typeof latitude === "number" &&
    Number.isFinite(latitude) &&
    Math.abs(latitude) <= 90 &&
    typeof longitude === "number" &&
    Number.isFinite(longitude) &&
    Math.abs(longitude) <= 180
    ? { latitude, longitude }
    : null;
}
export function normalize(value: string) {
  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}
export function distance(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
) {
  const rad = Math.PI / 180;
  const h =
    Math.sin(((b.latitude - a.latitude) * rad) / 2) ** 2 +
    Math.cos(a.latitude * rad) *
      Math.cos(b.latitude * rad) *
      Math.sin(((b.longitude - a.longitude) * rad) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}
type Match = ArticlePlace & { latitude: number; longitude: number };
type Page = {
  title: string;
  missing?: boolean;
  pageprops?: { disambiguation?: unknown; wikibase_item?: string };
  coordinates?: { lat: number; lon: number }[];
};
// Public article results only; no trip IDs, descriptions, or user tokens cached.
const cache = new Map<string, { expires: number; value: Match | null }>();
function remember(key: string, value: Match | null) {
  if (cache.size >= 200) cache.delete(cache.keys().next().value!);
  cache.set(key, { value, expires: Date.now() + 15 * 60_000 });
  return value;
}
export async function resolveArticle(
  name: string,
  destination: string,
  saved: ReturnType<typeof coordinates>,
  fetcher: Fetcher,
): Promise<Match | null> {
  const key = JSON.stringify([name, destination, saved]);
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) return cached.value;
  if (!name.trim() || name.length > 240) return null;
  // Reviewed Osaka identities retain the correct park image and Japanese market article.
  const known = Object.values(catalog).find(
    (p) =>
      normalize(p.name) === normalize(name) && /osaka|大阪/i.test(destination),
  );
  const language = known?.language ?? "en";
  const city = destination.split(",")[0].trim();
  const nameParts = name.split(",").map((part) => part.trim());
  const lookupName =
    nameParts.length > 1 && normalize(nameParts[1]) === normalize(city)
      ? nameParts[0]
      : name;
  const response = await wiki(
    fetcher,
    {
      titles: known?.article ?? lookupName,
      redirects: "1",
      prop: "coordinates|pageprops",
      coprimary: "primary",
      ppprop: "disambiguation|wikibase_item",
    },
    language,
  );
  let candidates: Page[] = response.query?.pages ?? [];
  const exactArticle = candidates.some(
    (p) =>
      !p.missing &&
      p.coordinates?.length &&
      (normalize(p.title) === normalize(lookupName) ||
        response.query?.redirects?.some(
          (r: { from: string; to: string }) =>
            normalize(r.from) === normalize(lookupName) && r.to === p.title,
        )),
  );
  if (!known && !exactArticle) {
    const search = await wiki(fetcher, {
      generator: "search",
      gsrsearch: `${lookupName} ${destination}`.slice(0, 350),
      gsrnamespace: "0",
      gsrlimit: "5",
      prop: "coordinates|pageprops",
      coprimary: "primary",
      ppprop: "disambiguation|wikibase_item",
    });
    candidates = search.query?.pages ?? [];
  }
  // A saved point is a strong geographic anchor. Otherwise require an exact,
  // coordinate-bearing destination article; broad/country destinations are not guessed.
  let anchor = saved;
  if (!anchor && destination.trim()) {
    const dest = await wiki(fetcher, {
      titles: city,
      redirects: "1",
      prop: "coordinates|pageprops",
      coprimary: "primary",
      ppprop: "disambiguation|wikibase_item",
    });
    const page: Page | undefined = dest.query?.pages?.[0];
    if (page && page.pageprops?.disambiguation === undefined)
      anchor = coordinates(
        page.coordinates?.[0]?.lat,
        page.coordinates?.[0]?.lon,
      );
  }
  if (!anchor) return remember(key, null);
  const matches = candidates.flatMap((page) => {
    if (page.missing || page.pageprops?.disambiguation !== undefined) return [];
    const point = coordinates(
      page.coordinates?.[0]?.lat,
      page.coordinates?.[0]?.lon,
    );
    if (!point || distance(anchor!, point) > (saved ? 3 : 80)) return [];
    // Only exact place names (ignoring a disambiguating parenthesis) are accepted.
    // A search result about a city/nearby business must never become this place.
    if (
      !known &&
      !exactArticle &&
      normalize(page.title.replace(/\s*\([^)]*\)\s*$/, "")) !==
        normalize(lookupName)
    )
      return [];
    return [
      {
        ...point,
        name,
        area: destination,
        article: page.title,
        language,
        ...(known && "photoEntityId" in known
          ? { photoEntityId: known.photoEntityId }
          : /^Q[1-9][0-9]*$/.test(page.pageprops?.wikibase_item ?? "")
            ? { photoEntityId: page.pageprops!.wikibase_item! }
            : {}),
      },
    ];
  });
  return remember(key, matches.length === 1 ? matches[0] : null);
}
export async function authorizedPlace(
  auth: Auth,
  id: string,
  fetcher: Fetcher,
) {
  const { item, trip } = await readItem(auth, id, fetcher);
  const name = item.location_name?.trim() || item.title;
  return {
    item,
    name,
    area: trip.destination ?? "",
    point: coordinates(item.latitude, item.longitude),
  };
}
export async function itineraryDetails(
  auth: Auth,
  id: string,
  fetcher: Fetcher,
  photos = true,
) {
  const place = await authorizedPlace(auth, id, fetcher);
  const article = await resolveArticle(
    place.name,
    place.area,
    place.point,
    fetcher,
  );
  if (!article)
    throw new ApiError(
      404,
      "NO_DETAILS",
      "No reliable Wikipedia match was found. Saved itinerary details are shown instead; many shops and restaurants have no Wikipedia article.",
    );
  return fetchPlaceDetails(id, fetcher, photos, article);
}

// NEW: stored vibes are independent of the four itinerary activity categories.
const allowedVibes = new Set(["Foodie", "Heritage", "Nature", "Shopping", "Arts", "Entertainment", "Nightlife", "Wellness", "Tranquility", "Attractions", "Transport", "Stay"]);
export function vibeTags(item: Pick<Item, "vibe_tags" | "activity_category" | "description" | "location_categories">): string[] {
  const providerTags = categoryVibes(item.location_categories ?? []);
  if (providerTags.length) return [...new Set([...providerTags, ...(item.vibe_tags ?? []).filter(tag => allowedVibes.has(tag))])];
  if (Array.isArray(item.vibe_tags)) {
    const tags = [...new Set(item.vibe_tags.filter(tag => allowedVibes.has(tag)))];
    return tags.length ? tags : ["Unclassified"];
  }
  // Compatibility for fixtures/older API shapes; migration is required in production.
  const label = category(item);
  const fallback: Record<string, string> = { Food: "Foodie", Attraction: "Attractions", Transport: "Transport", Stay: "Stay" };
  return [fallback[label] ?? "Unclassified"];
}
