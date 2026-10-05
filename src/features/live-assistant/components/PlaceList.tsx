import { TouchableOpacity, StyleSheet, Text, View } from "react-native";
import { ChevronRight, MapPin } from "lucide-react-native";
import { colors } from "@/styles/theme";
import type { TripMapProps } from "../types";

export default function PlaceList({
  places,
  selectedPlaceId,
  onSelectPlace,
}: TripMapProps) {
  return (
    <View style={styles.list}>
      {places.map((place) => (
        <TouchableOpacity
          key={place.id}
          accessibilityRole="button"
          accessibilityLabel={`View ${place.name}`}
          accessibilityState={{ selected: place.id === selectedPlaceId }}
          onPress={() => onSelectPlace(place)}
          activeOpacity={0.75}
          style={styles.row}
        >
          <MapPin size={23} color={colors.brand} />
          <View style={styles.copy}>
            <Text style={styles.name}>{place.name}</Text>
            <Text style={styles.meta}>{place.tags.join(" · ")}</Text>
          </View>
          <ChevronRight size={20} color={colors.brand} />
        </TouchableOpacity>
      ))}
      {places.length === 0 && (
        <Text style={styles.meta}>No places to display.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 10 },
  row: {
    minHeight: 68,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.white,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  copy: { flex: 1, gap: 4 },
  name: { color: colors.ink, fontSize: 16, fontWeight: "600" },
  meta: { color: colors.muted, fontSize: 13, lineHeight: 20 },
});
