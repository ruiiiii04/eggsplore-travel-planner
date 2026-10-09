import { useCallback, useState } from "react";
import { Platform } from "react-native";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { useFocusEffect } from "expo-router";
import NativeTripMap from "./NativeTripMap";
import ExpoGoTripMap from "./ExpoGoTripMap";
import type { TripMapProps } from "../types";

export default function TripMap(props: TripMapProps) {
  const [generation, setGeneration] = useState(0);
  useFocusEffect(
    useCallback(() => {
      setGeneration((value) => value + 1);
    }, []),
  );
  // Expo Go's Android Maps key belongs to Expo and cannot be replaced in app.json.
  const Map = Platform.OS === "android" &&
    Constants.executionEnvironment === ExecutionEnvironment.StoreClient
      ? ExpoGoTripMap
      : NativeTripMap;
  return <Map key={generation} {...props} />;
}
