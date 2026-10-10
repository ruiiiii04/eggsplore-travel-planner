import { catalog, type PlaceId } from "./catalog.ts";
import { ApiError, timedFetch, type Fetcher } from "./http.ts";
export type Photo = {
  id: string;
  url: string;
  caption: string;
  author: string;
  license: string;
  licenseUrl: string;
  sourceUrl: string;
};
export type PlaceDetails = {
  placeId: string;
  name: string;
  description: string;
  sourceUrl: string;
  sourceTitle: string;
  sourceLanguage: "en" | "ja";
  textLicenseUrl: string;
  photos: Photo[];
  photoNotice: string | null;
  fetchedAt: string;
};
export function plainText(value: unknown) {
  if (typeof value !== "string") return "";
  return value
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(x[0-9a-f]+|\d+);/gi, (_, code: string) => {
      const n =
        code[0].toLowerCase() === "x"
          ? parseInt(code.slice(1), 16)
          : Number(code);
      return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : "";
    })
    .trim();
}
function safeHttps(value: unknown, hosts?: string[]) {
  if (typeof value !== "string") return "";
  try {
    const url = new URL(value.startsWith("//") ? `https:${value}` : value);
    // Commons may return historical HTTP Creative Commons license links.
    if (url.protocol === "http:" && url.hostname === "creativecommons.org") {
      url.protocol = "https:";
    }
    if (url.protocol !== "https:" || url.username || url.password) return "";
    if (hosts && !hosts.includes(url.hostname)) return "";
    return url.href;
  } catch {
    return "";
  }
}
export async function wiki(
  fetcher: Fetcher,
  params: Record<string, string>,
  language: "en" | "ja" = "en",
) {
  const query = new URLSearchParams({
    action: "query",
    format: "json",
    formatversion: "2",
    ...params,
  });
  const response = await timedFetch(
    fetcher,
    `https://${language}.wikipedia.org/w/api.php?${query}`,
    {
      headers: {
        "User-Agent": "EggsploreDemo/1.0 (educational travel planner)",
        Accept: "application/json",
      },
    },
    25_000,
  );
  if (!response.ok)
    throw new ApiError(
      503,
      "PLACE_UNAVAILABLE",
      "Online place information is temporarily unavailable.",
    );
  const data = await response.json();
  if (data.error)
    throw new ApiError(
      503,
      "PLACE_UNAVAILABLE",
      "Online place information is temporarily unavailable.",
    );
  return data;
}
export type ArticlePlace = {
  name: string;
  article: string;
  language: "en" | "ja";
  area: string;
  photoEntityId?: string;
  photoEntityRequired?: boolean;
};
export async function fetchPlaceDetails(
  placeId: string,
  fetcher: Fetcher,
  includePhotos = true,
  articlePlace?: ArticlePlace,
): Promise<PlaceDetails> {
  const place: ArticlePlace = articlePlace ?? catalog[placeId as PlaceId];
  if (!place)
    throw new ApiError(404, "NO_DETAILS", "No matching place is available.");
  const data = await wiki(
    fetcher,
    {
      prop: "extracts|pageimages|info|pageprops",
      titles: place.article,
      redirects: "1",
      exintro: "1",
      explaintext: "1",
      exchars: "3000",
      inprop: "url",
      piprop: "name",
      pilicense: "free",
      ppprop: "disambiguation",
    },
    place.language,
  );
  const page = data.query?.pages?.[0];
  if (!page || page.missing || page.pageprops?.disambiguation !== undefined) {
    throw new ApiError(
      404,
      "NO_DETAILS",
      "No matching online article is available for this place.",
    );
  }
  const sourceUrl = safeHttps(page.fullurl, [
    `${place.language}.wikipedia.org`,
  ]);
  if (!sourceUrl)
    throw new ApiError(
      503,
      "PLACE_UNAVAILABLE",
      "The place source could not be verified.",
    );
  const photos: Photo[] = [];
  let photoNotice: string | null =
    "No licensed photo is available for this place.";
  // Exact Wikimedia identities only; no fuzzy image searches.
  // The park article's lead depicts a nearby hall. Its reviewed Wikidata entity
  // supplies P18 (image of the park itself) instead.
  if (
    includePhotos &&
    (typeof page.pageimage === "string" || place.photoEntityId)
  ) {
    try {
      let imageName = page.pageimage;
      if (place.photoEntityId) {
        try {
          const entityResponse = await timedFetch(
            fetcher,
            "https://www.wikidata.org/wiki/Special:EntityData/" + place.photoEntityId + ".json",
            {
              headers: {
                "User-Agent": "EggsploreDemo/1.0",
                Accept: "application/json",
              },
            },
            10_000,
          );
          if (!entityResponse.ok) throw new Error("Photo record unavailable");
          const entity = await entityResponse.json();
          const claims = entity.entities?.[place.photoEntityId]?.claims?.P18 ?? [];
          const entityImage = claims.find(
            (claim: {
              rank?: string;
              mainsnak?: { datavalue?: { value?: unknown } };
            }) =>
              claim.rank !== "deprecated" &&
              typeof claim.mainsnak?.datavalue?.value === "string",
          )?.mainsnak?.datavalue?.value;
          if (typeof entityImage === "string" && entityImage)
            imageName = entityImage;
          else if (place.photoEntityRequired)
            throw new Error("No matched photo");
        } catch (error) {
          // The exact article lead is still valid when optional Wikidata is down.
          // Reviewed exceptions must never fall back to a known unrelated image.
          if (place.photoEntityRequired) throw error;
        }
      }
      if (typeof imageName !== "string" || !imageName)
        throw new Error("No matched photo");
      const image = await wiki(
        fetcher,
        {
          prop: "imageinfo",
          titles: `File:${imageName}`,
          iiprop: "url|extmetadata|mime",
          iiurlwidth: "1200",
        },
        place.language,
      );
      const info = image.query?.pages?.[0]?.imageinfo?.[0];
      const metadata = info?.extmetadata;
      const url =
        safeHttps(info?.thumburl, [
          "upload.wikimedia.org",
          "thumb.wikimedia.org",
        ]) || safeHttps(info?.url, ["upload.wikimedia.org"]);
      const imageSource = safeHttps(info?.descriptionurl, [
        "commons.wikimedia.org",
        "en.wikipedia.org",
        "ja.wikipedia.org",
      ]);
      const licenseUrl = safeHttps(metadata?.LicenseUrl?.value);
      const license = plainText(metadata?.LicenseShortName?.value);
      const author = plainText(metadata?.Artist?.value);
      if (
        url &&
        imageSource &&
        licenseUrl &&
        license &&
        author &&
        /^image\/(jpeg|png|webp)$/.test(info?.mime ?? "")
      ) {
        photos.push({
          id: imageName,
          url,
          caption: `${place.name} — Wikimedia photo`,
          author: author.slice(0, 1000),
          license,
          licenseUrl,
          sourceUrl: imageSource,
        });
        photoNotice = null;
      }
    } catch {
      photoNotice = "The photo could not be loaded. Retry to try again.";
    }
  }
  return {
    placeId,
    name: place.name,
    description: plainText(page.extract).slice(0, 3200),
    sourceUrl,
    sourceTitle: page.title,
    sourceLanguage: place.language,
    textLicenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
    photos,
    photoNotice,
    fetchedAt: new Date().toISOString(),
  };
}
// Public, bounded cache: exactly the reviewed catalog places; no user data.
export function createPlaceLoader(fetcher: Fetcher, includePhotos = true) {
  const cache = new Map<PlaceId, { expires: number; value: PlaceDetails }>();
  return async (placeId: PlaceId) => {
    const hit = cache.get(placeId);
    if (hit && hit.expires > Date.now()) return hit.value;
    const value = await fetchPlaceDetails(placeId, fetcher, includePhotos);
    // Missing/failed photos can be retried immediately; don't cache a partial result.
    if (value.photos.length || !includePhotos)
      cache.set(placeId, { value, expires: Date.now() + 15 * 60_000 });
    return value;
  };
}
