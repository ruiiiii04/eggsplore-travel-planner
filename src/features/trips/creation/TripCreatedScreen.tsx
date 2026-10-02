import { router } from "expo-router";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { ArrowLeft, MapPin, UsersRound } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/ui";
import { tripColors } from "./CreationUI";
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
  return (
    <SafeAreaView edges={["top", "left", "right", "bottom"]} style={styles.safe}>
      <View style={styles.header}><Pressable onPress={goHome} accessibilityRole="button" accessibilityLabel="Back to home" style={styles.back}><ArrowLeft size={21} color={tripColors.dark} /></Pressable></View>
      <View style={styles.content}>
        <Image source={require("../../../../assets/figma-trip-created-mascot.png")} resizeMode="contain" style={styles.celebration} />
        <Text style={styles.title}>Trip Created!</Text>
        <Text style={styles.subtitle}>Your adventure to {data.destination || "your destination"} is all set.</Text>
        <View style={styles.tripCard}>
          {cover ? <Image source={cover} resizeMode="cover" style={styles.tripCover} /> : <View style={styles.coverFallback}><MapPin size={34} color="#B891DF" /></View>}
          <View style={styles.tripCopy}>
            <Text numberOfLines={1} style={styles.destination}>{data.destination || "Your destination"}</Text>
            <Text numberOfLines={1} style={styles.date}>{dateRange}</Text>
            <View style={styles.memberLine}>{data.tripType === "group" ? <><View style={styles.avatarStack}>{[0, 1, 2].map((avatar) => <View key={avatar} style={[styles.avatar, { marginLeft: avatar ? -7 : 0, backgroundColor: ["#C5A5E8", "#F0C9D4", "#A9C7D6"][avatar] }]}><UsersRound size={10} color="white" /></View>)}</View><Text style={styles.memberCount}>{Math.max(data.invitees.length + 1, 1)} members</Text></> : <><UsersRound size={14} color="#8D78A2" /><Text style={styles.memberCount}>1 member</Text></>}</View>
          </View>
        </View>
        <View style={styles.actions}>
          <Button className="min-h-[54px] rounded-full" onPress={openTrip}>View Trip</Button>
          <Pressable onPress={goHome} style={styles.homeButton}><Text style={styles.homeButtonText}>Back to Home</Text></Pressable>
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
  header: { height: 48, paddingHorizontal: 24, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  back: { width: 36, height: 36, justifyContent: "center" },
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
  avatarStack: { flexDirection: "row", alignItems: "center", paddingLeft: 1 },
  avatar: { width: 19, height: 19, borderRadius: 10, borderWidth: 1.5, borderColor: "white", alignItems: "center", justifyContent: "center" },
  avatarStack: { flexDirection: "row", alignItems: "center", paddingLeft: 1 },
  avatar: { width: 19, height: 19, borderRadius: 10, borderWidth: 1.5, borderColor: "white", alignItems: "center", justifyContent: "center" },
  memberCount: { color: "#88799A", fontFamily: "Inter", fontSize: 10 },
  actions: { width: "100%", marginTop: "auto", gap: 10 },
  homeButton: { minHeight: 53, borderRadius: 28, borderWidth: 1, borderColor: "#DED0ED", alignItems: "center", justifyContent: "center", backgroundColor: "#FBF9FC" },
  homeButtonText: { color: "#8050C5", fontFamily: "Inter", fontSize: 15, fontWeight: "700" },
});
