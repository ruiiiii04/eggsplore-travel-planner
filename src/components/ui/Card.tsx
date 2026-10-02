import { View, type ViewProps } from "react-native";
export function Card({ className = "", ...props }: ViewProps) {
  return (
    <View
      {...props}
      className={`rounded-lg border border-line bg-white p-4 gap-3 ${className}`}
    />
  );
}
