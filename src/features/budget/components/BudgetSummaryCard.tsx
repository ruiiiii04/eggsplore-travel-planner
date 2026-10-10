import { Text, View } from "react-native";
import { Card } from "@/components/ui";
import { budgetProgress, remainingBudget } from "../model";

type Props = {
  budget: number;
  spent: number;
  currency?: string;
};

export function BudgetSummaryCard({ budget, spent, currency = "RM" }: Props) {
  const progress = budgetProgress(spent, budget);
  const remaining = remainingBudget(spent, budget);

  return (
    <Card>
      <View className="flex-row items-start justify-between">
        <View>
          <Text className="text-sm text-muted">Total Budget</Text>
          <Text className="text-2xl font-bold text-ink">
            {currency} {budget.toLocaleString()}
          </Text>
          <Text className="text-xs text-muted">(per person)</Text>
        </View>
        <View className="items-end">
          <Text className="text-sm text-muted">
            Spent{" "}
            <Text className="font-semibold text-brand">
              {currency} {spent.toLocaleString()}
            </Text>
          </Text>
          <Text className="text-sm text-muted">
            Remaining{" "}
            <Text className="font-semibold text-success">
              {currency} {remaining.toLocaleString()}
            </Text>
          </Text>
        </View>
      </View>

      <View className="h-2 rounded-full bg-lavender overflow-hidden">
        <View
          className="h-2 rounded-full bg-brand"
          style={{ width: `${progress}%` }}
        />
      </View>
      <Text className="text-xs text-muted text-right">{progress}%</Text>
    </Card>
  );
}