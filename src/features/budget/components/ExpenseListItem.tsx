import { Text, View } from "react-native";
import { Card } from "@/components/ui";
import type { Expense } from "../model";

type Props = {
  expense: Expense;
  paidByName: string;
};

export function ExpenseListItem({ expense, paidByName }: Props) {
  return (
    <Card className="flex-row items-center justify-between">
      <View>
        <Text className="text-base font-semibold text-ink">{expense.title}</Text>
        <Text className="text-xs text-muted">
          Paid by {paidByName} · {expense.category ?? "Other"}
        </Text>
      </View>
      <Text className="text-base font-semibold text-ink">
        RM {expense.amount.toLocaleString()}
      </Text>
    </Card>
  );
}