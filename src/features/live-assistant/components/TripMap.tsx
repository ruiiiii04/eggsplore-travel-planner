import LocationPinPicker from "../../trips/location/LocationPinPicker";
import type { TripMapProps } from "../types";

// The browser iframe uses the same Leaflet document as the mobile WebView.
export default function TripMap(props: TripMapProps) {
  return <LocationPinPicker {...props} />;
}
