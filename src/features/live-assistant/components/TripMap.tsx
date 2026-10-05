import { View } from "react-native";
import MapFallback from "./MapFallback";
import type { TripMapProps } from "../types";

export default function TripMap(props: TripMapProps) {
  return (
    <View style={{ flex: 1, paddingTop: 88, paddingBottom: 60 }}>
      <MapFallback
        {...props}
        reason="Browser preview. Open the app on your phone for the interactive map."
      />
    </View>
  );
}
