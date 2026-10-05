import { useEffect, useMemo, useRef, useState } from "react";
import {
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Bell,
  Check,
  ChevronDown,
  Landmark,
  Layers,
  Leaf,
  MapPin,
  Navigation,
  Sparkles,
  Sun,
  Utensils,
} from "lucide-react-native";

import { BottomSheet } from "@/components/ui/BottomSheet";
import TripMap from "./components/TripMap";
import PlaceDetailsSheet from "./components/PlaceDetailsSheet";
import { samplePlaces, crowdColors } from "./data/samplePlaces";

const vibes = [
  { name: "All Vibes", icon: Sparkles },
  { name: "Foodie", icon: Utensils },
  { name: "Tranquility", icon: Leaf },
  { name: "Heritage", icon: Landmark },
];

// CHANGED: dropdown options.
// Replace with the signed-in user's trips when that integration is ready.
const demoTrips = [
  {
    id: "osaka-highlights",
    name: "Osaka Highlights",
    subtitle: "Demo trip · 2 stops",
    placeIds: [
      "sample-osaka-castle",
      "sample-nakanoshima-park",
    ],
  },
  {
    id: "osaka-food-and-culture",
    name: "Osaka Food & Culture",
    subtitle: "Demo trip · 2 stops",
    placeIds: [
      "sample-kuromon-market",
      "sample-osaka-castle",
    ],
  },
];

export default function MapScreen() {
  const { height, fontScale } = useWindowDimensions();

  const [mode, setMode] = useState<"My Trip" | "Explore">("My Trip");
  const [vibe, setVibe] = useState("All Vibes");
  const [selectedId, setSelectedId] = useState(samplePlaces[0].id);
  const [expanded, setExpanded] = useState(true);
  const [muted, setMuted] = useState(true);
  const [reset, setReset] = useState(0);

  // NEW: trip dropdown state.
  const [tripMenuOpen, setTripMenuOpen] = useState(false);
  const [activeTripId, setActiveTripId] = useState(demoTrips[0].id);

  const [notice, setNotice] = useState<{
    title: string;
    text: string;
  } | null>(null);

  const activeTrip =
    demoTrips.find((trip) => trip.id === activeTripId) ?? demoTrips[0];

  // NEW: draggable panel state.
  const collapsedHeight = 80 + Math.max(0, fontScale - 1) * 24;
  const expandedHeight = Math.max(
    collapsedHeight,
    Math.min(height * 0.43, 410),
  );

  const [sheetHeight, setSheetHeight] = useState(expandedHeight);
  const currentHeight = useRef(expandedHeight);
  const dragStartHeight = useRef(expandedHeight);

  useEffect(() => {
    const nextHeight = expanded ? expandedHeight : collapsedHeight;

    currentHeight.current = nextHeight;
    setSheetHeight(nextHeight);
  }, [expanded, expandedHeight, collapsedHeight]);

  // NEW: handle dragging, with expanded and collapsed snap positions.
  const sheetPanResponder = useMemo(() => {
    const clampHeight = (value: number) =>
      Math.max(collapsedHeight, Math.min(expandedHeight, value));

    const finishDrag = (dy: number, velocity: number) => {
      const draggedHeight = clampHeight(dragStartHeight.current - dy);
      const midpoint = (collapsedHeight + expandedHeight) / 2;

      const shouldExpand =
        velocity < -0.5
          ? true
          : velocity > 0.5
            ? false
            : draggedHeight >= midpoint;

      const nextHeight = shouldExpand
        ? expandedHeight
        : collapsedHeight;

      currentHeight.current = nextHeight;
      setSheetHeight(nextHeight);
      setExpanded(shouldExpand);
    };

    return PanResponder.create({
      onStartShouldSetPanResponder: () => false,

      onMoveShouldSetPanResponderCapture: (_, gesture) =>
        Math.abs(gesture.dy) > 6 &&
        Math.abs(gesture.dy) > Math.abs(gesture.dx),

      onPanResponderGrant: () => {
        dragStartHeight.current = currentHeight.current;
      },

      onPanResponderMove: (_, gesture) => {
        const nextHeight = clampHeight(
          dragStartHeight.current - gesture.dy,
        );

        currentHeight.current = nextHeight;
        setSheetHeight(nextHeight);
      },

      onPanResponderRelease: (_, gesture) => {
        finishDrag(gesture.dy, gesture.vy);
      },

      onPanResponderTerminate: (_, gesture) => {
        finishDrag(gesture.dy, 0);
      },
    });
  }, [collapsedHeight, expandedHeight]);

  // CHANGED: My Trip shows the selected trip's stops.
  const source =
    mode === "My Trip"
      ? samplePlaces.filter((place) =>
          activeTrip.placeIds.includes(place.id),
        )
      : samplePlaces;

  const visible = source.filter(
    (place) => vibe === "All Vibes" || place.tags.includes(vibe),
  );

  const selected =
    visible.find((place) => place.id === selectedId) ?? visible[0];

  const showNotice = (title: string, text: string) => {
    setNotice({ title, text });
  };

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={s.screen}>
      <View style={s.top}>
        {/* CHANGED: opens the trip dropdown. */}
        <TouchableOpacity
          style={s.trip}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={`Choose trip. Current trip: ${activeTrip.name}`}
          accessibilityState={{ expanded: tripMenuOpen }}
          onPress={() => setTripMenuOpen((value) => !value)}
        >
          <MapPin size={18} color="#7E49C2" />

          <Text style={s.tripText} numberOfLines={1}>
            {activeTrip.name}
          </Text>

          <ChevronDown
            size={18}
            color="#61368B"
            style={{
              transform: [
                { rotate: tripMenuOpen ? "180deg" : "0deg" },
              ],
            }}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={s.bell}
          accessibilityRole="button"
          accessibilityLabel="Trip alerts"
          onPress={() => {
            setTripMenuOpen(false);
            showNotice(
              "Trip alerts",
              "Weather and flight alerts are not connected yet. The weather card and activity colours are sample UI data.",
            );
          }}
        >
          <Bell size={24} color="#61368B" />
          <View style={s.dot} />
        </TouchableOpacity>
      </View>

      {/* NEW: selectable demo trips. */}
      {tripMenuOpen && (
        <View style={s.tripMenu}>
          <Text style={s.tripMenuHeading}>Choose a trip</Text>

          {demoTrips.map((trip) => {
            const active = trip.id === activeTripId;

            return (
              <TouchableOpacity
                key={trip.id}
                style={[
                  s.tripOption,
                  active && s.tripOptionActive,
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => {
                  setActiveTripId(trip.id);
                  setSelectedId(trip.placeIds[0]);
                  setMode("My Trip");
                  setVibe("All Vibes");
                  setExpanded(true);
                  setReset((value) => value + 1);
                  setTripMenuOpen(false);
                }}
              >
                <View style={s.tripOptionLabels}>
                  <Text style={s.tripOptionTitle}>{trip.name}</Text>
                  <Text style={s.tripOptionSubtitle}>
                    {trip.subtitle}
                  </Text>
                </View>

                {active && <Check size={20} color="#7E49C2" />}
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.vibeScroll}
        contentContainerStyle={s.vibes}
      >
        {vibes.map(({ name, icon: Icon }) => {
          const active = vibe === name;
          const count = source.filter((place) =>
            place.tags.includes(name),
          ).length;

          return (
            <TouchableOpacity
              key={name}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              activeOpacity={0.8}
              onPress={() => {
                setVibe(name);
                setExpanded(true);
                setTripMenuOpen(false);
              }}
              style={[s.chip, active && s.chipActive]}
            >
              <Icon size={18} color={active ? "white" : "#A559C1"} />

              <Text style={[s.chipText, active && s.white]}>
                {name}
                {name !== "All Vibes" ? ` · ${count}` : ""}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={s.mapArea}>
        <TripMap
          places={visible}
          selectedPlaceId={selected?.id ?? null}
          onSelectPlace={(place) => {
            setSelectedId(place.id);
            setExpanded(true);
            setTripMenuOpen(false);
          }}
          routePlaces={mode === "My Trip" ? visible : []}
          resetSignal={reset}
          mutedMap={muted}
        />

        <View pointerEvents="box-none" style={s.mapTop}>
          <View style={s.segment}>
            {(["My Trip", "Explore"] as const).map((item) => (
              <TouchableOpacity
                key={item}
                accessibilityRole="button"
                accessibilityState={{ selected: mode === item }}
                activeOpacity={0.8}
                onPress={() => {
                  setMode(item);
                  setExpanded(true);
                  setTripMenuOpen(false);
                }}
                style={[
                  s.segmentButton,
                  mode === item && s.segmentActive,
                ]}
              >
                <Text
                  style={[s.segmentText, mode === item && s.white]}
                >
                  {item}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Demo weather, 29 degrees, partly cloudy"
            style={s.weather}
            onPress={() =>
              showNotice(
                "Demo weather",
                "29°C and partly cloudy are layout placeholders. Live weather is coming soon.",
              )
            }
          >
            <Sun size={26} color="#FFB300" />
            <View>
              <Text style={s.temperature}>29°C</Text>
              <Text style={s.weatherSmall}>Partly cloudy</Text>
              <Text style={s.demo}>DEMO</Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={s.mapButtons}>
          <TouchableOpacity
            style={s.round}
            accessibilityRole="button"
            accessibilityLabel="Recenter on Osaka"
            onPress={() => setReset((value) => value + 1)}
          >
            <Navigation size={25} color="#7745AD" />
          </TouchableOpacity>

          <TouchableOpacity
            style={s.round}
            accessibilityRole="button"
            accessibilityLabel="Toggle muted map style"
            accessibilityState={{ selected: muted }}
            onPress={() => setMuted((value) => !value)}
          >
            <Layers size={25} color="#7745AD" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={s.legend}
          accessibilityRole="button"
          onPress={() =>
            showNotice(
              "Demo map legend",
              "Activity colours are illustrative, not live crowd measurements. The dashed purple line connects sample stops; it is not a calculated walking route.",
            )
          }
        >
          <Text style={s.demo}>DEMO</Text>

          {Object.entries(crowdColors).map(([label, color]) => (
            <View key={label} style={s.legendItem}>
              <MapPin size={15} color={color} fill={color} />
              <Text style={s.legendText}>{label}</Text>
            </View>
          ))}
        </TouchableOpacity>
      </View>

      {selected ? (
        // CHANGED: panel height follows the user's drag.
        <View style={{ height: sheetHeight, flexShrink: 0 }}>
          <PlaceDetailsSheet
            key={selected.id}
            place={selected}
            expanded={expanded}
            onToggle={() => setExpanded((value) => !value)}
            dragHandlers={sheetPanResponder.panHandlers}
            onSelectPlace={(place) => {
              setSelectedId(place.id);
              setMode("Explore");
              setVibe("All Vibes");
              setExpanded(true);
              setTripMenuOpen(false);
            }}
            onAdd={() =>
              showNotice(
                "Add to itinerary",
                `${selected.name} is selected. Saving stops to your itinerary is coming soon. Nothing has been saved yet.`,
              )
            }
          />
        </View>
      ) : (
        <View style={s.empty}>
          <Text style={s.emptyText}>
            No {vibe.toLowerCase()} stops in this view.
          </Text>

          <TouchableOpacity
            onPress={() => {
              setMode("Explore");
              setVibe("All Vibes");
              setExpanded(true);
            }}
          >
            <Text style={s.link}>Explore all sample places</Text>
          </TouchableOpacity>
        </View>
      )}

      <BottomSheet
        visible={notice !== null}
        title={notice?.title ?? ""}
        onClose={() => setNotice(null)}
      >
        <Text style={s.noticeText}>{notice?.text}</Text>
      </BottomSheet>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#FAF7FF" },
  top: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
  },
  trip: {
    flex: 1,
    minHeight: 40,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#D7BDED",
    backgroundColor: "#F2EAFB",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
  },
  tripText: {
    flex: 1,
    color: "#4E2867",
    fontSize: 16,
    fontWeight: "700",
  },
  bell: {
    width: 40,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  dot: {
    position: "absolute",
    top: 9,
    right: 8,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#EE4B6A",
  },

  // NEW: trip dropdown styles.
  tripMenu: {
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#DDCAED",
    backgroundColor: "white",
  },
  tripMenuHeading: {
    color: "#817493",
    fontSize: 12,
    fontWeight: "600",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  tripOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 12,
  },
  tripOptionActive: { backgroundColor: "#F2EAFB" },
  tripOptionLabels: { flex: 1, gap: 3 },
  tripOptionTitle: {
    color: "#4E2867",
    fontSize: 14,
    fontWeight: "600",
  },
  tripOptionSubtitle: { color: "#817493", fontSize: 11 },

  vibeScroll: { flexGrow: 0, flexShrink: 0 },
  vibes: { paddingHorizontal: 16, paddingBottom: 12, gap: 8 },
  chip: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderWidth: 1,
    borderColor: "#D7BDED",
    borderRadius: 24,
    paddingHorizontal: 13,
    backgroundColor: "white",
  },
  chipActive: {
    backgroundColor: "#6818AD",
    borderColor: "#6818AD",
  },
  chipText: { color: "#4E2867", fontSize: 14, fontWeight: "600" },
  white: { color: "white" },
  mapArea: {
    flex: 1,
    minHeight: 130,
    backgroundColor: "#F2EAFB",
  },
  mapTop: {
    position: "absolute",
    top: 12,
    left: 12,
    right: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 6,
    flexWrap: "wrap",
  },
  segment: {
    flexDirection: "row",
    borderRadius: 24,
    padding: 3,
    backgroundColor: "white",
    elevation: 2,
    shadowColor: "#44215E",
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  segmentButton: {
    paddingHorizontal: 14,
    minHeight: 34,
    borderRadius: 22,
    justifyContent: "center",
  },
  segmentActive: { backgroundColor: "#8550BE" },
  segmentText: {
    color: "#58317A",
    fontWeight: "600",
    fontSize: 13,
  },
  weather: {
    backgroundColor: "white",
    borderRadius: 18,
    padding: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  temperature: {
    fontSize: 13,
    fontWeight: "700",
    color: "#58317A",
  },
  weatherSmall: { fontSize: 9, color: "#817493" },
  demo: {
    fontSize: 8,
    letterSpacing: 0.8,
    color: "#817493",
    fontWeight: "700",
  },
  mapButtons: {
    position: "absolute",
    bottom: 14,
    right: 12,
    gap: 9,
  },
  round: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "white",
    alignItems: "center",
    justifyContent: "center",
    elevation: 2,
    shadowColor: "#4E2867",
    shadowOpacity: 0.12,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  },
  legend: {
    position: "absolute",
    bottom: 16,
    left: 12,
    right: 70,
    backgroundColor: "white",
    borderRadius: 24,
    paddingHorizontal: 9,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 4,
    flexWrap: "wrap",
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  legendText: { fontSize: 10, color: "#74617F" },
  empty: { padding: 22, gap: 10 },
  emptyText: { color: "#4E2867" },
  link: {
    color: "#7E49C2",
    fontWeight: "700",
    paddingVertical: 8,
  },
  noticeText: { color: "#4E2867", fontSize: 15, lineHeight: 23 },
});