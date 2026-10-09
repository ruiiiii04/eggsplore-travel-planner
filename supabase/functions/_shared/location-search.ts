import { ApiError, authenticate, failure, json, preflight, readBody, timedFetch, type Env, type Fetcher } from "./http.ts";
import { coordinates, readTrip, requireUuid } from "./trip-places.ts";
export function createLocationSearchHandler({ env, fetcher = fetch }: { env: Env; fetcher?: Fetcher }) {
  return async (req: Request) => {
    const early = preflight(req);
    if (early) return early;
    try {
      const auth = await authenticate(req, env, fetcher);
      const body = await readBody(req);
      const trip = await readTrip(auth, requireUuid(body.tripId), fetcher);
      const query = typeof body.query === "string" ? body.query.trim() : "";
      if (query.length < 2 || query.length > 200) throw new ApiError(400, "QUERY", "Enter a place name between 2 and 200 characters.");
      const key = env("GEOAPIFY_API_KEY");
      if (!key) throw new ApiError(503, "LOCATION_SETUP", "Place search is not available yet. You can drop a pin on the map instead.");
      const city = trip.destination?.trim() ?? "";
      const text = city && !query.toLowerCase().includes(city.toLowerCase()) ? query + ", " + city : query;
      const params = new URLSearchParams({ text, format: "json", limit: "6", apiKey: key });
      const response = await timedFetch(fetcher, "https://api.geoapify.com/v1/geocode/autocomplete?" + params, {}, 12_000);
      if (!response.ok) throw new ApiError(503, "LOCATION_SEARCH", "Place search could not load. Retry or drop a pin.");
      const data = await response.json();
      const places = (Array.isArray(data.results) ? data.results : []).flatMap((row: Record<string, unknown>) => {
        const point = coordinates(row.lat, row.lon);
        if (!point || typeof row.place_id !== "string" || row.place_id.length > 1500) return [];
        const name = typeof row.name === "string" ? row.name : typeof row.address_line1 === "string" ? row.address_line1 : row.formatted;
        if (typeof name !== "string" || !name.trim()) return [];
        const categories = [...new Set([
          ...(Array.isArray(row.categories) ? row.categories : []),
          ...(typeof row.category === "string" ? [row.category] : []),
        ].filter((value): value is string => typeof value === "string" && value.length <= 120))].slice(0, 20);
        return [{ provider: "geoapify", providerId: row.place_id, name: name.slice(0, 200),
          address: typeof row.formatted === "string" ? row.formatted.slice(0, 600) : name, ...point, categories }];
      }).slice(0, 6);
      return json({ places });
    } catch (error) { return failure(error); }
  };
}
