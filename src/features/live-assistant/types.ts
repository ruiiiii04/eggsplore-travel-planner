/** Proposed shared contract: agree IDs and fields with Modules B/D before DB integration. */
export type PlaceRef = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
};

export type SamplePlace = PlaceRef & {
  description: string;
  area: string;
  tags: readonly string[];
};

export type TripMapProps = {
  places: readonly SamplePlace[];
  selectedPlaceId: string | null;
  onSelectPlace: (place: SamplePlace) => void;
};