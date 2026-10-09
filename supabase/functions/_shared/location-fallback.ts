import { wiki } from "./places.ts";
import { coordinates } from "./trip-places.ts";
import type { Fetcher } from "./http.ts";

// Candidates require user confirmation; never silently assign a guessed pin.
export async function searchWikipediaLocations(query: string, fetcher: Fetcher) {
  const data = await wiki(fetcher, {
    generator: "search", gsrsearch: query, gsrnamespace: "0", gsrlimit: "6",
    prop: "coordinates|pageprops|pageterms", ppprop: "disambiguation",
    coprimary: "primary", colimit: "max", wbptterms: "description",
  });
  return (data.query?.pages ?? []).flatMap((page: any) => {
    const point = coordinates(page.coordinates?.[0]?.lat, page.coordinates?.[0]?.lon);
    if (!point || page.pageprops?.disambiguation !== undefined ||
        !Number.isSafeInteger(page.pageid) || page.pageid <= 0 || typeof page.title !== "string") return [];
    return [{ provider: "wikipedia", providerId: "wiki:en:" + page.pageid,
      name: page.title.slice(0, 200), address: (page.terms?.description?.[0] ?? page.title).slice(0, 600),
      ...point, categories: [] }];
  }).slice(0, 6);
}
