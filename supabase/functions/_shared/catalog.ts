// NEW: exact article identities, not hardcoded photo URLs.
// Add reviewed place/article mappings here when the real POI provider is connected.
export const catalog = {
  "sample-osaka-castle": {
    name: "Osaka Castle",
    article: "Osaka Castle",
    language: "en",
    area: "Chuo, Osaka",
  },
  "sample-kuromon-market": {
    name: "Kuromon Market",
    article: "黒門市場",
    language: "ja",
    area: "Nipponbashi, Osaka",
  },
  "sample-nakanoshima-park": {
    name: "Nakanoshima Park",
    article: "Nakanoshima Park",
    photoEntityId: "Q6960289",
    language: "en",
    area: "Kita, Osaka",
  },
} as const;
export type PlaceId = keyof typeof catalog;
export function isPlaceId(value: unknown): value is PlaceId {
  return typeof value === "string" && Object.hasOwn(catalog, value);
}
