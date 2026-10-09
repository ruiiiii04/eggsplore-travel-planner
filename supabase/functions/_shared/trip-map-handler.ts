import {
  authenticate,
  ApiError,
  failure,
  json,
  preflight,
  readBody,
  type Env,
  type Fetcher,
} from "./http.ts";
import {
  vibeTags,
  coordinates,
  itemFields,
  readRows,
  readTrip,
  requireUuid,
  resolveArticle,
  type Item,
} from "./trip-places.ts";
export function createTripMapHandler({
  env,
  fetcher = fetch,
}: {
  env: Env;
  fetcher?: Fetcher;
}) {
  return async (req: Request) => {
    const early = preflight(req);
    if (early) return early;
    try {
      const auth = await authenticate(req, env, fetcher);
      const body = await readBody(req);
      const id = requireUuid(body.tripId);
      const offset = body.offset ?? 0;
      if (
        !Number.isInteger(offset) ||
        Number(offset) < 0 ||
        Number(offset) > 100_000
      )
        throw new ApiError(400, "OFFSET", "Invalid itinerary page.");
      const trip = await readTrip(auth, id, fetcher);
      // Small pages bound external requests. Client progressively loads every page.
      const rows = await readRows<Item>(
        auth,
        "itinerary_items",
        {
          select: itemFields,
          trip_id: `eq.${id}`,
          order: "position.asc,id.asc",
          offset: String(offset),
          limit: "4",
        },
        fetcher,
      );
      const results = await Promise.all(
        rows.map(async (item) => {
          const name = item.location_name?.trim() || item.title;
          const saved = coordinates(item.latitude, item.longitude);
          let point = saved;
          let reason =
            "Could not locate this place reliably. Open the itinerary and use its specific place name and city.";
          if (!point) {
            try {
              point = await resolveArticle(
                name,
                trip.destination ?? "",
                null,
                fetcher,
              );
            } catch {
              reason =
                "Location lookup failed. Retry when your connection is available.";
            }
          }
          const base = {
            id: item.id,
            name,
            tags: vibeTags(item),
            vibeSource: item.vibe_source ?? "rules",
            area: trip.destination ?? "",
            description: item.description?.startsWith("category:")
              ? ""
              : (item.description ?? ""),
            tripId: id,
            position: item.position,
          };
          return point
            ? {
                place: {
                  ...base,
                  latitude: point.latitude,
                  longitude: point.longitude,
                  coordinateSource: saved ? "saved" : "wikipedia",
                },
                unresolved: null,
              }
            : { place: null, unresolved: { ...base, reason } };
        }),
      );
      return json({
        tripId: id,
        places: results.flatMap((r) => (r.place ? [r.place] : [])),
        unresolved: results.flatMap((r) =>
          r.unresolved ? [r.unresolved] : [],
        ),
        nextOffset: rows.length === 4 ? Number(offset) + 4 : null,
      });
    } catch (error) {
      return failure(error);
    }
  };
}
