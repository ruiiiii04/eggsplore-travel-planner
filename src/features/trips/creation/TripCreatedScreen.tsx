import { router } from "expo-router";
import { Image, StyleSheet, Text, View } from "react-native";
import { MapPin, UsersRound } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CreationActionButton, CreationHeader, tripColors } from "./CreationUI";
import { useTripCreation } from "./TripCreationContext";

export default function TripCreatedScreen() {
  const { data, reset } = useTripCreation();
  const dateRange = data.startDate && data.endDate ? `${prettyDate(data.startDate)} – ${prettyDate(data.endDate, true)}` : "Dates are flexible";
  const destinationText = `${data.destination} ${data.title}`.toLowerCase();
  const cover = /japan|tokyo|kyoto|osaka|hokkaido/i.test(destinationText) ? require("../../../../assets/trip-japan-cover.png") : /bali|indonesia/i.test(destinationText) ? require("../../../../assets/trip-bali-cover.png") : null;
  function openTrip() {
    if (data.tripId) router.replace({ pathname: "/trips/[id]", params: { id: data.tripId } });
    else router.replace("/(tabs)/home");
    reset();
  }
  function goHome() { reset(); router.replace("/(tabs)/home"); }
  const memberCount = 1 + data.invitees.length;

  return (
    <SafeAreaView edges={["top", "left", "right", "bottom"]} style={styles.safe}>
      <CreationHeader onBack={goHome} backLabel="Back to home" />
      <View style={styles.content}>
        <Image source={require("../../../../assets/figma-trip-created-mascot.png")} resizeMode="contain" style={styles.celebration} />
        <Text style={styles.title}>Trip Created!</Text>
        <Text style={styles.subtitle}>Your adventure to {data.destination || "your destination"} is all set.</Text>
        <View style={styles.tripCard}>
          {cover ? <Image source={cover} resizeMode="cover" style={styles.tripCover} /> : <View style={styles.coverFallback}><MapPin size={34} color="#B891DF" /></View>}
          <View style={styles.tripCopy}>
            <Text numberOfLines={1} style={styles.destination}>{data.destination || "Your destination"}</Text>
            <Text numberOfLines={1} style={styles.date}>{dateRange}</Text>
            <View style={styles.memberLine}><UsersRound size={14} color="#8D78A2" /><Text style={styles.memberCount}>{memberCount} {memberCount === 1 ? "member" : "members"}</Text></View>
          </View>
        </View>
        {!!data.invitationStatus && <View style={styles.invitationNotice}><Text style={styles.invitationText}>{data.invitationStatus}</Text></View>}
        <View style={styles.actions}>
          <CreationActionButton onPress={openTrip}>View Trip</CreationActionButton>
          <CreationActionButton variant="secondary" onPress={goHome}>Back to Home</CreationActionButton>
        </View>
      </View>
    </SafeAreaView>
  );
}

function prettyDate(value: string, includeYear = false) {
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", ...(includeYear ? { year: "numeric" as const } : {}) });
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#FBF9FC" },
  content: { flex: 1, paddingHorizontal: 24, paddingTop: 8, paddingBottom: 20, alignItems: "center" },
  celebration: { height: 277, width: 280 },
  title: { color: tripColors.dark, fontFamily: "Fredoka", fontSize: 29, fontWeight: "700", textAlign: "center", marginTop: -1 },
  subtitle: { color: "#897A98", fontFamily: "Inter", fontSize: 13, textAlign: "center", marginTop: 7 },
  tripCard: { width: "100%", minHeight: 121, borderRadius: 20, borderWidth: 1, borderColor: "#ECE2F4", backgroundColor: "white", padding: 13, flexDirection: "row", alignItems: "center", gap: 13, marginTop: 30 },
  tripCover: { width: 90, height: 90, borderRadius: 14, backgroundColor: "#F0E8F7" },
  coverFallback: { width: 90, height: 90, borderRadius: 14, backgroundColor: "#F3EDF9", alignItems: "center", justifyContent: "center" },
  tripCopy: { flex: 1, gap: 4 },
  destination: { color: "#321553", fontFamily: "Fredoka", fontSize: 17 },
  date: { color: "#88799A", fontFamily: "Inter", fontSize: 11 },
  memberLine: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 3 },
  memberCount: { color: "#88799A", fontFamily: "Inter", fontSize: 10 },
  actions: { width: "100%", marginTop: "auto", gap: 10 },
  invitationNotice: { width: "100%", borderRadius: 14, borderWidth: 1, borderColor: "#ECE2F4", backgroundColor: "white", padding: 12, marginTop: 14 },
  invitationText: { color: "#6F5D80", fontFamily: "Inter", fontSize: 10, lineHeight: 15 },
});
