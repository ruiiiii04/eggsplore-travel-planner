import MapFallback from "./MapFallback";
import type { TripMapProps } from "../types";

// Web/default implementation. Metro selects TripMap.native.tsx on Android/iOS.
export default function TripMap(props: TripMapProps) {
  return (
    <MapFallback
      {...props}
      reason="The interactive map is available in the Android/iOS development build. This browser preview shows sample places."
    />
  );
}
