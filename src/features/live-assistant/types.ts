/** Shared map presentation contract for sample and saved itinerary places. */
export type PlaceRef = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
};

export type SamplePlace = PlaceRef & {
  tripId?: string;
  vibeSource?: string;
  position?: number;
  coordinateSource?: "saved" | "wikipedia";
  description: string;
  area: string;
  tags: readonly string[];
};

export type TripMapProps = {
  places: readonly SamplePlace[];
  selectedPlaceId: string | null;
  onSelectPlace: (place: SamplePlace) => void;
  routePlaces?: readonly SamplePlace[];
  resetSignal?: number;
  mutedMap?: boolean;
  center?: { latitude: number; longitude: number } | null;
  onSelectCoordinate?: (point: { latitude: number; longitude: number }) => void;
};
// NEW: online details and chat contracts. These do not represent live business data.
export type PlacePhoto = {
  id: string;
  url: string;
  caption: string;
  author: string;
  license: string;
  licenseUrl: string;
  sourceUrl: string;
};
export type OnlinePlaceDetails = {
  placeId: string;
  name: string;
  description: string;
  sourceUrl: string;
  sourceTitle: string;
  sourceLanguage: "en" | "ja";
  textLicenseUrl: string;
  photos: PlacePhoto[];
  photoNotice: string | null;
  fetchedAt: string;
};
export type ChatMessage = { role: "user" | "assistant"; text: string };
export type AssistantReply = {
  answer: string;
  followUps?: string[];
  truncated: boolean;
  referenceAvailable: boolean;
  sources: { title: string; url: string }[];
};

// NEW: saved itinerary identities are used for details and server-side authorization.
export type UnmappedPlace = {
  id: string;
  tripId: string;
  name: string;
  area: string;
  description: string;
  tags: string[];
  position: number;
  reason: string;
};
export type TripMapPage = {
  tripId: string;
  places: SamplePlace[];
  unresolved: UnmappedPlace[];
  nextOffset: number | null;
};
