import { router } from "expo-router";
import { useState } from "react";
import {
  CalendarDays,
  Lightbulb,
  MapPin,
  Search,
  Wallet,
  X,
} from "lucide-react-native";
import { Pressable, Text, TextInput, View } from "react-native";
import { validateTrip } from "@/features/trips/model";
import {
  CreationActionButton,
  tripColors,
  uiStyles,
  WizardFrame,
} from "./CreationUI";
import { useTripCreation } from "./TripCreationContext";

import { CalendarDateField } from "./CalendarDateField";
import { BudgetRange } from "./BudgetRange";

const destinations = ["Bali", "Tokyo", "Seoul", "Bangkok"];

export default function TravelDetailsScreen() {
  const { data, update } = useTripCreation();
  const [formError, setFormError] = useState("");
  function chooseDestination(value: string) {
    update({ destination: value, title: "" });
    setFormError("");
  }
  function continueToPreferences() {
    if (!data.destination.trim()) {
      setFormError("Add a destination to continue.");
      return;
    }
    const start = data.startDate.trim();
    const end = data.endDate.trim();
    if (!!start !== !!end) {
      setFormError("Add both dates, or leave both blank to decide later.");
      return;
    }
    const validation = validateTrip("Trip", start, end);
    if (validation) {
      setFormError(validation);
      return;
    }
    if (start && end) {
      const days =
        Math.floor(
          (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) /
            86_400_000,
        ) + 1;
      if (days > 14) {
        setFormError(
          "AI itinerary generation supports trips up to 14 days. You can create a flexible trip without dates instead.",
        );
        return;
      }
    }
    setFormError("");
    router.push("/trips/create/preferences");
  }
  return (
    <WizardFrame
      step={2}
      tripType={data.tripType}
      footer={
        <CreationActionButton onPress={continueToPreferences}>
          Next
        </CreationActionButton>
      }
    >
      <View style={[uiStyles.card, { marginHorizontal: -10 }]}>
        <SectionHeading
          icon={<MapPin size={19} color={tripColors.purple} />}
          title="Destination"
        />
        <View style={styles.searchInput}>
          <Search size={17} color={tripColors.dark} />
          <TextInput
            value={data.destination}
            onChangeText={chooseDestination}
            placeholder="Bali, Indonesia"
            placeholderTextColor="#4C3B61"
            style={styles.destinationField}
          />
          <Pressable
            onPress={() => chooseDestination("")}
            accessibilityRole="button"
            accessibilityLabel="Clear destination"
            style={styles.clear}
          >
            <X size={12} color="white" />
          </Pressable>
        </View>
        <View style={styles.chips}>
          {destinations.map((place) => {
            const selected =
              place.toLowerCase() === data.destination.toLowerCase();
            return (
              <Pressable
                key={place}
                onPress={() => chooseDestination(place)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                style={[styles.chip, selected && styles.chipSelected]}
              >
                <Text
                  style={[styles.chipText, selected && styles.chipTextSelected]}
                >
                  {place}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={[uiStyles.card, { marginHorizontal: -10 }]}>
        <SectionHeading
          icon={<CalendarDays size={19} color={tripColors.purple} />}
          title="Travel Dates (optional)"
        />
        <View style={styles.dateRow}>
          <CalendarDateField
            label="From"
            value={data.startDate}
            onChange={(startDate) => {
              update({
                startDate,
                endDate:
                  startDate && data.endDate < startDate ? "" : data.endDate,
              });
              setFormError("");
            }}
          />
          <CalendarDateField
            label="To"
            value={data.endDate}
            minimum={data.startDate}
            onChange={(endDate) => {
              update({ endDate });
              setFormError("");
            }}
          />
        </View>
        <Text
          style={{
            color: "#89799A",
            fontFamily: "Inter",
            fontSize: 10,
            lineHeight: 15,
            marginTop: 8,
          }}
        >
          Leave both blank to create a flexible trip and explore candidates
          first. Add both dates to generate an AI itinerary.
        </Text>
        {!!formError && (
          <Text
            accessibilityRole="alert"
            style={{
              color: "#B43F60",
              fontFamily: "Inter",
              fontSize: 11,
              marginTop: 9,
            }}
          >
            {formError}
          </Text>
        )}
      </View>

      <View style={[uiStyles.card, { marginHorizontal: -10 }]}>
        <View style={styles.budgetHeading}>
          <SectionHeading
            icon={<Wallet size={19} color={tripColors.purple} />}
            title="Budget Range"
          />
          <Text style={styles.perPerson}>(per person)</Text>
        </View>
        <BudgetRange
          value={data.budget}
          onChange={(budget) => update({ budget })}
        />
        <View style={styles.estimate}>
          <Lightbulb size={18} color={tripColors.purple} />
          <View style={{ flex: 1 }}>
            <Text style={styles.estimateTitle}>
              Estimated cost for {data.destination || "your trip"}
              {dateSummary(data.startDate, data.endDate)}
            </Text>
            <Text style={styles.estimateBody}>
              Flights + stay typically range RM 1,800 – RM 4,200
            </Text>
          </View>
        </View>
      </View>
    </WizardFrame>
  );
}

function dateSummary(start: string, end: string) {
  if (!start || !end) return "";
  const short = (value: string) => {
    const date = new Date(`${value}T12:00:00`);
    return Number.isNaN(date.getTime())
      ? value
      : date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  };
  return ` · ${short(start)}–${short(end)}`;
}
function SectionHeading({
  icon,
  title,
}: {
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <View style={styles.sectionHeading}>
      {icon}
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

const styles = {
  sectionHeading: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 9,
    marginBottom: 13,
  },
  sectionTitle: {
    color: "#31145B",
    fontFamily: "Inter",
    fontSize: 14,
    fontWeight: "700" as const,
  },
  searchInput: {
    minHeight: 45,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#E8DDF3",
    backgroundColor: "white",
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 9,
    paddingHorizontal: 13,
  },
  destinationField: {
    flex: 1,
    paddingVertical: 9,
    color: "#31145B",
    fontFamily: "Inter",
    fontSize: 13,
    fontWeight: "600" as const,
  },
  clear: {
    width: 16,
    height: 16,
    borderRadius: 9,
    backgroundColor: "#B6A7C4",
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  chips: {
    flexDirection: "row" as const,
    flexWrap: "wrap" as const,
    gap: 8,
    marginTop: 13,
  },
  chip: {
    borderRadius: 18,
    backgroundColor: "#F1EAF8",
    paddingHorizontal: 16,
    paddingVertical: 7,
  },
  chipSelected: { backgroundColor: "#8050C5" },
  chipText: { color: "#776788", fontFamily: "Inter", fontSize: 12 },
  chipTextSelected: { color: "white" },
  dateRow: { flexDirection: "row" as const, gap: 12 },
  dateLabel: {
    color: "#857695",
    fontFamily: "Inter",
    fontSize: 12,
    marginBottom: 6,
  },
  dateField: {
    minHeight: 43,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E8DDF3",
    backgroundColor: "white",
    paddingHorizontal: 10,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 4,
  },
  dateText: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 8,
    color: "#31145B",
    fontFamily: "Inter",
    fontSize: 11,
    fontWeight: "600" as const,
  },
  budgetHeading: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 6,
  },
  perPerson: {
    color: "#857695",
    fontFamily: "Inter",
    fontSize: 12,
    marginBottom: 13,
  },
  budgetValue: {
    color: "#31145B",
    fontFamily: "Inter",
    fontSize: 15,
    fontWeight: "700" as const,
    marginTop: -5,
  },
  sliderWrap: {
    height: 25,
    justifyContent: "center" as const,
    marginHorizontal: 17,
    marginTop: 6,
  },
  sliderTrack: {
    height: 8,
    borderRadius: 6,
    backgroundColor: "#D5B5EF",
    position: "relative" as const,
  },
  rangeTrack: {
    position: "absolute" as const,
    top: 0,
    bottom: 0,
    backgroundColor: "#8050C5",
    borderRadius: 6,
  },
  thumb: {
    position: "absolute" as const,
    top: -5,
    width: 18,
    height: 18,
    marginLeft: -9,
    borderRadius: 10,
    backgroundColor: "#8050C5",
    borderWidth: 2,
    borderColor: "white",
    elevation: 1,
  },
  sliderLabels: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    marginTop: 1,
  },
  rangeLabel: { color: "#8B7A9B", fontFamily: "Inter", fontSize: 11 },
  estimate: {
    minHeight: 69,
    backgroundColor: "#F3EDFB",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row" as const,
    alignItems: "flex-start" as const,
    gap: 10,
    marginTop: 13,
  },
  estimateTitle: {
    color: "#31145B",
    fontFamily: "Inter",
    fontSize: 11,
    fontWeight: "700" as const,
    lineHeight: 16,
  },
  estimateBody: {
    color: "#89799B",
    fontFamily: "Inter",
    fontSize: 10,
    lineHeight: 15,
    marginTop: 1,
  },
};
