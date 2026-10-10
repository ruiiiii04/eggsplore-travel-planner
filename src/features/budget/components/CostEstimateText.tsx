import { Text, type StyleProp, type TextStyle } from "react-native";
import { dailyCost, estimateFromProfile, formatRange } from "../estimates";
import { useCostProfile } from "../useCostProfile";

type Props = {
  destination: string;
  startDate: string;
  endDate: string;
  style?: StyleProp<TextStyle>;
};

export function CostEstimateText({
  destination,
  startDate,
  endDate,
  style,
}: Props) {
  const place = destination.trim();
  const { profile, source, loading } = useCostProfile(place || null);

  if (!place) {
    return <Text style={style}>Choose a destination to see typical costs.</Text>;
  }
  if (loading) {
    return <Text style={style}>Estimating costs for {place}...</Text>;
  }

  const note =
  source === "ai" ? " Based on destination-specific costs." : "";
  const total = estimateFromProfile(profile, startDate || null, endDate || null);
  if (total) {
    return (
      <Text style={style}>
        Typically {formatRange(total)} per person for {total.days}{" "}
        {total.days === 1 ? "day" : "days"}, excluding flights.{note}
      </Text>
    );
  }
  return (
    <Text style={style}>
      Typically {formatRange(dailyCost(profile))} per person per day, excluding
      flights. Pick your travel dates to see a trip total.{note}
    </Text>
  );
}