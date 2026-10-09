import type { SamplePlace } from "../types";

// Curated UI fixtures around Osaka. Coordinates are approximate; no live POI lookup.
// IDs are fixture IDs, not Mapbox IDs or Supabase itinerary IDs.
export const samplePlaces: readonly SamplePlace[] = [
  {
    id: "sample-osaka-castle",
    name: "Osaka Castle",
    latitude: 34.6873,
    longitude: 135.5262,
    area: "Chuo, Osaka",
    description:
      "Sample heritage stop for exploring the castle area and its surroundings.",
    tags: ["Heritage", "Outdoors"],
  },
  {
    id: "sample-kuromon-market",
    name: "Kuromon Market",
    latitude: 34.6653,
    longitude: 135.5062,
    area: "Nipponbashi, Osaka",
    description:
      "Sample food stop for browsing the market and planning a meal break.",
    tags: ["Foodie", "Market"],
  },
  {
    id: "sample-nakanoshima-park",
    name: "Nakanoshima Park",
    latitude: 34.6925,
    longitude: 135.5063,
    area: "Kita, Osaka",
    description:
      "Sample park stop for a quieter outdoor break between activities.",
    tags: ["Tranquility", "Outdoors"],
  },
];

export const SAMPLE_REGION = {
  latitude: 34.68,
  longitude: 135.514,
  latitudeDelta: 0.065,
  longitudeDelta: 0.065,
};

export const crowdColors = {
  Packed: "#F04B56",
  Busy: "#F2B332",
  Quiet: "#659C7B",
};

export function sampleCrowd(place: SamplePlace): keyof typeof crowdColors {
  return place.tags.includes("Foodie") ? "Busy" : "Quiet";
}

// CHANGED: static photo URLs removed. The place-details Edge Function fetches
// the selected article and its licensed lead image from Wikimedia.
