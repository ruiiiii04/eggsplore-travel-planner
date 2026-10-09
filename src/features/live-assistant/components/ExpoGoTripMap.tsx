import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Linking, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { WebView } from "react-native-webview";
import { RotateCcw } from "lucide-react-native";
import { colors } from "@/styles/theme";
import { mapDocument, mapUpdateScript } from "../services/mapDocument";
import type { TripMapProps } from "../types";

const source = { html: mapDocument, baseUrl: "https://localhost/eggsplore-map/" };

export default function ExpoGoTripMap(props: TripMapProps) {
  const web = useRef<WebView>(null);
  const [ready, setReady] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const update = mapUpdateScript(props);
  useEffect(() => {
    if (ready) web.current?.injectJavaScript(update);
  }, [ready, update]);
  useEffect(() => {
    if (loaded) return;
    const timer = setTimeout(() => setError(true), 25_000);
    return () => clearTimeout(timer);
  }, [loaded, attempt]);
  const retry = () => {
    setReady(false);
    setLoaded(false);
    setError(false);
    setAttempt((value) => value + 1);
  };
  return (
    <View style={styles.container}>
      <WebView
        key={attempt}
        ref={web}
        source={source}
        style={styles.map}
        originWhitelist={["*"]}
        javaScriptEnabled
        domStorageEnabled
        cacheEnabled
        applicationNameForUserAgent="Eggsplore/1.0"
        mixedContentMode="never"
        setSupportMultipleWindows={false}
        onShouldStartLoadWithRequest={({ url }) => {
          if (url === "about:blank" || url.startsWith(source.baseUrl)) return true;
          if (url === "https://www.openstreetmap.org/copyright")
            void Linking.openURL(url).catch(() => {});
          return false;
        }}
        onMessage={({ nativeEvent }) => {
          try {
            const message = JSON.parse(nativeEvent.data);
            if (message.type === "ready") setReady(true);
            else if (message.type === "tiles") {
              setLoaded(true);
              setError(false);
            } else if (message.type === "coordinate" && typeof message.latitude === "number" &&
                Number.isFinite(message.latitude) && Math.abs(message.latitude) <= 90 &&
                typeof message.longitude === "number" && Number.isFinite(message.longitude)) {
              props.onSelectCoordinate?.({ latitude: message.latitude, longitude: ((message.longitude + 180) % 360 + 360) % 360 - 180 });
            } else if (message.type === "error") setError(true);
            else if (message.type === "select" && typeof message.id === "string") {
              const place = props.places.find((item) => item.id === message.id);
              if (place) props.onSelectPlace(place);
            }
          } catch {
            // Ignore malformed messages; only current place IDs can select a stop.
          }
        }}
        onError={() => setError(true)}
        onHttpError={() => setError(true)}
        onRenderProcessGone={retry}
      />
      {!loaded && !error && (
        <View pointerEvents="none" style={styles.loading}>
          <ActivityIndicator color={colors.brand} />
          <Text style={styles.text}>Loading map...</Text>
        </View>
      )}
      {error && (
        <View style={styles.notice}>
          <Text accessibilityRole="alert" style={styles.text}>
            The map could not load. Check your connection, then retry.
          </Text>
          <TouchableOpacity accessibilityRole="button" onPress={retry} style={styles.retry}>
            <RotateCcw size={18} color={colors.brand} />
            <Text style={styles.buttonText}>Retry map</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.lavender },
  map: { flex: 1, backgroundColor: colors.lavender },
  text: { color: colors.ink, fontSize: 14, lineHeight: 21, flexShrink: 1 },
  loading: {
    position: "absolute", top: "42%", alignSelf: "center",
    backgroundColor: colors.white, borderRadius: 14, padding: 16,
    gap: 10, flexDirection: "row", alignItems: "center",
  },
  notice: {
    position: "absolute", top: 88, left: 16, right: 16, padding: 16,
    gap: 8, borderRadius: 16, backgroundColor: colors.white,
    borderWidth: 1, borderColor: colors.border,
  },
  retry: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 8 },
  buttonText: { color: colors.brand, fontSize: 14, fontWeight: "600" },
});
