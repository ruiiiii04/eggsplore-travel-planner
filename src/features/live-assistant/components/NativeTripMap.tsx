import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import Svg, { Path } from "react-native-svg";
import { MapPin, RotateCcw, Utensils } from "lucide-react-native";

import { colors } from "@/styles/theme";
import type { TripMapProps } from "../types";

const pastelMapStyle = [
  {
    elementType: "geometry",
    stylers: [{ color: "#F2E9F3" }],
  },
  {
    elementType: "labels.text.fill",
    stylers: [{ color: "#795591" }],
  },
  {
    elementType: "labels.text.stroke",
    stylers: [{ color: "#FAF6FC" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#C4CEF3" }],
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#FFFAFF" }],
  },
  {
    featureType: "poi.park",
    elementType: "geometry",
    stylers: [{ color: "#DCE6D1" }],
  },
];

export default function NativeTripMap({
  places,
  selectedPlaceId,
  onSelectPlace,
  routePlaces = [],
  resetSignal = 0,
  mutedMap = true,
  center,
}: TripMapProps) {
  const map = useRef<MapView>(null);

  const [laidOut, setLaidOut] = useState(false);
  const pointKey = places
    .map((p) => `${p.id}:${p.latitude}:${p.longitude}`)
    .join("|");
  const mapPoints = useMemo(
    () => places.map((p) => ({ latitude: p.latitude, longitude: p.longitude })),
    [pointKey],
  );
  const [ready, setReady] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (loaded) return;

    const timeout = setTimeout(() => {
      setTimedOut(true);
    }, 20000);

    return () => clearTimeout(timeout);
  }, [loaded, attempt]);

  useEffect(() => {
    if (!ready || !laidOut) return;
    if (mapPoints.length === 1) {
      map.current?.animateToRegion(
        { ...mapPoints[0], latitudeDelta: 0.025, longitudeDelta: 0.025 },
        500,
      );
    } else if (mapPoints.length > 1) {
      map.current?.fitToCoordinates(mapPoints, {
        edgePadding: { top: 100, right: 65, bottom: 85, left: 45 },
        animated: true,
      });
    } else {
      map.current?.animateToRegion(
        {
          latitude: center?.latitude ?? 15,
          longitude: center?.longitude ?? 105,
          latitudeDelta: center ? 0.12 : 100,
          longitudeDelta: center ? 0.12 : 100,
        },
        500,
      );
    }
  }, [
    resetSignal,
    ready,
    laidOut,
    mapPoints,
    center?.latitude,
    center?.longitude,
  ]);

  const retry = () => {
    setReady(false);
    setLoaded(false);
    setLaidOut(false);
    setTimedOut(false);
    setAttempt((value) => value + 1);
  };

  return (
    <View style={styles.container}>
      {/* Default provider: Apple Maps on iOS, Google Maps on Android. */}
      <MapView
        key={attempt}
        ref={map}
        provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
        style={StyleSheet.absoluteFill}
        initialRegion={
          mapPoints[0]
            ? { ...mapPoints[0], latitudeDelta: 0.05, longitudeDelta: 0.05 }
            : {
                latitude: center?.latitude ?? 15,
                longitude: center?.longitude ?? 105,
                latitudeDelta: center ? 0.12 : 100,
                longitudeDelta: center ? 0.12 : 100,
              }
        }
        onLayout={() => setLaidOut(true)}
        mapType={
          Platform.OS === "ios" && mutedMap ? "mutedStandard" : "standard"
        }
        customMapStyle={
          Platform.OS === "android" && mutedMap ? pastelMapStyle : undefined
        }
        onMapReady={() => {
          setReady(true);
          // Apple Maps does not reliably emit the Google tile-loaded event.
          // Readiness ends its startup indicator; it is not proof of tile delivery.
          if (Platform.OS === "ios") {
            setLoaded(true);
            setTimedOut(false);
          }
        }}
        onMapLoaded={() => {
          setReady(true);
          setLoaded(true);
          setTimedOut(false);
        }}
        showsUserLocation={false}
        showsMyLocationButton={false}
        toolbarEnabled={false}
      >
        {/* Sample stop connection, not calculated walking directions. */}
        {routePlaces.length > 1 && (
          <Polyline
            coordinates={routePlaces.map((place) => ({
              latitude: place.latitude,
              longitude: place.longitude,
            }))}
            strokeColor="#8653AF"
            strokeWidth={4}
            lineDashPattern={[10, 5]}
          />
        )}

        {places.map((place) => {
          const selected = selectedPlaceId === place.id;
          const markerColor = "#9365BC";
          const isFoodPlace =
            place.tags.includes("Foodie") || place.tags.includes("Food");

          return (
            <Marker
              key={place.id}
              identifier={place.id}
              coordinate={{
                latitude: place.latitude,
                longitude: place.longitude,
              }}
              // CHANGED: anchor the SVG's pointed tip to the location.
              anchor={{ x: 0.5, y: 54 / 58 }}
              accessibilityLabel={`View ${place.name}`}
              onPress={() => onSelectPlace(place)}
              zIndex={selected ? 10 : 1}
              tracksViewChanges
            >
              {/* CHANGED: one shape, with an outline around the entire pin. */}
              <View collapsable={false} style={styles.marker}>
                <Svg width={48} height={58} viewBox="0 0 48 58">
                  <Path
                    d="
                      M 24 3
                      C 12.4 3 4 11.6 4 22
                      C 4 35 17 47 24 54
                      C 31 47 44 35 44 22
                      C 44 11.6 35.6 3 24 3
                      Z
                    "
                    fill={markerColor}
                    stroke={selected ? "#683A94" : "#FFFFFF"}
                    strokeWidth={3}
                    strokeLinejoin="round"
                  />
                </Svg>

                <View pointerEvents="none" style={styles.markerIcon}>
                  {isFoodPlace ? (
                    <Utensils size={20} color={colors.white} />
                  ) : (
                    <MapPin size={22} color={colors.white} />
                  )}
                </View>
              </View>
            </Marker>
          );
        })}
      </MapView>

      {!loaded && !timedOut && (
        <View pointerEvents="none" style={styles.loading}>
          <ActivityIndicator color={colors.brand} />
          <Text style={styles.text}>Starting map…</Text>
        </View>
      )}

      {timedOut && !loaded && (
        <View style={styles.notice}>
          <Text accessibilityRole="alert" style={styles.text}>
            Map tiles have not loaded. Check your connection and Google Play
            services, then retry the map.
          </Text>

          <TouchableOpacity
            accessibilityRole="button"
            onPress={retry}
            activeOpacity={0.75}
            style={styles.retry}
          >
            <RotateCcw size={18} color={colors.brand} />
            <Text style={styles.buttonText}>Retry map</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F2EAFB",
  },

  // CHANGED: fixed SVG dimensions replace the circle/triangle styles.
  marker: {
    width: 48,
    height: 58,
  },
  markerIcon: {
    position: "absolute",
    top: 11,
    left: 0,
    width: 48,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },

  buttonText: {
    color: colors.brand,
    fontSize: 14,
    fontWeight: "600",
  },
  text: {
    color: colors.ink,
    fontSize: 14,
    lineHeight: 21,
    flexShrink: 1,
  },
  loading: {
    position: "absolute",
    top: "42%",
    alignSelf: "center",
    maxWidth: "85%",
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: 16,
    gap: 10,
    flexDirection: "row",
    alignItems: "center",
  },
  notice: {
    position: "absolute",
    top: 88,
    left: 16,
    right: 16,
    padding: 16,
    gap: 8,
    borderRadius: 16,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  retry: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
});
