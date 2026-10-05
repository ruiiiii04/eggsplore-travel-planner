import { router } from "expo-router";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { MapPinned, Pencil, UsersRound, Wallet } from "lucide-react-native";
import Svg, { Path } from "react-native-svg";
import { SafeAreaView } from "react-native-safe-area-context";
import { CreationHeader, tripColors } from "./CreationUI";

const features = [
  { icon: Pencil, title: "AI Itinerary" },
  { icon: UsersRound, title: "Group Planning" },
  { icon: MapPinned, title: "Live Map" },
  { icon: Wallet, title: "Budget Tracker" },
];

export default function WelcomeScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <CreationHeader onBack={() => { if (router.canGoBack()) router.back(); else router.replace("/(tabs)/home"); }} />
      <View pointerEvents="none" style={styles.wave}>
        <Svg width="100%" height="100%" viewBox="0 0 402 126" preserveAspectRatio="none">
          <Path d="M0 32 C74 45 115 0 207 20 C282 37 325 45 402 12 L402 126 L0 126Z" fill="#F4EAFE" />
          <Path d="M0 73 C73 36 134 61 204 70 C273 80 315 51 402 68 L402 126 L0 126Z" fill="#EFE5FA" />
          <Path d="M0 95 C89 75 143 99 232 89 C308 80 343 75 402 95 L402 126 L0 126Z" fill="#E9DDF7" />
        </Svg>
      </View>
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Image source={require("../../../../assets/figma-welcome-mascot.png")} resizeMode="contain" style={styles.mascot} />
        </View>
        <Text style={styles.title}>Ready for Your Next{`\n`}Adventure?</Text>
        <Text style={styles.subtitle}>Create your first trip and let Eggsplore{`\n`}plan the perfect journey for you!</Text>
        <Pressable onPress={() => router.push("/trips/create/type")} style={styles.button} accessibilityRole="button">
          <Text style={styles.plus}>＋</Text><Text style={styles.buttonText}>Create Trip</Text>
        </Pressable>
        <View style={styles.features}>
          {features.map(({ icon: Icon, title }) => (
            <View key={title} style={styles.feature}>
              <View style={styles.featureIcon}><Icon size={23} color={tripColors.purple} strokeWidth={2} /></View>
              <Text numberOfLines={1} style={styles.featureTitle}>{title}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#FBF9FC" },
  body: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 132 },
  hero: { height: 263, alignItems: "center", justifyContent: "center", position: "relative" },
  mascot: { width: 280, height: 197, zIndex: 1 },
  title: { color: tripColors.dark, fontFamily: "Fredoka", fontSize: 27, fontWeight: "700", lineHeight: 33, textAlign: "center", marginTop: 1 },
  subtitle: { color: tripColors.muted, fontFamily: "Inter", fontSize: 13, lineHeight: 19, textAlign: "center", marginTop: 11 },
  button: { marginTop: 27, minHeight: 54, width: "100%", borderRadius: 28, backgroundColor: "#804BC0", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, boxShadow: "0px 5px 11px rgba(60, 25, 80, 0.24)", elevation: 4 },
  plus: { color: "white", fontFamily: "Inter", fontSize: 22, lineHeight: 25, marginTop: -2 },
  buttonText: { color: "white", fontFamily: "Inter", fontWeight: "700", fontSize: 15 },
  features: { flexDirection: "row", justifyContent: "space-between", gap: 8, marginTop: 34 },
  feature: { width: "23%", alignItems: "center", gap: 7 },
  featureIcon: { width: 61, height: 61, borderRadius: 18, backgroundColor: "white", borderWidth: 1, borderColor: "#EFE5F8", alignItems: "center", justifyContent: "center", boxShadow: "0px 2px 6px rgba(60, 25, 80, 0.06)", elevation: 1 },
  featureTitle: { color: "#88779B", fontFamily: "Inter", fontSize: 9, fontWeight: "600", textAlign: "center" },
  wave: { position: "absolute", left: 0, right: 0, bottom: 0, height: 126 },
});
