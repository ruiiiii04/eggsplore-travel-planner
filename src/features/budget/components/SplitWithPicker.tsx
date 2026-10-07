import { Pressable, Text, TextInput, View } from "react-native";
import type { SplitType } from "../model";

function sanitizeAmount(text: string): string {
  let cleaned = text.replace(/[^0-9.]/g, "");
  const parts = cleaned.split(".");
  if (parts.length > 2) cleaned = parts[0] + "." + parts.slice(1).join("");
  const [intPart, decPart] = cleaned.split(".");
  if (decPart !== undefined && decPart.length > 2) {
    cleaned = `${intPart}.${decPart.slice(0, 2)}`;
  }
  return cleaned;
}

export type Member = { id: string; name: string; initials: string };

type Props = {
  members: Member[];
  splitType: SplitType;
  selectedIds: string[];
  onToggleMember: (id: string) => void;
  customAmounts: Record<string, string>;
  onChangeAmount: (id: string, value: string) => void;
};

export function SplitWithPicker({
  members,
  splitType,
  selectedIds,
  onToggleMember,
  customAmounts,
  onChangeAmount,
}: Props) {
  if (splitType === "none") {
    return (
      <Text className="text-sm text-muted">
        Only you will be charged for this expense.
      </Text>
    );
  }

  if (splitType === "amount") {
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
              <Text className="text-xs text-muted">RM</Text>
              <TextInput
                keyboardType="decimal-pad"
                value={customAmounts[m.id] ?? ""}
                onChangeText={(v) => onChangeAmount(m.id, sanitizeAmount(v))}
                placeholder="0.00"
                className="w-20 rounded-lg border border-line bg-white px-2 py-1.5 text-right text-ink"
              />
            </View>
          </View>
        ))}
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