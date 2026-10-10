import { Text, View } from "react-native";
import { Card } from "@/components/ui";
import { findCurrency, formatMoney } from "../currencies";
import type { Expense } from "../model";

type Props = {
  expense: Expense;
  paidByName: string;
  myShare?: number | null;
};

export function ExpenseListItem({ expense, paidByName, myShare }: Props) {
  const code = expense.original_currency;
  const foreign =
    !!code && code !== "RM" && expense.original_amount != null;
  const decimals = findCurrency(code)?.decimals ?? 2;

  return (
    <Card className="flex-row items-center justify-between">
      <View className="flex-1 pr-3">
        <Text className="text-base font-semibold text-ink">{expense.title}</Text>
        <Text className="text-xs text-muted">
          Paid by {paidByName} · {expense.category ?? "Other"}
        </Text>
        {myShare != null && (
          <Text className="text-xs font-semibold text-brand">
            Your share {formatMoney(myShare, "RM")}
          </Text>
        )}
      </View>
      <View className="items-end">
        <Text className="text-base font-semibold text-ink">
          {formatMoney(expense.amount, "RM")}
        </Text>
        {foreign && (
          <Text className="text-xs text-muted">
            {formatMoney(expense.original_amount as number, code as string, decimals)}
          </Text>
        )}
      </View>
    </Card>
  );
}