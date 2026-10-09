import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import NativeTripMap from "./NativeTripMap";
import type { TripMapProps } from "../types";

// Share the same Leaflet map, tiles, and interaction on Android and iOS,
// including Expo Go and development builds.
export default function TripMap(props: TripMapProps) {
  const [generation, setGeneration] = useState(0);
  useFocusEffect(useCallback(() => {
    setGeneration((value) => value + 1);
  }, []));
  return <NativeTripMap key={generation} {...props} />;
}
