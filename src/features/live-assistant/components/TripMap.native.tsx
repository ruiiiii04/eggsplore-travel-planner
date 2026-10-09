import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import NativeTripMap from "./NativeTripMap";
import type { TripMapProps } from "../types";

export default function TripMap(props: TripMapProps) {
  const [generation, setGeneration] = useState(0);
  useFocusEffect(
    useCallback(() => {
      // Recreate the Android map surface after returning to this tab.
      setGeneration((value) => value + 1);
    }, []),
  );
  return <NativeTripMap key={generation} {...props} />;
}
