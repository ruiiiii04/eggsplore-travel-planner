import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useAuth } from "@/features/auth/useAuth";
import { useTrips } from "@/features/trips/useTrips";
import { getRecentTripId, rememberTrip } from "@/features/trips/recentTrip";
import { tripStatus } from "@/features/trips/model";
import { useTripPlaces } from "./hooks/useTripPlaces";
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
import { useExplorePlaces } from "./hooks/useExplorePlaces";

// CHANGED: remount user-scoped map state after an account change.
export default function MapScreen() {
  const { user } = useAuth();
  return <TripMapScreen key={user?.id ?? "signed-out"} />;
}
function TripMapScreen() {
  const { user } = useAuth();
  const { height, fontScale } = useWindowDimensions();

  const [mode, setMode] = useState<"My Trip" | "Explore">("My Trip");
  const [vibe, setVibe] = useState("All");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);
  const [muted, setMuted] = useState(true);
  const [reset, setReset] = useState(0);

  // NEW: trip dropdown state.
  const [tripMenuOpen, setTripMenuOpen] = useState(false);
  const [activeTripId, setActiveTripId] = useState<string | null>(null);

  const [notice, setNotice] = useState<{
    title: string;
    text: string;
  } | null>(null);

  // CHANGED: same RLS-backed trip list and recent-trip preference as Trips.
  const {
    trips,
    loading: tripsLoading,
    error: tripsError,
    refresh,
  } = useTrips();
  const [recentId, setRecentId] = useState<string | null>(null);
  const [missingOpen, setMissingOpen] = useState(false);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      void getRecentTripId()
        .then((id) => {
          if (active) {
            setRecentId(id);
            setActiveTripId(null);
          }
        })
        .catch(() => {});
      return () => {
        active = false;
      };
    }, []),
  );
  const activeTrip =
    trips.find((trip) => trip.id === activeTripId) ??
    trips.find((trip) => trip.id === recentId) ??
    trips.find((trip) => tripStatus(trip) === "Live") ??
    trips[0];
  const tripPlaces = useTripPlaces(activeTrip?.id ?? null);
  const explore = useExplorePlaces(
    mode === "Explore" ? (activeTrip?.id ?? null) : null,
  );
  useEffect(() => {
    setSelectedId(null);
    setVibe("All");
    setMissingOpen(false);
  }, [activeTrip?.id]);

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

      const nextHeight = shouldExpand ? expandedHeight : collapsedHeight;

      currentHeight.current = nextHeight;
      setSheetHeight(nextHeight);
      setExpanded(shouldExpand);
    };

    return PanResponder.create({
      onStartShouldSetPanResponder: () => false,

      onMoveShouldSetPanResponderCapture: (_, gesture) =>
        Math.abs(gesture.dy) > 6 && Math.abs(gesture.dy) > Math.abs(gesture.dx),

      onPanResponderGrant: () => {
        dragStartHeight.current = currentHeight.current;
      },

      onPanResponderMove: (_, gesture) => {
        const nextHeight = clampHeight(dragStartHeight.current - gesture.dy);

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
  const source = mode === "My Trip" ? tripPlaces.places : explore.places;

  const categories = Array.from(
    new Set([
      ...source.flatMap((place) => place.tags),
      ...(mode === "My Trip"
        ? tripPlaces.unresolved.flatMap((place) => place.tags)
        : []),
    ]),
  ).sort();
  const vibes = [
    { name: "All", icon: Sparkles },
    ...categories.map((name) => ({
      name,
      icon:
        name === "Food" || name === "Foodie"
          ? Utensils
          : name === "Attraction" || name === "Heritage"
            ? Landmark
            : name === "Tranquility" || name === "Nature"
              ? Leaf
              : MapPin,
    })),
  ];
  const effectiveVibe = categories.includes(vibe) ? vibe : "All";
  const visible = source.filter(
    (place) => effectiveVibe === "All" || place.tags.includes(effectiveVibe),
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
          accessibilityLabel={`Choose trip. Current trip: ${activeTrip?.title ?? "No trip selected"}`}
          accessibilityState={{ expanded: tripMenuOpen }}
          onPress={() => setTripMenuOpen((value) => !value)}
        >
          <MapPin size={18} color="#7E49C2" />

          <Text style={s.tripText} numberOfLines={1}>
            {tripsLoading
              ? "Loading trips…"
              : (activeTrip?.title ?? "Choose a trip")}
          </Text>

          <ChevronDown
            size={18}
            color="#61368B"
            style={{
              transform: [{ rotate: tripMenuOpen ? "180deg" : "0deg" }],
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

      {/* CHANGED: selectable saved trips. */}
      {tripMenuOpen && (
        <View style={s.tripMenu}>
          <Text style={s.tripMenuHeading}>Choose a trip</Text>

          <ScrollView style={{ maxHeight: 150 }}>
            {trips.map((trip) => {
              const active = trip.id === activeTrip?.id;

              return (
                <TouchableOpacity
                  key={trip.id}
                  style={[s.tripOption, active && s.tripOptionActive]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => {
                    setActiveTripId(trip.id);
                    setSelectedId(null);
                    void rememberTrip(trip.id).catch(() => {});
                    setVibe("All");
                    setExpanded(true);
                    setReset((value) => value + 1);
                    setTripMenuOpen(false);
                  }}
                >
                  <View style={s.tripOptionLabels}>
                    <Text style={s.tripOptionTitle}>{trip.title}</Text>
                    <Text style={s.tripOptionSubtitle}>
                      {[trip.destination, tripStatus(trip)]
                        .filter(Boolean)
                        .join(" · ")}
                    </Text>
                  </View>

                  {active && <Check size={20} color="#7E49C2" />}
                </TouchableOpacity>
              );
            })}
            {!tripsLoading && !trips.length && (
              <Text style={s.emptyText}>
                No trips yet. Create one from Home.
              </Text>
            )}
          </ScrollView>
        </View>
      )}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.vibeScroll}
        contentContainerStyle={s.vibes}
      >
        {vibes.map(({ name, icon: Icon }) => {
          const active = effectiveVibe === name;
          const count = [
            ...source,
            ...(mode === "My Trip" ? tripPlaces.unresolved : []),
          ].filter((place) => place.tags.includes(name)).length;

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
                {name !== "All" ? ` · ${count}` : ""}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {tripsError || (mode === "My Trip" ? tripPlaces.error : explore.error) ? (
        <TouchableOpacity
          style={s.status}
          onPress={() => {
            refresh();
            if (mode === "My Trip") tripPlaces.retry();
            else explore.retry();
          }}
        >
          <Text style={s.emptyText}>
            {tripsError ||
              (mode === "My Trip" ? tripPlaces.error : explore.error)}{" "}
            Tap to retry.
          </Text>
        </TouchableOpacity>
      ) : null}
      {mode === "My Trip" && activeTrip && (
        <View style={s.status}>
          <Text style={s.tripOptionSubtitle}>
            {tripPlaces.loading ? "Finding itinerary locations… · " : ""}
            {tripPlaces.places.length} mapped · {tripPlaces.unresolved.length}{" "}
            without pins
          </Text>
          {tripPlaces.unresolved.length > 0 && (
            <TouchableOpacity onPress={() => setMissingOpen(true)}>
              <Text style={s.link}>View places without pins</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
      {mode === "Explore" && (
        <Text
          style={[
            s.tripOptionSubtitle,
            { paddingHorizontal: 16, paddingBottom: 6 },
          ]}
        >
          {explore.loading
            ? "Finding places to explore…"
            : activeTrip
              ? `${explore.places.length} places near ${explore.city || activeTrip.destination || "your destination"}`
              : "Choose a trip to explore its destination."}
        </Text>
      )}
      <View style={s.mapArea}>
        <TripMap
          places={visible}
          center={
            mode === "Explore"
              ? (explore.center ?? tripPlaces.places[0])
              : tripPlaces.places[0]
          }
          selectedPlaceId={selected?.id ?? null}
          onSelectPlace={(place) => {
            setSelectedId(place.id);
            setExpanded(true);
            setTripMenuOpen(false);
          }}
          routePlaces={[]}
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
                  setSelectedId(null);
                  setVibe("All");
                  setExpanded(true);
                  setTripMenuOpen(false);
                }}
                style={[s.segmentButton, mode === item && s.segmentActive]}
              >
                <Text style={[s.segmentText, mode === item && s.white]}>
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
            accessibilityLabel="Show all visible places"
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
      </View>

      {selected ? (
        // CHANGED: panel height follows the user's drag.
        <View style={{ height: sheetHeight, flexShrink: 0 }}>
          {/* CHANGED: photos no longer select other places. */}
          <PlaceDetailsSheet
            key={JSON.stringify([
              selected.id,
              selected.name,
              selected.area,
              selected.description,
              selected.latitude,
              selected.longitude,
            ])}
            place={selected}
            expanded={expanded}
            onToggle={() => setExpanded((value) => !value)}
            dragHandlers={sheetPanResponder.panHandlers}
            onAdd={() => {
              if (mode === "My Trip" && selected.tripId) {
                router.push({ pathname: "/trips/[id]/itinerary", params: { id: selected.tripId } });
                return;
              }
              if (!activeTrip) return;
              if (activeTrip.owner_id !== user?.id) {
                showNotice("Add to itinerary", "Only the trip organiser can add activities.");
                return;
              }
              router.push({ pathname: "/trips/[id]/itinerary", params: {
                id: activeTrip.id, action: "add-activity", activityName: selected.name,
                locationDraft: JSON.stringify({ provider: "wikipedia", providerId: selected.id,
                  name: selected.name, address: selected.area, latitude: selected.latitude,
                  longitude: selected.longitude, categories: [] }),
              } });
            }}
          />
        </View>
      ) : (
        <View style={s.empty}>
          <Text style={s.emptyText}>
            {mode === "My Trip"
              ? tripsLoading || tripPlaces.loading
                ? "Loading itinerary locations…"
                : !activeTrip
                  ? "Create a trip to see its planned places here."
                  : tripPlaces.unresolved.length
                    ? "Some itinerary places need a more specific map location."
                    : "No mapped stops in this view. Add places in your trip itinerary."
              : explore.loading
                ? "Finding nearby attractions…"
                : !activeTrip
                  ? "Create a trip to explore its destination."
                  : explore.places.length
                    ? "No places match this filter."
                    : "No additional attractions found nearby. Try another trip or retry the search."}
          </Text>

          <TouchableOpacity
            onPress={() => {
              if (mode === "My Trip") {
                if (activeTrip)
                  router.push({
                    pathname: "/trips/[id]/itinerary",
                    params: { id: activeTrip.id },
                  });
                else router.push("/trips/create");
              } else if (!activeTrip) router.push("/trips/create");
              else if (!explore.places.length) explore.retry();
              else setVibe("All");
            }}
          >
            <Text style={s.link}>
              {mode === "My Trip"
                ? activeTrip
                  ? "Open itinerary"
                  : "Create trip"
                : !activeTrip
                  ? "Create trip"
                  : !explore.places.length
                    ? "Retry search"
                    : "Clear filter"}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <BottomSheet
        visible={missingOpen}
        title="Places without map pins"
        onClose={() => setMissingOpen(false)}
      >
        <Text style={s.noticeText}>
          These activities are still in your itinerary. Choose Find location to
          search by place name or full address and select a matching location.
        </Text>
        {tripPlaces.unresolved.map((place) => (
          <View key={place.id} style={{ paddingVertical: 12, gap: 4 }}>
            <Text style={s.tripOptionTitle}>{place.name}</Text>
            <Text style={s.tripOptionSubtitle}>{place.tags.join(" · ")}</Text>
            <Text style={s.emptyText}>{place.reason}</Text>
            <TouchableOpacity accessibilityRole="button" onPress={() => {
              setMissingOpen(false);
              router.push({ pathname: "/trips/[id]/itinerary", params: {
                id: place.tripId, action: "find-location", activityId: place.id,
              } });
            }}><Text style={s.link}>Find location</Text></TouchableOpacity>
          </View>
        ))}
        <TouchableOpacity
          onPress={() => {
            setMissingOpen(false);
            if (mode === "My Trip") tripPlaces.retry();
            else explore.retry();
          }}
        >
          <Text style={s.link}>Retry location lookup</Text>
        </TouchableOpacity>
        {activeTrip && (
          <TouchableOpacity
            onPress={() => {
              setMissingOpen(false);
              router.push({
                pathname: "/trips/[id]/itinerary",
                params: { id: activeTrip.id },
              });
            }}
          >
            <Text style={s.link}>Edit itinerary place names</Text>
          </TouchableOpacity>
        )}
      </BottomSheet>
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
  status: { paddingHorizontal: 16, paddingBottom: 8, gap: 3 },
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
  empty: { padding: 22, gap: 10 },
  emptyText: { color: "#4E2867" },
  link: {
    color: "#7E49C2",
    fontWeight: "700",
    paddingVertical: 8,
  },
  noticeText: { color: "#4E2867", fontSize: 15, lineHeight: 23 },
});
