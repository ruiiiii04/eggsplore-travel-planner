import { Text } from "react-native";
import { Card } from "@/components/ui";
import { compareBudget, estimateTripCost, formatRange } from "../estimates";

type Props = {
  destination: string | null;
  startDate: string | null;
  endDate: string | null;
  budget: number | null;
};

export function TripForecastCard({
  destination,
  startDate,
  endDate,
  budget,
}: Props) {
  const estimate = estimateTripCost(destination, startDate, endDate);

  if (!estimate) {
    return (
      <Card>
        <Text className="text-sm font-semibold text-ink">
          Estimated trip cost
        </Text>
        <Text className="text-xs text-muted">
          Add trip dates to see an estimate.
        </Text>
      </Card>
    );
  }

  const fit = budget === null ? null : compareBudget(budget, estimate);

  return (
    <Card>
      <Text className="text-sm font-semibold text-ink">
        Estimated trip cost
      </Text>
      <Text className="text-2xl font-bold text-ink">
        {formatRange(estimate)}
      </Text>
      <Text className="text-xs text-muted">
        Rough estimate per person for {estimate.days} days, excluding flights.
      </Text>
      {fit === null && (
        <Text className="text-sm text-muted">
          Set a budget to compare.
        </Text>
      )}
      {fit === "tight" && (
        <Text className="text-sm font-semibold text-danger">
          Your budget is below the typical range. Consider raising it or
          cutting costs.
        </Text>
      )}
      {fit === "within" && (
        <Text className="text-sm font-semibold text-ink">
          Your budget is within the typical range.
        </Text>
      )}
      {fit === "comfortable" && (
        <Text className="text-sm font-semibold text-success">
          Your budget is above the typical range, so you have extra room.
        </Text>
      )}
    </Card>
  );
}