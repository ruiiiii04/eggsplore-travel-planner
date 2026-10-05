import { useState } from "react";
import {
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import type { GestureResponderHandlers } from "react-native";
import {
  Camera,
  ChevronUp,
  Clock3,
  Footprints,
  Leaf,
  MapPin,
  Plus,
  Sparkles,
  Star,
} from "lucide-react-native";

import { BottomSheet } from "@/components/ui/BottomSheet";
import { placePhotos, samplePlaces } from "../data/samplePlaces";
import type { SamplePlace } from "../types";

type Props = {
  place: SamplePlace;
  expanded: boolean;
  onToggle: () => void;
  onAdd: () => void;
  onSelectPlace: (place: SamplePlace) => void;

  // NEW: resize gestures provided by MapScreen.
  dragHandlers?: GestureResponderHandlers;
};

function Photo({ place }: { place: SamplePlace }) {
  const [failed, setFailed] = useState(false);
  const photo = placePhotos[place.id];

  if (!photo || failed) {
    return (
      <View style={s.photoFallback}>
        <Camera size={24} color="#A988C6" />
      </View>
    );
  }

  return (
    <Image
      source={{ uri: photo.uri }}
      resizeMode="cover"
      style={StyleSheet.absoluteFill}
      accessibilityLabel={place.name}
      onError={() => setFailed(true)}
    />
  );
}

export default function PlaceDetailsSheet({
  place,
  expanded,
  onToggle,
  onAdd,
  onSelectPlace,
  dragHandlers,
}: Props) {
  const [dialog, setDialog] = useState<"ai" | "photos" | null>(null);
  const [linkError, setLinkError] = useState(false);

  const gallery = [
    place,
    ...samplePlaces.filter((item) => item.id !== place.id),
  ];

  const openLink = (url: string) => {
    setLinkError(false);
    void Linking.openURL(url).catch(() => setLinkError(true));
  };

  return (
    <View style={s.sheet}>
      {/* CHANGED: drag this handle area to resize the panel. */}
      <View style={s.handleArea} {...dragHandlers}>
        <TouchableOpacity
          onPress={onToggle}
          style={s.handleButton}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={
            expanded ? "Collapse place details" : "Expand place details"
          }
          accessibilityHint="Tap to toggle, or drag vertically to resize"
          accessibilityState={{ expanded }}
        >
          <View style={s.handle} />
        </TouchableOpacity>
      </View>

      {expanded ? (
        <>
          <ScrollView
            style={s.detailsScroll}
            contentContainerStyle={s.content}
            showsVerticalScrollIndicator={false}
          >
            <View style={s.photos}>
              {gallery.map((item, index) => (
                <TouchableOpacity
                  key={item.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Explore ${item.name}`}
                  activeOpacity={0.85}
                  style={[s.photo, { flex: index === 0 ? 2.6 : 1 }]}
                  onPress={() => onSelectPlace(item)}
                >
                  <Photo place={item} />
                </TouchableOpacity>
              ))}

              <TouchableOpacity
                style={s.morePhotos}
                accessibilityRole="button"
                accessibilityLabel="Osaka photo information and credits"
                onPress={() => setDialog("photos")}
              >
                <Camera size={17} color="#8050B2" />
                <Text style={s.moreText}>3</Text>
              </TouchableOpacity>
            </View>

            <Text style={s.galleryNote}>
              Osaka photos · tap to explore
            </Text>

            <View style={s.titleRow}>
              <MapPin size={24} color="#8050B2" fill="#EEE4F8" />
              <Text style={s.title}>{place.name}</Text>
            </View>

            <Text style={s.demo}>
              DEMO DETAILS · values below are illustrative
            </Text>

            <View style={s.row}>
              <Star size={17} color="#FFB520" fill="#FFB520" />
              <Text style={s.strong}>4.7</Text>
              <Text style={s.small}>(1.2k reviews)</Text>
              <Text style={s.dot}>•</Text>
              <Clock3 size={16} color="#8050B2" />
              <Text style={s.strong}>Open</Text>
              <Text style={s.small}>· Closes 9 PM</Text>
            </View>

            <View style={s.row}>
              <Footprints size={17} color="#8050B2" />
              <Text style={s.strong}>1.2 km</Text>
              <Text style={s.small}>· 8 min walk</Text>
            </View>

            <View style={s.tags}>
              {place.tags.map((tag) => (
                <View key={tag} style={s.tag}>
                  <MapPin size={12} color="#9477AA" />
                  <Text style={s.tagText}>{tag}</Text>
                </View>
              ))}

              <View style={s.tag}>
                <Camera size={12} color="#9477AA" />
                <Text style={s.tagText}>Photo Spot</Text>
              </View>
            </View>

            <View style={s.insight}>
              <Leaf size={19} color="#69AD7E" />
              <Text style={s.insightText}>
                Demo tip: visit before lunch for a quieter stop.
              </Text>
            </View>
          </ScrollView>

          <View style={s.actions}>
            <TouchableOpacity
              style={s.ask}
              accessibilityRole="button"
              onPress={() => setDialog("ai")}
              activeOpacity={0.8}
            >
              <Sparkles size={17} color="white" />
              <Text style={s.askText}>Ask AI</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={s.add}
              accessibilityRole="button"
              onPress={onAdd}
              activeOpacity={0.8}
            >
              <Plus size={19} color="#8050B2" />
              <Text style={s.addText}>Add to Itinerary</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <TouchableOpacity
          style={s.collapsed}
          accessibilityRole="button"
          accessibilityLabel={`Expand details for ${place.name}`}
          onPress={onToggle}
        >
          <MapPin size={21} color="#8050B2" />
          <Text numberOfLines={1} style={s.collapsedTitle}>
            {place.name}
          </Text>
          <ChevronUp size={20} color="#8050B2" />
        </TouchableOpacity>
      )}

      <BottomSheet
        visible={dialog !== null}
        title={
          dialog === "photos"
            ? "Osaka photo credits"
            : `Ask AI · ${place.name}`
        }
        onClose={() => setDialog(null)}
      >
        {dialog === "photos" ? (
          <>
            <Text style={s.dialogText}>
              These photos show the three sample Osaka places.
              Thumbnails are cropped to fit; they are not all photos
              of the selected place.
            </Text>

            {samplePlaces.map((item) => {
              const photo = placePhotos[item.id];

              if (!photo) return null;

              return (
                <View key={item.id} style={{ gap: 4 }}>
                  <Text style={s.strong}>{item.name}</Text>
                  <Text style={s.small}>{photo.credit}</Text>

                  <TouchableOpacity
                    accessibilityRole="link"
                    onPress={() => openLink(photo.source)}
                  >
                    <Text style={s.creditLink}>Photo source</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    accessibilityRole="link"
                    onPress={() => openLink(photo.license)}
                  >
                    <Text style={s.creditLink}>Photo license</Text>
                  </TouchableOpacity>
                </View>
              );
            })}

            {linkError && (
              <Text style={s.dialogText}>
                Could not open the link. Please try again.
              </Text>
            )}
          </>
        ) : (
          <Text style={s.dialogText}>
            Ask AI about {place.name} will be connected in a later
            milestone. No AI request has been sent.
          </Text>
        )}
      </BottomSheet>
    </View>
  );
}

const s = StyleSheet.create({
  sheet: {
    flex: 1,
    backgroundColor: "#FCFAFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderColor: "#EEE5F5",
    overflow: "hidden",
  },

  // NEW: stable, larger handle area.
  handleArea: { flexShrink: 0 },
  handleButton: {
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  handle: {
    width: 34,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#C5A0E4",
  },

  // NEW: content shrinks as the panel is dragged down.
  detailsScroll: { flex: 1, minHeight: 0 },

  content: { paddingHorizontal: 16, paddingBottom: 8, gap: 6 },
  photos: { flexDirection: "row", height: 72, gap: 8 },
  photo: {
    overflow: "hidden",
    borderRadius: 10,
    backgroundColor: "#EEE5F6",
  },
  photoFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  morePhotos: {
    width: 32,
    borderRadius: 12,
    backgroundColor: "#F0E6FB",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  moreText: { color: "#8050B2", fontWeight: "700" },
  galleryNote: { fontSize: 9, color: "#8A789D" },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  title: {
    flex: 1,
    fontSize: 23,
    fontWeight: "700",
    color: "#4B285F",
    lineHeight: 29,
  },
  demo: { fontSize: 8, color: "#887498", letterSpacing: 0.5 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    flexWrap: "wrap",
  },
  strong: { color: "#624375", fontSize: 12, fontWeight: "600" },
  small: { color: "#86718F", fontSize: 11 },
  dot: { color: "#DBCAE9" },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 5 },
  tag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F3EDF9",
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 14,
  },
  tagText: { color: "#9279A6", fontSize: 10 },
  insight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F3EDF9",
    padding: 7,
    borderRadius: 7,
  },
  insightText: {
    color: "#553B6A",
    fontSize: 11,
    flex: 1,
    lineHeight: 16,
  },
  actions: {
    flexShrink: 0,
    paddingHorizontal: 16,
    paddingTop: 5,
    paddingBottom: 12,
    gap: 7,
  },
  ask: {
    minHeight: 42,
    backgroundColor: "#864DBF",
    borderRadius: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  askText: { color: "white", fontWeight: "600", fontSize: 14 },
  add: {
    minHeight: 40,
    borderWidth: 1,
    borderColor: "#C9A5E8",
    borderRadius: 24,
    backgroundColor: "white",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  addText: { color: "#8050B2", fontSize: 14, fontWeight: "600" },
  collapsed: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    paddingHorizontal: 18,
    paddingBottom: 14,
  },
  collapsedTitle: {
    flex: 1,
    color: "#4B285F",
    fontSize: 18,
    fontWeight: "700",
  },
  dialogText: { color: "#553B6A", fontSize: 14, lineHeight: 22 },
  creditLink: {
    color: "#8050B2",
    fontSize: 12,
    textDecorationLine: "underline",
    paddingVertical: 5,
  },
});