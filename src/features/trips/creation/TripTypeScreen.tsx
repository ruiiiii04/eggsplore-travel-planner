import { router } from "expo-router";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import type { ReactNode } from "react";
import { Button } from "@/components/ui";
import { tripColors, WizardFrame } from "./CreationUI";
import { useTripCreation } from "./TripCreationContext";

export default function TripTypeScreen() {
  const { data, update } = useTripCreation();
  return (
    <WizardFrame step={1} footer={<Button className="min-h-[54px] rounded-full" onPress={() => router.push("/trips/create/details")}>Next</Button>}>
      <Text style={styles.title}>How do you want to travel?</Text>
      <Text style={styles.subtitle}>Choose your trip type to get started</Text>
      <View style={styles.choices}>
        <TripTypeCard selected={data.tripType === "solo"} onPress={() => update({ tripType: "solo" })} kind="solo" title="Solo Trip" description={<>Just you, your adventure,{`\n`}no limits!</>} />
        <TripTypeCard selected={data.tripType === "group"} onPress={() => update({ tripType: "group" })} kind="group" title="Group Trip" description={<>Travel with friends & family,{`\n`}make better memories!</>} />
      </View>
    </WizardFrame>
  );
}

function TripTypeCard({ selected, onPress, kind, title, description }: { selected: boolean; onPress: () => void; kind: "solo" | "group"; title: string; description: ReactNode }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected }} style={[styles.card, selected && styles.selected]}>
      <View style={styles.art}>
        {kind === "solo" ? <Image source={require("../../../../assets/figma-trip-type-3.png")} resizeMode="contain" style={styles.soloMascot} /> : <Image source={require("../../../../assets/figma-trip-type-4.png")} resizeMode="contain" style={styles.groupMascot} />}
      </View>
      <View style={styles.copy}><Text style={styles.cardTitle}>{title}</Text><Text style={styles.cardDescription}>{description}</Text></View>
      <View style={[styles.radio, selected && styles.radioSelected]}>{selected && <View style={styles.radioCenter} />}</View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  title: { color: tripColors.dark, fontFamily: "Fredoka", fontSize: 25, fontWeight: "700", textAlign: "center", marginTop: 9, marginBottom: -6 },
  subtitle: { color: tripColors.muted, fontFamily: "Inter", fontSize: 13, textAlign: "center", marginTop: 9, marginBottom: 6 },
  choices: { gap: 15 },
  card: { minHeight: 173, borderRadius: 17, borderWidth: 1, borderColor: "#E9E0F1", backgroundColor: "white", flexDirection: "row", alignItems: "center", paddingHorizontal: 13, paddingVertical: 12, position: "relative" },
  selected: { backgroundColor: "#F5EFFC", borderColor: "#C7A7EB", borderWidth: 2 },
  art: { width: 122, height: 130, alignItems: "center", justifyContent: "center" },
  soloMascot: { width: 139, height: 112 },
  groupMascot: { width: 137, height: 125 },
  copy: { flex: 1, paddingLeft: 8, paddingRight: 21 },
  cardTitle: { color: tripColors.dark, fontFamily: "Fredoka", fontSize: 21, fontWeight: "700", marginBottom: 3 },
  cardDescription: { color: "#7D6E8D", fontFamily: "Inter", fontSize: 13, lineHeight: 19 },
  radio: { position: "absolute", top: 17, right: 14, width: 22, height: 22, borderRadius: 12, borderWidth: 2, borderColor: "#CBB6E7", backgroundColor: "white", alignItems: "center", justifyContent: "center" },
  radioSelected: { borderColor: tripColors.purple },
  radioCenter: { width: 12, height: 12, borderRadius: 6, backgroundColor: tripColors.purple },
});
