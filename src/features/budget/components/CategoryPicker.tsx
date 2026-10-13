import { Pressable, Text, View } from "react-native";
import type { ExpenseCategory } from "../model";
import { EXPENSE_CATEGORIES } from "./expenseCategories";

type Props = {
  value: ExpenseCategory | null;
  onChange: (category: ExpenseCategory) => void;
};

export function CategoryPicker({ value, onChange }: Props) {
  return (
    <View className="flex-row flex-wrap gap-y-3">
      {EXPENSE_CATEGORIES.map(({ key, label, Icon }) => {
        const selected = value === key;
        return (
          <Pressable
            key={key}
            onPress={() => onChange(key)}
            accessibilityRole="button"
            accessibilityLabel={`${label} category`}
            accessibilityState={{ selected }}
            className="w-1/3 items-center gap-1"
          >
            <View
              className={`h-11 w-11 items-center justify-center rounded-2xl border ${selected ? "border-brand bg-brand" : "border-line bg-lavender"}`}
            >
              <Icon
                size={19}
                color={selected ? "white" : "#8050C5"}
                strokeWidth={2}
              />
            </View>
            <Text
              className={`text-xs ${selected ? "font-semibold text-brand" : "text-muted"}`}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
