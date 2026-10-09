import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import type { GestureResponderHandlers } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Camera,
  CalendarDays,
  ChevronUp,
  MapPin,
  Plus,
  Sparkles,
  X,
  RotateCcw,
} from "lucide-react-native";
import { useAuth } from "@/features/auth/useAuth";
import { usePlaceDetails } from "../hooks/usePlaceDetails";
import AssistantChat from "./AssistantChat";
import type { PlacePhoto, SamplePlace } from "../types";

type Props = {
  place: SamplePlace;
  expanded: boolean;
  onToggle: () => void;
  onAdd: () => void;
  dragHandlers?: GestureResponderHandlers;
};

// CHANGED: no gallery of other places and no onSelectPlace photo action.
function Photo({
  photo,
  large = false,
}: {
  photo: PlacePhoto;
  large?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  return failed ? (
    <View style={s.photoFallback}>
      <Camera size={28} color="#A988C6" />
      <Text style={s.small}>Photo unavailable</Text>
    </View>
  ) : (
    <Image
      source={{ uri: photo.url }}
      resizeMode={large ? "contain" : "cover"}
      style={StyleSheet.absoluteFill}
      accessibilityLabel={photo.caption}
      onError={() => setFailed(true)}
    />
  );
}
export default function PlaceDetailsSheet({
  place,
  expanded,
  onToggle,
  onAdd,
  dragHandlers,
}: Props) {
  const { user } = useAuth();
  const { data, loading, error, retry } = usePlaceDetails(place.id);
  const [chatOpen, setChatOpen] = useState(false);
  const [viewing, setViewing] = useState<PlacePhoto | null>(null);
  const [linkError, setLinkError] = useState(false);
  const openLink = (url: string) => {
    setLinkError(false);
    void Linking.openURL(url).catch(() => setLinkError(true));
  };
  return (
    <View style={s.sheet}>
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
            {/* CHANGED: photos and article text are fetched for this exact place. */}
            {loading ? (
              <View style={s.loading}>
                <ActivityIndicator color="#7E49C2" />
                <Text style={s.small}>Loading {place.name}…</Text>
              </View>
            ) : data?.photos.length ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.photos}
              >
                {data.photos.map((photo) => (
                  <View key={photo.id} style={s.photoCard}>
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel={`Open photo of ${place.name}`}
                      style={s.photo}
                      onPress={() => {
                        setLinkError(false);
                        setViewing(photo);
                      }}
                    >
                      <Photo photo={photo} />
                      <View style={s.photoBadge}>
                        <Camera size={14} color="white" />
                        <Text style={s.photoBadgeText}>View</Text>
                      </View>
                    </TouchableOpacity>
                    {/* Attribution stays visible beside the thumbnail, not just in a modal. */}
                    <Text style={s.credit}>
                      {photo.author} · {photo.license} · cropped preview
                    </Text>
                    <View style={s.links}>
                      <TouchableOpacity
                        accessibilityRole="link"
                        onPress={() => openLink(photo.sourceUrl)}
                      >
                        <Text style={s.link}>Photo source</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        accessibilityRole="link"
                        onPress={() => openLink(photo.licenseUrl)}
                      >
                        <Text style={s.link}>License</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </ScrollView>
            ) : (
              <View style={s.photoEmpty}>
                <Camera size={24} color="#A988C6" />
                <Text style={s.small}>
                  {data?.photoNotice ?? (error ? "Place service unavailable" : "Photo unavailable")}
                </Text>
                {data?.photoNotice && (
                  <TouchableOpacity accessibilityRole="button" onPress={retry} style={s.retry}>
                    <RotateCcw size={16} color="#8050B2" />
                    <Text style={s.link}>Retry photo</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
            <View style={s.titleRow}>
              <MapPin size={23} color="#8050B2" />
              <Text style={s.title}>{place.name}</Text>
            </View>
            <Text style={s.small}>{place.area}</Text>
            <View style={s.tags}>
              {place.tags.map((tag) => (
                <View key={tag} style={s.tag}>
                  <Text style={s.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
            {error && (
              <View style={s.errorBox}>
                <Text accessibilityRole="alert" style={s.error}>
                  {error}
                </Text>
                <TouchableOpacity
                  style={s.retry}
                  accessibilityRole="button"
                  onPress={retry}
                >
                  <RotateCcw size={16} color="#8050B2" />
                  <Text style={s.link}>Retry details</Text>
                </TouchableOpacity>
              </View>
            )}
            {data && (
              <>
                {data.sourceLanguage === "ja" && (
                  <Text style={s.note}>
                    Source available in Japanese. Ask AI to explain it in your
                    language.
                  </Text>
                )}
                <Text style={s.description}>
                  {data.description ||
                    "No description is available from this source."}
                </Text>
                <View style={s.links}>
                  <TouchableOpacity
                    accessibilityRole="link"
                    onPress={() => openLink(data.sourceUrl)}
                  >
                    <Text style={s.link}>
                      Wikipedia contributors · excerpt{" "}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    accessibilityRole="link"
                    onPress={() => openLink(data.textLicenseUrl)}
                  >
                    <Text style={s.link}>Text: CC BY-SA 4.0</Text>
                  </TouchableOpacity>
                </View>
                {data.photoNotice && (
                  <TouchableOpacity
                    style={s.retry}
                    accessibilityRole="button"
                    onPress={retry}
                  >
                    <RotateCcw size={16} color="#8050B2" />
                    <Text style={s.link}>Retry photo</Text>
                  </TouchableOpacity>
                )}
              </>
            )}
            {place.description ? (
              <View style={{ gap: 4 }}>
                <Text style={s.description}>{place.description}</Text>
              </View>
            ) : null}
            {!loading && !data && (
              <Text style={s.description}>
                Online information could not be loaded. You can retry or ask the
                assistant for general travel advice.
              </Text>
            )}
            {/* CHANGED: remove fabricated reviews, opening hours, walking time and crowd advice. */}
            <Text style={s.note}>
              Live opening hours, ratings and walking directions are not
              available yet.
            </Text>
            {linkError && (
              <Text style={s.error}>
                Could not open the link. Please try again.
              </Text>
            )}
          </ScrollView>
          <View style={s.actions}>
            <TouchableOpacity
              style={s.ask}
              accessibilityRole="button"
              onPress={() => setChatOpen(true)}
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
              <>
                {place.tripId ? (
                  <CalendarDays size={19} color="#8050B2" />
                ) : (
                  <Plus size={19} color="#8050B2" />
                )}
              </>
              <Text style={s.addText}>
                {place.tripId ? "View itinerary" : "Add to Itinerary"}
              </Text>
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
      {/* NEW: real Gemini chat; close/unmount clears memory and cancels the client request. */}
      {chatOpen && (
        <AssistantChat
          key={`${user?.id ?? "signed-out"}:${place.id}`}
          place={place}
          onClose={() => setChatOpen(false)}
        />
      )}
      {/* NEW: tapping a photo opens it, without changing the selected location. */}
      {viewing && (
        <Modal
          visible
          animationType="fade"
          onRequestClose={() => setViewing(null)}
        >
          <SafeAreaView style={s.viewer}>
            <View style={s.viewerHeader}>
              <Text style={s.viewerTitle}>{place.name}</Text>
              <TouchableOpacity
                style={s.close}
                accessibilityRole="button"
                accessibilityLabel="Close photo"
                onPress={() => setViewing(null)}
              >
                <X size={24} color="white" />
              </TouchableOpacity>
            </View>
            <View style={s.viewerImage}>
              <Photo key={viewing.id} photo={viewing} large />
            </View>
            <ScrollView
              style={s.viewerCredits}
              contentContainerStyle={{ padding: 18, gap: 6 }}
            >
              <Text style={s.viewerText}>{viewing.caption}</Text>
              <Text style={s.viewerText}>
                {viewing.author} · {viewing.license}
              </Text>
              <TouchableOpacity
                accessibilityRole="link"
                onPress={() => openLink(viewing.sourceUrl)}
              >
                <Text style={s.viewerLink}>Photo source and attribution</Text>
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityRole="link"
                onPress={() => openLink(viewing.licenseUrl)}
              >
                <Text style={s.viewerLink}>Photo license</Text>
              </TouchableOpacity>
              {linkError && (
                <Text style={s.viewerText}>Could not open the link.</Text>
              )}
            </ScrollView>
          </SafeAreaView>
        </Modal>
      )}
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
  handleArea: { flexShrink: 0 },
  handleButton: { height: 32, alignItems: "center", justifyContent: "center" },
  handle: { width: 34, height: 4, borderRadius: 2, backgroundColor: "#C5A0E4" },
  detailsScroll: { flex: 1, minHeight: 0 },
  content: { paddingHorizontal: 16, paddingBottom: 12, gap: 8 },
  loading: {
    minHeight: 100,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  photos: { gap: 12 },
  photoCard: { width: 260, gap: 3 },
  photo: {
    height: 125,
    overflow: "hidden",
    borderRadius: 12,
    backgroundColor: "#EEE5F6",
  },
  photoFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  photoEmpty: {
    minHeight: 75,
    padding: 12,
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: "#F3EDF9",
  },
  photoBadge: {
    position: "absolute",
    bottom: 8,
    right: 8,
    padding: 6,
    borderRadius: 12,
    backgroundColor: "#4E2867",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  photoBadgeText: { color: "white", fontSize: 10 },
  credit: { fontSize: 10, color: "#817493", lineHeight: 14 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  title: {
    flex: 1,
    fontSize: 23,
    fontWeight: "700",
    color: "#4B285F",
    lineHeight: 29,
  },
  small: { color: "#86718F", fontSize: 11, lineHeight: 16 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 5 },
  tag: {
    backgroundColor: "#F3EDF9",
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 14,
  },
  tagText: { color: "#9279A6", fontSize: 11 },
  description: { color: "#553B6A", fontSize: 13, lineHeight: 21 },
  note: {
    color: "#817493",
    fontSize: 11,
    lineHeight: 16,
    backgroundColor: "#F3EDF9",
    padding: 9,
    borderRadius: 8,
  },
  links: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  link: {
    color: "#8050B2",
    fontSize: 11,
    textDecorationLine: "underline",
    paddingVertical: 5,
  },
  errorBox: { gap: 6 },
  error: { color: "#9F254B", fontSize: 12, lineHeight: 18 },
  retry: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 36 },
  actions: {
    flexShrink: 0,
    paddingHorizontal: 16,
    paddingTop: 5,
    paddingBottom: 12,
    gap: 7,
  },
  ask: {
    minHeight: 44,
    backgroundColor: "#864DBF",
    borderRadius: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  askText: { color: "white", fontWeight: "600", fontSize: 14 },
  add: {
    minHeight: 44,
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
  viewer: { flex: 1, backgroundColor: "#20152B" },
  viewerHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    gap: 12,
  },
  viewerTitle: { flex: 1, color: "white", fontSize: 18, fontWeight: "600" },
  close: { padding: 14 },
  viewerImage: { flex: 1 },
  viewerCredits: { maxHeight: "32%" },
  viewerText: { color: "#E0D3EC", fontSize: 12, lineHeight: 18 },
  viewerLink: {
    color: "#D7BDED",
    fontSize: 12,
    paddingVertical: 6,
    textDecorationLine: "underline",
  },
});
