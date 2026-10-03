import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { BriefcaseBusiness, Plus } from "lucide-react-native";
import { Screen } from "@/components/ui";
import { useTrips } from "./useTrips";
import { tripStatus, type Trip } from "./model";
import { getRecentTripId } from "./recentTrip";

const purple = "#7C4DBE";
const ink = "#3B1454";
const muted = "#7A6B8A";

function chooseTrip(trips: Trip[], recentId: string | null) {
  const live = trips.filter((trip) => tripStatus(trip) === "Live");
  if (live.length) return live.find((trip) => trip.id === recentId) ?? live[0];
  const recent = trips.find((trip) => trip.id === recentId);
  if (recent) return recent;
  const upcoming = trips
    .filter((trip) => tripStatus(trip) === "Upcoming")
    .sort((a, b) => (a.start_date ?? "9999").localeCompare(b.start_date ?? "9999"));
  return upcoming[0] ?? [...trips].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
}

export default function TripsScreen() {
  const { trips, loading, error, refresh } = useTrips();
  const [resolving, setResolving] = useState(false);
  const attempted = useRef(false);

  useFocusEffect(useCallback(() => {
    attempted.current = false;
    return undefined;
  }, []));

  useEffect(() => {
    if (loading || error || attempted.current) return;
    if (!trips.length) return;
    attempted.current = true;
    setResolving(true);
    void getRecentTripId().then((recentId) => {
      const trip = chooseTrip(trips, recentId);
      if (!trip) { setResolving(false); return; }
      router.replace({ pathname: "/trips/[id]/itinerary", params: { id: trip.id } });
    }).catch(() => {
      const trip = chooseTrip(trips, null);
      if (trip) router.replace({ pathname: "/trips/[id]/itinerary", params: { id: trip.id } });
      else setResolving(false);
    });
  }, [trips, loading, error]);

  if (loading || resolving) {
    return <Screen><View style={{ flex: 1, minHeight: 360, alignItems: "center", justifyContent: "center", gap: 12 }}><ActivityIndicator color={purple} /><Text style={{ color: muted }}>Opening your trip…</Text></View></Screen>;
  }

  if (error) {
    return <Screen><Text style={{ color: ink, fontSize: 22, fontWeight: "700" }}>Couldn’t open your trip</Text><Text style={{ color: muted, marginTop: 8 }}>{error}</Text><Pressable onPress={() => { attempted.current = false; refresh(); }} style={{ marginTop: 18, padding: 14, backgroundColor: purple, borderRadius: 16 }}><Text style={{ color: "white", textAlign: "center", fontWeight: "700" }}>Try again</Text></Pressable></Screen>;
  }

  return <Screen><View style={{ flex: 1, minHeight: 440, alignItems: "center", justifyContent: "center", paddingHorizontal: 28 }}><View style={{ width: 76, height: 76, borderRadius: 38, alignItems: "center", justifyContent: "center", backgroundColor: "#F1E9F9" }}><BriefcaseBusiness size={34} color={purple} /></View><Text style={{ color: ink, fontSize: 22, fontWeight: "700", marginTop: 18 }}>No trips yet</Text><Text style={{ color: muted, fontSize: 14, lineHeight: 21, textAlign: "center", marginTop: 8 }}>Create a trip from Home and your itinerary workspace will appear here.</Text><Pressable onPress={() => router.push("/trips/create")} style={{ marginTop: 22, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 20, paddingVertical: 13, backgroundColor: purple, borderRadius: 24 }}><Plus size={18} color="white" /><Text style={{ color: "white", fontWeight: "700" }}>Create a trip</Text></Pressable></View></Screen>;
}
