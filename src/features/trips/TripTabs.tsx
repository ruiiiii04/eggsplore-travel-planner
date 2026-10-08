import { Pressable, Text, View } from "react-native";
import { CalendarDays, CreditCard, Users } from "lucide-react-native";

export type TripTabKey = "itinerary" | "candidates" | "budget";

const TABS = [
  { key: "itinerary", label: "Itinerary", Icon: CalendarDays },
  { key: "candidates", label: "Candidates & Vote", Icon: Users },
  { key: "budget", label: "Budget", Icon: CreditCard },
] as const;

type Props = {
  active: TripTabKey;
  onSelect?: (key: TripTabKey) => void;
};

export function TripTabs({ active, onSelect }: Props) {
  return (
    <View className="flex-row rounded-full border border-line bg-lavender p-1">
      {TABS.map(({ key, label, Icon }) => {
        const selected = key === active;
        return (
          <Pressable
            key={key}
            onPress={() => onSelect?.(key)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            className={`flex-1 flex-row items-center justify-center gap-1.5 rounded-full px-2 py-2.5 ${
              selected ? "bg-brand" : ""
            }`}
          >
            <Icon size={16} color={selected ? "#FFFFFF" : "#817493"} />
            <Text
              numberOfLines={1}
              className={`text-xs font-semibold ${
                selected ? "text-white" : "text-muted"
              }`}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}