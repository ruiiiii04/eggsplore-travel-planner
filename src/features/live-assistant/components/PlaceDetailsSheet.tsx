import { useState } from "react";
import { TouchableOpacity, StyleSheet, Text, View } from "react-native";
import { Info, MapPin, Sparkles } from "lucide-react-native";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { colors } from "@/styles/theme";
import type { SamplePlace } from "../types";

export default function PlaceDetailsSheet({
  place,
  onClose,
}: {
  place: SamplePlace;
  onClose: () => void;
}) {
  const [showAiNotice, setShowAiNotice] = useState(false);
  return (
    <BottomSheet visible title={place.name} onClose={onClose}>
      <View style={styles.location}>
        <MapPin size={18} color={colors.brand} />
        <Text style={styles.body}>{place.area}</Text>
      </View>
      <View style={styles.tags}>
        {place.tags.map((tag) => (
          <Text key={tag} style={styles.tag}>
            {tag}
          </Text>
        ))}
      </View>
      <Text style={styles.body}>{place.description}</Text>
      <Text style={styles.caption}>
        Sample place · approximate coordinates{"\n"}
        {place.latitude.toFixed(4)}, {place.longitude.toFixed(4)}
      </Text>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={`Ask AI about ${place.name}`}
        accessibilityHint="Shows the current availability of Ask AI"
        onPress={() => setShowAiNotice(true)}
        activeOpacity={0.8}
        style={styles.ask}
      >
        <Sparkles size={21} color={colors.white} />
        <Text style={styles.askText}>Ask AI</Text>
      </TouchableOpacity>
      {showAiNotice && (
        <View style={styles.notice}>
          <Info size={20} color={colors.brand} />
          <Text
            accessibilityLiveRegion="polite"
            style={[styles.body, { flex: 1 }]}
          >
            Ask AI is not connected yet. Questions about {place.name} will be
            available in a later milestone.
          </Text>
        </View>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  location: { flexDirection: "row", alignItems: "center", gap: 8 },
  body: { color: colors.ink, fontSize: 15, lineHeight: 23, flexShrink: 1 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tag: {
    color: colors.brand,
    backgroundColor: colors.lavender,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    fontSize: 13,
    fontWeight: "600",
  },
  caption: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  ask: {
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: 14,
    borderRadius: 14,
    backgroundColor: colors.brand,
  },
  askText: { color: colors.white, fontSize: 16, fontWeight: "700" },
  notice: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 14,
    borderRadius: 14,
    backgroundColor: colors.lavender,
    gap: 10,
  },
});
