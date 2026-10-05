import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Mapbox from "@rnmapbox/maps";
import { List, MapPin, RotateCcw } from "lucide-react-native";
import { colors } from "@/styles/theme";
import { SAMPLE_CENTER } from "../data/samplePlaces";
import type { TripMapProps } from "../types";
import PlaceList from "./PlaceList";

export default function NativeTripMap(props: TripMapProps) {
  const camera = useRef<Mapbox.Camera>(null);
  const [ready, setReady] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [listOpen, setListOpen] = useState(false);

  useEffect(() => {
    let active = true;
    setReady(false);
    setLoaded(false);
    setFailed(false);
    Promise.resolve(
      Mapbox.setAccessToken(
        process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN?.trim() ?? "",
      ),
    )
      .then(() => {
        if (active) setReady(true);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [attempt]);

  useEffect(() => {
    if (!ready || loaded) return;
    const timeout = setTimeout(() => setFailed(true), 20000);
    return () => clearTimeout(timeout);
  }, [ready, loaded, attempt]);

  const showError = failed && !loaded;
  const resetCamera = () =>
    camera.current?.setCamera({
      centerCoordinate: SAMPLE_CENTER,
      zoomLevel: 12,
      animationDuration: 500,
    });

  return (
    <View style={styles.container}>
      {ready && (
        <Mapbox.MapView
          key={attempt}
          style={styles.map}
          styleURL={Mapbox.StyleURL.Street}
          logoEnabled
          attributionEnabled
          scaleBarEnabled={false}
          onDidFinishLoadingMap={() => {
            setLoaded(true);
            setFailed(false);
          }}
          onMapLoadingError={() => {
            setLoaded(false);
            setFailed(true);
          }}
        >
          <Mapbox.Camera
            ref={camera}
            defaultSettings={{ centerCoordinate: SAMPLE_CENTER, zoomLevel: 12 }}
          />
          {props.places.map((place) => (
            <Mapbox.MarkerView
              key={place.id}
              coordinate={[place.longitude, place.latitude]}
              anchor={{ x: 0.5, y: 1 }}
              allowOverlap
            >
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={`View ${place.name}`}
                accessibilityState={{
                  selected: props.selectedPlaceId === place.id,
                }}
                onPress={() => props.onSelectPlace(place)}
                activeOpacity={0.75}
                style={[
                  styles.pin,
                  props.selectedPlaceId === place.id && styles.selectedPin,
                ]}
              >
                <MapPin size={26} color={colors.white} />
              </TouchableOpacity>
            </Mapbox.MarkerView>
          ))}
        </Mapbox.MapView>
      )}
      {!loaded && !showError && (
        <View pointerEvents="none" style={styles.loading}>
          <ActivityIndicator color={colors.brand} />
          <Text style={styles.text}>Loading map…</Text>
        </View>
      )}
      {showError && (
        <View style={styles.error}>
          <Text accessibilityRole="alert" style={styles.text}>
            Map tiles could not load. Check your connection and Mapbox token.
            You can still explore the sample places.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => setAttempt((value) => value + 1)}
            style={styles.retry}
          >
            <RotateCcw size={18} color={colors.brand} />
            <Text style={styles.buttonText}>Retry map</Text>
          </Pressable>
        </View>
      )}
      <View style={styles.toolbar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Toggle sample places"
          accessibilityState={{ expanded: listOpen }}
          onPress={() => setListOpen((value) => !value)}
          style={styles.tool}
        >
          <List size={20} color={colors.brand} />
          <Text style={styles.buttonText}>Places</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Reset map to Osaka"
          onPress={resetCamera}
          disabled={!ready}
          style={styles.tool}
        >
          <RotateCcw size={20} color={colors.brand} />
          <Text style={styles.buttonText}>Reset</Text>
        </Pressable>
      </View>
      {listOpen && (
        <View style={styles.placePanel}>
          <ScrollView contentContainerStyle={{ padding: 12 }}>
            <PlaceList
              {...props}
              onSelectPlace={(place) => {
                setListOpen(false);
                props.onSelectPlace(place);
              }}
            />
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.lavender },
  map: { flex: 1 },
  pin: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.brand,
    borderWidth: 3,
    borderColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  selectedPin: { backgroundColor: colors.ink },
  toolbar: {
    position: "absolute",
    top: 14,
    right: 14,
    flexDirection: "row",
    gap: 8,
  },
  tool: {
    minHeight: 46,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: colors.white,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  buttonText: { color: colors.brand, fontSize: 14, fontWeight: "600" },
  text: { color: colors.ink, fontSize: 14, lineHeight: 21 },
  loading: {
    position: "absolute",
    top: "42%",
    alignSelf: "center",
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: 16,
    gap: 10,
    flexDirection: "row",
    alignItems: "center",
  },
  error: {
    position: "absolute",
    top: 76,
    left: 16,
    right: 16,
    padding: 16,
    gap: 12,
    borderRadius: 16,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  placePanel: {
    position: "absolute",
    top: 70,
    left: 16,
    right: 16,
    maxHeight: "65%",
    borderRadius: 16,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  retry: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 8 },
});
