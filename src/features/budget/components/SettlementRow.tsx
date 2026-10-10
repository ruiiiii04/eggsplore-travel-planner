import { Pressable, Text, View } from "react-native";
import { Card } from "@/components/ui";

type Props = {
  owesName: string | null;
  amount: number;
  currency?: string;
  onPress?: () => void;
};

export function SettlementRow({ owesName, amount, currency = "RM", onPress }: Props) {
  if (!owesName || amount <= 0) {
    return (
      <Card>
        <Text className="text-sm text-success font-semibold">
          You're all settled up
        </Text>
      </Card>
    );
  }

  return (
    <Pressable onPress={onPress}>
      <Card className="flex-row items-center justify-between">
        <View>
          <Text className="text-base font-semibold text-ink">
            You owe {owesName} {currency}
            {amount.toLocaleString()}
          </Text>
          <Text className="text-xs text-muted">Settlement due after trip</Text>
        </View>
        <Text className="text-muted">{">"}</Text>
      </Card>
    </Pressable>
  );
}