import { Pressable, Text, View } from "react-native";
import type { ExpenseCategory } from "../model";

const CATEGORIES: { key: ExpenseCategory; label: string; emoji: string }[] = [
  { key: "food", label: "Food", emoji: "☕" },
  { key: "transport", label: "Transport", emoji: "🚗" },
  { key: "stay", label: "Stay", emoji: "🏠" },
  { key: "activities", label: "Activities", emoji: "🖼️" },
  { key: "shopping", label: "Shopping", emoji: "🛍️" },
  { key: "other", label: "Other", emoji: "⋯" },
];

type Props = {
  value: ExpenseCategory | null;
  onChange: (category: ExpenseCategory) => void;
};

export function CategoryPicker({ value, onChange }: Props) {
  return (
    <View className="flex-row justify-between">
      {CATEGORIES.map((c) => (
        <Pressable
          key={c.key}
          onPress={() => onChange(c.key)}
          className="items-center gap-1"
        >
          <View
            className={`w-12 h-12 rounded-full items-center justify-center ${
              value === c.key ? "bg-brand" : "bg-lavender"
            }`}
          >
            <Text className="text-lg">{c.emoji}</Text>
          </View>
          <Text className="text-xs text-ink">{c.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}