import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Map } from "lucide-react-native";
import { colors } from "@/styles/theme";
import PlaceList from "./PlaceList";
import type { TripMapProps } from "../types";

export default function MapFallback({
  reason,
  ...props
}: TripMapProps & { reason: string }) {
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.notice}>
        <Map size={32} color={colors.brand} />
        <Text accessibilityRole="header" style={styles.title}>
          Place preview
        </Text>
        <Text style={styles.description}>{reason}</Text>
        <Text style={styles.description}>
          Select a sample place below to try its details sheet.
        </Text>
      </View>
      <PlaceList {...props} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 20, paddingBottom: 32 },
  notice: {
    padding: 24,
    borderRadius: 20,
    backgroundColor: colors.lavender,
    gap: 12,
  },
  title: { color: colors.ink, fontSize: 20, fontWeight: "700" },
  description: { color: colors.ink, fontSize: 14, lineHeight: 22 },
});
