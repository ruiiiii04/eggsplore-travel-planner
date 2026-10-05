import { Component, type ComponentType, type ReactNode } from "react";
import { isRunningInExpoGo } from "expo";
import MapFallback from "./MapFallback";
import type { TripMapProps } from "../types";

const token = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN?.trim() ?? "";
const inExpoGo = isRunningInExpoGo();
let NativeTripMap: ComponentType<TripMapProps> | undefined;
let loadFailed = false;

// Do NOT statically import NativeTripMap: Mapbox's native module is absent in Expo Go.
// Metro still needs @rnmapbox/maps installed to resolve this dependency at bundle time.
if (!inExpoGo && token.startsWith("pk.")) {
  try {
    NativeTripMap = (
      require("./NativeTripMap") as {
        default: ComponentType<TripMapProps>;
      }
    ).default;
  } catch {
    loadFailed = true;
  }
}

class NativeMapBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export default function TripMap(props: TripMapProps) {
  if (inExpoGo) {
    return (
      <MapFallback
        {...props}
        reason="Expo Go cannot display this native map. Place details are available here; map pins require a custom development build."
      />
    );
  }
  if (!token.startsWith("pk.")) {
    return (
      <MapFallback
        {...props}
        reason="The map is not configured yet. Add the public Mapbox token and restart the app to load map tiles."
      />
    );
  }
  const fallback = (
    <MapFallback
      {...props}
      reason="The native map could not start. Install a fresh development build containing Mapbox, then reopen the app."
    />
  );
  if (loadFailed || !NativeTripMap) return fallback;
  return (
    <NativeMapBoundary fallback={fallback}>
      <NativeTripMap {...props} />
    </NativeMapBoundary>
  );
}
