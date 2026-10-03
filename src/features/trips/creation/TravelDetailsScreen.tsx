import { router } from "expo-router";
import { useState } from "react";
import { CalendarDays, Lightbulb, MapPin, Search, Wallet, X } from "lucide-react-native";
import { Pressable, Text, TextInput, View } from "react-native";
import { Button } from "@/components/ui";
import { validateTrip } from "@/features/trips/model";
import { tripColors, uiStyles, WizardFrame } from "./CreationUI";
import { useTripCreation } from "./TripCreationContext";

const destinations = ["Bali", "Tokyo", "Seoul", "Bangkok"];
const budgets = ["RM 1,000 – RM 2,000", "RM 2,000 – RM 5,000", "RM 5,000 – RM 10,000"];

export default function TravelDetailsScreen() {
  const { data, update } = useTripCreation();
  const [trackWidth, setTrackWidth] = useState(300);
  const [formError, setFormError] = useState("");
  function chooseDestination(value: string) {
    update({ destination: value, title: "" });
    setFormError("");
  }
  function selectBudget(position: number) {
    const index = position < 0.34 ? 0 : position > 0.68 ? 2 : 1;
    update({ budget: budgets[index] });
  }
  function continueToPreferences() {
    if (!data.destination.trim()) { setFormError("Add a destination to continue."); return; }
    if (!data.startDate.trim() || !data.endDate.trim()) { setFormError("Add both travel dates to generate your AI itinerary."); return; }
    const validation = validateTrip("Trip", data.startDate.trim(), data.endDate.trim());
    if (validation) { setFormError(validation); return; }
    setFormError("");
    router.push("/trips/create/preferences");
  }
  return (
    <WizardFrame step={2} footer={<Button className="min-h-[54px] rounded-full" onPress={continueToPreferences}>Next</Button>}>
      <View style={[uiStyles.card, { marginHorizontal: -10 }]}>
        <SectionHeading icon={<MapPin size={19} color={tripColors.purple} />} title="Destination" />
        <View style={styles.searchInput}>
          <Search size={17} color={tripColors.dark} />
          <TextInput value={data.destination} onChangeText={chooseDestination} placeholder="Bali, Indonesia" placeholderTextColor="#4C3B61" style={styles.destinationField} />
          <Pressable onPress={() => chooseDestination("")} accessibilityRole="button" accessibilityLabel="Clear destination" style={styles.clear}><X size={12} color="white" /></Pressable>
        </View>
        <View style={styles.chips}>{destinations.map((place) => {
          const selected = place.toLowerCase() === data.destination.toLowerCase();
          return <Pressable key={place} onPress={() => chooseDestination(place)} accessibilityRole="button" accessibilityState={{ selected }} style={[styles.chip, selected && styles.chipSelected]}><Text style={[styles.chipText, selected && styles.chipTextSelected]}>{place}</Text></Pressable>;
        })}</View>
      </View>

      <View style={[uiStyles.card, { marginHorizontal: -10 }]}>
        <SectionHeading icon={<CalendarDays size={19} color={tripColors.purple} />} title="Travel Dates" />
        <View style={styles.dateRow}>
          <DateInput label="From" value={data.startDate} onChangeText={(startDate) => { update({ startDate }); setFormError(""); }} />
          <DateInput label="To" value={data.endDate} onChangeText={(endDate) => { update({ endDate }); setFormError(""); }} />
        </View>
        {!!formError && <Text accessibilityRole="alert" style={{ color: "#B43F60", fontFamily: "Inter", fontSize: 11, marginTop: 9 }}>{formError}</Text>}
      </View>

      <View style={[uiStyles.card, { marginHorizontal: -10 }]}>
        <View style={styles.budgetHeading}><SectionHeading icon={<Wallet size={19} color={tripColors.purple} />} title="Budget Range" /><Text style={styles.perPerson}>(per person)</Text></View>
        <Text style={styles.budgetValue}>{data.budget}</Text>
        <View style={styles.sliderWrap}>
          <View
            style={styles.sliderTrack}
            onStartShouldSetResponder={() => true}
            onResponderRelease={(event) => selectBudget(event.nativeEvent.locationX / trackWidth)}
            onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
          >
            <View style={[styles.rangeTrack, data.budget === budgets[0] ? { left: "10%", width: "18%" } : data.budget === budgets[2] ? { left: "56%", width: "37%" } : { left: "10%", width: "47%" }]} />
            <View style={[styles.thumb, data.budget === budgets[0] ? { left: "10%" } : data.budget === budgets[2] ? { left: "56%" } : { left: "10%" }]} />
            <View style={[styles.thumb, data.budget === budgets[0] ? { left: "28%" } : data.budget === budgets[2] ? { left: "93%" } : { left: "57%" }]} />
          </View>
        </View>
        <View style={styles.sliderLabels}><Text style={styles.rangeLabel}>RM 1,000</Text><Text style={styles.rangeLabel}>RM 10,000</Text></View>
        <View style={styles.estimate}>
          <Lightbulb size={18} color={tripColors.purple} />
          <View style={{ flex: 1 }}><Text style={styles.estimateTitle}>Estimated cost for {data.destination || "your trip"}{dateSummary(data.startDate, data.endDate)}</Text><Text style={styles.estimateBody}>Flights + stay typically range RM 1,800 – RM 4,200</Text></View>
        </View>
      </View>
    </WizardFrame>
  );
}

function dateSummary(start: string, end: string) {
  if (!start || !end) return "";
  const short = (value: string) => { const date = new Date(`${value}T12:00:00`); return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-GB", { day: "numeric", month: "short" }); };
  return ` · ${short(start)}–${short(end)}`;
}
function SectionHeading({ icon, title }: { icon: React.ReactNode; title: string }) {
  return <View style={styles.sectionHeading}>{icon}<Text style={styles.sectionTitle}>{title}</Text></View>;
}
function DateInput({ label, value, onChangeText }: { label: string; value: string; onChangeText: (value: string) => void }) {
  return <View style={{ flex: 1 }}><Text style={styles.dateLabel}>{label}</Text><View style={styles.dateField}><TextInput value={value} onChangeText={onChangeText} placeholder="YYYY-MM-DD" placeholderTextColor="#796C87" autoCapitalize="none" maxLength={10} style={styles.dateText} /><CalendarDays size={16} color="#8D7AA2" /></View></View>;
}

const styles = {
  sectionHeading: { flexDirection: "row" as const, alignItems: "center" as const, gap: 9, marginBottom: 13 },
  sectionTitle: { color: "#31145B", fontFamily: "Inter", fontSize: 14, fontWeight: "700" as const },
  searchInput: { minHeight: 45, borderRadius: 13, borderWidth: 1, borderColor: "#E8DDF3", backgroundColor: "white", flexDirection: "row" as const, alignItems: "center" as const, gap: 9, paddingHorizontal: 13 },
  destinationField: { flex: 1, paddingVertical: 9, color: "#31145B", fontFamily: "Inter", fontSize: 13, fontWeight: "600" as const },
  clear: { width: 16, height: 16, borderRadius: 9, backgroundColor: "#B6A7C4", alignItems: "center" as const, justifyContent: "center" as const },
  chips: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 8, marginTop: 13 },
  chip: { borderRadius: 18, backgroundColor: "#F1EAF8", paddingHorizontal: 16, paddingVertical: 7 },
  chipSelected: { backgroundColor: "#8050C5" },
  chipText: { color: "#776788", fontFamily: "Inter", fontSize: 12 },
  chipTextSelected: { color: "white" },
  dateRow: { flexDirection: "row" as const, gap: 12 },
  dateLabel: { color: "#857695", fontFamily: "Inter", fontSize: 12, marginBottom: 6 },
  dateField: { minHeight: 43, borderRadius: 12, borderWidth: 1, borderColor: "#E8DDF3", backgroundColor: "white", paddingHorizontal: 10, flexDirection: "row" as const, alignItems: "center" as const, gap: 4 },
  dateText: { flex: 1, minWidth: 0, paddingVertical: 8, color: "#31145B", fontFamily: "Inter", fontSize: 11, fontWeight: "600" as const },
  budgetHeading: { flexDirection: "row" as const, alignItems: "center" as const, gap: 6 },
  perPerson: { color: "#857695", fontFamily: "Inter", fontSize: 12, marginBottom: 13 },
  budgetValue: { color: "#31145B", fontFamily: "Inter", fontSize: 15, fontWeight: "700" as const, marginTop: -5 },
  sliderWrap: { height: 25, justifyContent: "center" as const, marginHorizontal: 17, marginTop: 6 },
  sliderTrack: { height: 8, borderRadius: 6, backgroundColor: "#D5B5EF", position: "relative" as const },
  rangeTrack: { position: "absolute" as const, top: 0, bottom: 0, backgroundColor: "#8050C5", borderRadius: 6 },
  thumb: { position: "absolute" as const, top: -5, width: 18, height: 18, marginLeft: -9, borderRadius: 10, backgroundColor: "#8050C5", borderWidth: 2, borderColor: "white", elevation: 1 },
  sliderLabels: { flexDirection: "row" as const, justifyContent: "space-between" as const, marginTop: 1 },
  rangeLabel: { color: "#8B7A9B", fontFamily: "Inter", fontSize: 11 },
  estimate: { minHeight: 69, backgroundColor: "#F3EDFB", borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, flexDirection: "row" as const, alignItems: "flex-start" as const, gap: 10, marginTop: 13 },
  estimateTitle: { color: "#31145B", fontFamily: "Inter", fontSize: 11, fontWeight: "700" as const, lineHeight: 16 },
  estimateBody: { color: "#89799B", fontFamily: "Inter", fontSize: 10, lineHeight: 15, marginTop: 1 },
};
