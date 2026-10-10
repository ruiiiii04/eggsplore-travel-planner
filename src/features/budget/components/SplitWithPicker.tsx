import { Pressable, Text, TextInput, View } from "react-native";
import { formatMoney, sanitizeAmount } from "../currencies";
import type { SplitType } from "../model";

export type Member = { id: string; name: string; initials: string };

type Props = {
  members: Member[];
  splitType: SplitType;
  selectedIds: string[];
  onToggleMember: (id: string) => void;
  customAmounts: Record<string, string>;
  onChangeAmount: (id: string, value: string) => void;
  currencyCode: string;
  decimals: number;
  total: number;
};

export function SplitWithPicker({
  members,
  splitType,
  selectedIds,
  onToggleMember,
  customAmounts,
  onChangeAmount,
  currencyCode,
  decimals,
  total,
}: Props) {
  if (splitType === "none") {
    return (
      <Text className="text-sm text-muted">
        Only you will be charged for this expense.
      </Text>
    );
  }

  if (splitType === "amount") {
    const unit = 10 ** decimals;
    const assignedMinor = members.reduce(
      (sum, m) => sum + Math.round((Number(customAmounts[m.id]) || 0) * unit),
      0,
    );
    const totalMinor = Math.round(total * unit);
    const remaining = (totalMinor - assignedMinor) / unit;
    const matched = total > 0 && remaining === 0;
    const over = remaining < 0;

    return (
      <View className="gap-2">
        {members.map((m) => (
          <View
            key={m.id}
            className="flex-row items-center justify-between gap-2"
          >
            <View className="flex-row items-center gap-2">
              <View className="w-8 h-8 rounded-full bg-lavender items-center justify-center">
                <Text className="text-xs font-semibold text-brand">
                  {m.initials}
                </Text>
              </View>
              <Text className="text-sm text-ink">{m.name}</Text>
            </View>
            <View className="flex-row items-center gap-1">
              <Text className="text-xs text-muted">{currencyCode}</Text>
              <TextInput
                keyboardType="decimal-pad"
                value={customAmounts[m.id] ?? ""}
                onChangeText={(v) => onChangeAmount(m.id, sanitizeAmount(v, decimals))}
                placeholder={decimals > 0 ? "0.00" : "0"}
                className="w-24 rounded-lg border border-line bg-white px-2 py-1.5 text-right text-ink"
              />
            </View>
          </View>
        ))}
        {total <= 0 ? (
          <Text className="text-xs text-muted">Enter the total amount first.</Text>
        ) : (
          <Text
            className={`text-xs font-semibold ${
              matched ? "text-success" : over ? "text-danger" : "text-muted"
            }`}
          >
            {matched
              ? `Assigned ${formatMoney(total, currencyCode, decimals)} of ${formatMoney(total, currencyCode, decimals)}. All set.`
              : over
                ? `Over by ${formatMoney(-remaining, currencyCode, decimals)}`
                : `Remaining ${formatMoney(remaining, currencyCode, decimals)}`}
          </Text>
        )}
      </View>
    );
  }

  // evenly: toggleable avatar row
  return (
    <View className="flex-row gap-2 flex-wrap">
      {members.map((m) => {
        const active = selectedIds.includes(m.id);
        return (
          <Pressable
            key={m.id}
            onPress={() => onToggleMember(m.id)}
            className={`w-10 h-10 rounded-full items-center justify-center border-2 ${
              active ? "border-brand bg-lavender" : "border-line bg-white opacity-50"
            }`}
          >
            <Text className="text-xs font-semibold text-brand">
              {m.initials}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}