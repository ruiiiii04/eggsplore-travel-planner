import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Compass } from "lucide-react-native";
import { Heading } from "@/components/ui/Screen";
import { colors } from "@/styles/theme";
import TripMap from "./components/TripMap";
import PlaceDetailsSheet from "./components/PlaceDetailsSheet";
import { samplePlaces } from "./data/samplePlaces";
import type { SamplePlace } from "./types";

export default function MapScreen() {
  const [selectedPlace, setSelectedPlace] = useState<SamplePlace | null>(null);
  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Compass size={26} color={colors.brand} />
          <Heading>Explore Map</Heading>
        </View>
        <Text style={styles.subtitle}>
          Osaka · {samplePlaces.length} sample places
        </Text>
        <Text style={styles.caption}>
          Explore a place to see its details. Sample data is not linked to your
          trips.
        </Text>
      </View>
      <View style={styles.map}>
        <TripMap
          places={samplePlaces}
          selectedPlaceId={selectedPlace?.id ?? null}
          onSelectPlace={setSelectedPlace}
        />
      </View>
      {selectedPlace && (
        <PlaceDetailsSheet
          key={selectedPlace.id}
          place={selectedPlace}
          onClose={() => setSelectedPlace(null)}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 16, gap: 8 },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  subtitle: { color: colors.brand, fontSize: 15, fontWeight: "600" },
  caption: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  map: { flex: 1 },
});

