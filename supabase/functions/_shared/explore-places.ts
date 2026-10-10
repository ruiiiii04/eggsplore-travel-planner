// Public Wikipedia identities are resolved on the server, never client URLs.
import {
  ApiError,
  authenticate,
  failure,
  json,
  preflight,
  readBody,
  type Env,
  type Fetcher,
} from "./http.ts";
import { wiki, fetchPlaceDetails, type ArticlePlace } from "./places.ts";
import {
  coordinates,
  distance,
  normalize,
  readRows,
  readTrip,
  requireUuid,
  type Item,
} from "./trip-places.ts";
export const exploreId = /^wiki:en:([1-9][0-9]{0,11})$/;
type Page = {
  pageid: number;
  title: string;
  missing?: boolean;
  coordinates?: { lat: number; lon: number }[];
  pageprops?: { disambiguation?: unknown; wikibase_item?: string };
  terms?: { description?: string[]; alias?: string[] };
  categories?: { title: string }[];
};
const pointOf = (p: Page) =>
  coordinates(p.coordinates?.[0]?.lat, p.coordinates?.[0]?.lon);
function article(p: Page): ArticlePlace {
  return {
    name: p.title,
    article: p.title,
    language: "en",
    area: p.terms?.description?.[0] ?? "",
    ...(/^Q[1-9][0-9]*$/.test(p.pageprops?.wikibase_item ?? "")
      ? { photoEntityId: p.pageprops!.wikibase_item }
      : {}),
  };
}
export async function exploreArticle(id: string, fetcher: Fetcher) {
  const match = exploreId.exec(id);
  if (!match) throw new ApiError(400, "PLACE", "Invalid Explore place.");
  const data = await wiki(fetcher, {
    pageids: match[1],
    prop: "coordinates|pageprops|pageterms",
    ppprop: "disambiguation|wikibase_item",
    wbptterms: "description",
    coprimary: "primary",
    colimit: "max",
  });
  const p: Page | undefined = data.query?.pages?.[0];
  if (
    !p ||
    p.missing ||
    p.pageprops?.disambiguation !== undefined ||
    !pointOf(p)
  )
    throw new ApiError(404, "NO_DETAILS", "This place is no longer available.");
  return article(p);
}
export async function exploreDetails(
  id: string,
  fetcher: Fetcher,
  photos = true,
) {
  return fetchPlaceDetails(
    id,
    fetcher,
    photos,
    await exploreArticle(id, fetcher),
  );
}
// Conservative visitor-place rules. Category metadata improves coverage over names alone.
export function exploreTags(
  p: Pick<Page, "title" | "terms" | "categories">,
): string[] {
  const name =
    `${p.title} ${p.terms?.description?.join(" ") ?? ""}`.toLowerCase();
  if (
    /\b(former|demolished|defunct|closed|residential|apartment|railway station|metro station|university|hospital|school|cemetery)\b/.test(
      name,
    )
  )
    return [];
  const description = p.terms?.description?.join(" ") ?? "";
  if (
    /^(?:designated )?(?:city|town|prefecture|province|country|municipality|administrative|ward|district)\b/i.test(
      description,
    )
  )
    return [];
  const text =
    `${name} ${(p.categories ?? []).map((c) => c.title).join(" ")}`.toLowerCase();
  if (/\b(defunct|demolished|former museums|closed museums)\b/.test(text))
    return [];
  const tags: string[] = [];
  if (
    /\b(castle|temple|shrine|palace|cathedral|heritage|historic site|mosque|monument)\b/.test(
      text,
    )
  )
    tags.push("Heritage");
  if (
    /\b(park|garden|beach|waterfall|botanical|nature reserve)\b/.test(text) &&
    !/theme park|amusement park/.test(text)
  )
    tags.push("Nature");
  if (/\b(museum|gallery|art galleries|theatre|theater)\b/.test(text))
    tags.push("Arts");
  if (/\b(market|shopping|mall|bazaar)\b/.test(text)) tags.push("Shopping");
  if (/\b(restaurant|cafe|café|food market)\b/.test(text)) tags.push("Foodie");
  if (
    /\b(aquarium|zoo|theme park|amusement park|observation deck)\b/.test(text)
  )
    tags.push("Entertainment");
  if (
    !tags.length &&
    /\b(tourist attraction|landmark|tower|skyscraper)\b/.test(text)
  )
    tags.push("Attractions");
  return tags;
}
function nameKey(s: string) {
  return normalize(s.replace(/\s*\([^)]*\)\s*$/, ""));
}
export function alreadyPlanned(p: Page, items: Item[], ids: Set<number>) {
  if (ids.has(p.pageid)) return true;
  const names = [p.title, ...(p.terms?.alias ?? [])]
    .map(nameKey)
    .filter(Boolean);
  const point = pointOf(p);
  return items.some((item) => {
    const saved = coordinates(item.latitude, item.longitude);
    if (point && saved && distance(point, saved) < 0.075) return true;
    return [item.location_name, item.title]
      .filter((x): x is string => Boolean(x))
      .some((value) => {
        const key = nameKey(value);
        return names.some(
          (n) => n === key || (n.length >= 6 && ` ${key} `.includes(` ${n} `)),
        );
      });
  });
}
async function allItems(
  auth: Parameters<typeof readTrip>[0],
  tripId: string,
  fetcher: Fetcher,
) {
  const items: Item[] = [];
  for (let offset = 0; offset < 10_000; offset += 500) {
    const rows = await readRows<Item>(
      auth,
      "itinerary_items",
      {
        select: "id,title,location_name,latitude,longitude",
        trip_id: `eq.${tripId}`,
        order: "id.asc",
        offset: String(offset),
        limit: "500",
      },
      fetcher,
    );
    items.push(...rows);
    if (rows.length < 500) return items;
  }
  throw new ApiError(
    422,
    "TRIP_SIZE",
    "This itinerary is too large to check for Explore duplicates.",
  );
}
export function createExploreHandler({
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
      const id = requireUuid((await readBody(req)).tripId);
      const trip = await readTrip(auth, id, fetcher);
      const city = trip.destination?.split(",")[0].trim();
      if (!city || city.length > 150 || city.includes("|"))
        throw new ApiError(
          422,
          "CITY",
          "Add a specific city as the trip destination to use Explore.",
        );
      const cityData = await wiki(fetcher, {
        titles: [...new Set([trip.destination!.trim(), city])].join("|"),
        redirects: "1",
        prop: "coordinates|pageprops|pageterms",
        ppprop: "disambiguation",
        wbptterms: "description",
        coprimary: "primary",
        colimit: "max",
      });
      const cityPages = (cityData.query?.pages ?? []) as Page[];
      const cityPage =
        cityPages.find(
          (p) =>
            !p.missing &&
            normalize(p.title) === normalize(trip.destination!.trim()),
        ) ??
        cityPages.find(
          (p) => !p.missing && normalize(p.title) === normalize(city),
        ) ??
        cityPages.find(
          (p) =>
            !p.missing &&
            cityData.query?.redirects?.some(
              (r: { to: string }) => r.to === p.title,
            ),
        );
      const center = cityPage && pointOf(cityPage);
      const cityDescription = cityPage?.terms?.description?.join(" ") ?? "";
      if (
        !cityPage ||
        cityPage.missing ||
        cityPage.pageprops?.disambiguation !== undefined ||
        !center ||
        !/\b(city|town|municipality|capital|metropolis)\b/i.test(
          cityDescription,
        )
      )
        throw new ApiError(
          422,
          "CITY",
          "Could not identify the destination city. Use a specific destination such as Osaka, Japan or Kuala Lumpur, Malaysia.",
        );
      const items = await allItems(auth, id, fetcher);
      // Resolve existing names/redirects in batches; don't send private descriptions.
      const titles = [
        ...new Set(
          items
            .flatMap((i) => [i.location_name, i.title])
            .filter((s): s is string => Boolean(s?.trim()))
            .map((s) => s.trim())
            .filter((s) => s.length <= 250 && !s.includes("|")),
        ),
      ];
      const excludedIds = new Set<number>([cityPage.pageid]);
      for (let start = 0; start < titles.length; start += 50) {
        const matches = await wiki(fetcher, {
          titles: titles.slice(start, start + 50).join("|"),
          redirects: "1",
          prop: "info",
        });
        for (const p of matches.query?.pages ?? [])
          if (!p.missing) excludedIds.add(p.pageid);
      }
      const nearbyParams = {
        generator: "geosearch",
        ggscoord: `${center.latitude}|${center.longitude}`,
        ggsradius: "10000",
        ggslimit: "200",
        ggsnamespace: "0",
        prop: "coordinates|pageprops|pageterms|categories",
        ppprop: "disambiguation|wikibase_item",
        wbptterms: "description|alias",
        cllimit: "max",
        clshow: "!hidden",
        coprimary: "primary",
        colimit: "max",
      };
      const nearby = await wiki(fetcher, nearbyParams);
      const pages = new Map<number, Page>(
        (nearby.query?.pages ?? []).map((p: Page) => [p.pageid, p]),
      );
      // Visible categories may span responses. Bound follow-ups and keep all coordinates.
      let continuation = nearby.continue;
      for (let page = 0; page < 2 && continuation?.clcontinue; page++) {
        const more = await wiki(fetcher, { ...nearbyParams, ...continuation });
        for (const p of (more.query?.pages ?? []) as Page[]) {
          const before = pages.get(p.pageid);
          pages.set(p.pageid, {
            ...before,
            ...p,
            coordinates: p.coordinates ?? before?.coordinates,
            categories: [
              ...(before?.categories ?? []),
              ...(p.categories ?? []),
            ],
          });
        }
        continuation = more.continue;
      }
      const candidates = [...pages.values()];
      const seen = new Set<number>();
      const results = candidates
        .flatMap((p) => {
          const point = pointOf(p),
            tags = exploreTags(p);
          if (
            p.missing ||
            seen.has(p.pageid) ||
            p.pageprops?.disambiguation !== undefined ||
            !point ||
            !tags.length ||
            distance(center, point) > 10 ||
            alreadyPlanned(p, items, excludedIds)
          )
            return [];
          seen.add(p.pageid);
          return [
            {
              id: `wiki:en:${p.pageid}`,
              name: p.title,
              ...point,
              area: trip.destination ?? city,
              description: "",
              tags,
              coordinateSource: "wikipedia",
              vibeSource: "rules",
              km: distance(center, point),
            },
          ];
        })
        .sort((a, b) => a.km - b.km);
      // Round-robin categories provides variety without claiming popularity or AI ranking.
      const selected: typeof results = [],
        picked = new Set<string>();
      const groups = [...new Set(results.flatMap((p) => p.tags))];
      while (selected.length < 20) {
        let added = false;
        for (const tag of groups) {
          const p = results.find(
            (p) => p.tags.includes(tag) && !picked.has(p.id),
          );
          if (p) {
            selected.push(p);
            picked.add(p.id);
            added = true;
          }
          if (selected.length === 20) break;
        }
        if (!added) break;
      }
      return json({
        tripId: id,
        city: cityPage.title,
        center,
        places: selected.map(({ km, ...p }) => p),
      });
    } catch (error) {
      return failure(error);
    }
  };
}
