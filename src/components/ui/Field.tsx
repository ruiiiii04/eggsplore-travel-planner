import { Text, TextInput, View, type TextInputProps } from "react-native";
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View className="gap-2">
      <Text className="text-sm font-semibold text-ink">{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor="#817493"
        autoCapitalize="sentences"
        {...props}
        className="min-h-12 rounded-lg border border-line bg-white px-4 py-3 text-base text-ink"
      />
    </View>
  );
}
