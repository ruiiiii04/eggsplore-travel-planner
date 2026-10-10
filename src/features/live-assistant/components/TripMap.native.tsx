import { useCallback, useState } from "react";
import { Platform } from "react-native";
import { useFocusEffect } from "expo-router";
import NativeTripMap from "./NativeTripMap";
import ExpoGoTripMap from "./ExpoGoTripMap";
import type { TripMapProps } from "../types";

// OpenStreetMap on Android; native Apple Maps on iOS.
export default function TripMap(props: TripMapProps) {
  const [generation, setGeneration] = useState(0);
  useFocusEffect(useCallback(() => {
    setGeneration((value) => value + 1);
  }, []));
  const Map = Platform.OS === "android" ? ExpoGoTripMap : NativeTripMap;
  return <Map key={generation} {...props} />;
}
