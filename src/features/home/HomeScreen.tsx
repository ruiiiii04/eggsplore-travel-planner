import { useState } from "react";
import {
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { router } from "expo-router";
import {
  Bell,
  CalendarDays,
  MapPin,
  Plus,
  Sparkles,
  Star,
  UsersRound,
} from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BottomSheet, Message } from "@/components/ui";
import { useTrips } from "@/features/trips/useTrips";
import { tripStatus, type TripStatus } from "@/features/trips/model";
import type { Trip } from "@/features/trips/model";

const purple = "#7C4DBE";
const ink = "#3B1454";
const muted = "#7A6B8A";
const border = "#E4D9F0";

const tripArtwork = [
  {
    matches: ["bali", "indonesia"],
    image: require("../../../assets/trip-bali-cover.png"),
  },
  {
    matches: ["japan", "tokyo", "kyoto", "osaka", "hokkaido"],
    image: require("../../../assets/trip-japan-cover.png"),
  },
];

function resolveTripCover(trip: Trip) {
  const savedUrl = trip.cover_url?.trim();
  if (savedUrl && /^https:\/\//i.test(savedUrl)) return { uri: savedUrl };

  const destination = `${trip.destination ?? ""} ${trip.title}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  return tripArtwork.find(({ matches }) =>
    matches.some((match) => destination.includes(match)),
  )?.image;
}

function DestinationCard({
  trip,
  spacingAfter,
}: {
  trip: Trip;
  spacingAfter: boolean;
}) {
  const status = tripStatus(trip);
  const dates = trip.start_date
    ? formatTripDates(trip.start_date, trip.end_date)
    : "Dates to be decided";
  const cover = resolveTripCover(trip);
  const badgeColor =
    status === "Live" ? "#4CAF7D" : status === "Upcoming" ? purple : muted;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${trip.title}`}
      onPress={() =>
        router.push({ pathname: "/trips/[id]", params: { id: trip.id } })
      }
      style={[styles.tripCard, spacingAfter && styles.tripCardSpacing]}
    >
      <View style={[styles.tripPhoto, !cover && styles.tripPhotoFallback]}>
        {cover ? (
          <Image source={cover} resizeMode="cover" style={styles.tripCover} />
        ) : (
          <MapPin
            size={88}
            color="#B891DF"
            strokeWidth={1.2}
            style={styles.fallbackMapPin}
          />
        )}
        <View
          style={[styles.photoShade, !cover && styles.fallbackPhotoShade]}
        />
        <View style={styles.livePill}>
          <View style={[styles.liveDot, { backgroundColor: badgeColor }]} />
          <Text style={[styles.liveText, { color: badgeColor }]}>
            {status === "Live" ? "Live now" : status}
          </Text>
        </View>
        <View style={styles.tripCardBottom}>
          <Text
            numberOfLines={1}
            style={[styles.tripTitle, !cover && styles.fallbackTripTitle]}
          >
            {trip.destination || trip.title}
          </Text>
          <View style={styles.tripMetaRow}>
            <View style={styles.tripMetaLeft}>
              <View style={styles.tripMetaItem}>
                <CalendarDays size={14} color={cover ? "white" : purple} />
                <Text
                  numberOfLines={1}
                  style={[
                    styles.tripMetaText,
                    !cover && styles.fallbackMetaText,
                  ]}
                >
                  {dates}
                </Text>
              </View>
              <View style={styles.tripMetaItem}>
                <UsersRound size={14} color={cover ? "white" : purple} />
                <Text
                  style={[
                    styles.tripMetaText,
                    !cover && styles.fallbackMetaText,
                  ]}
                >
                  Travel group
                </Text>
              </View>
            </View>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

function formatTripDates(start: string, end: string | null): string {
  const format = (value: string) => {
    const date = new Date(`${value}T12:00:00`);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat("en", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(date);
  };
  if (!end) return format(start);

  const startDate = new Date(`${start}T12:00:00`);
  const endDate = new Date(`${end}T12:00:00`);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return `${start} - ${end}`;
  }
  const day = new Intl.DateTimeFormat("en", { day: "numeric" });
  if (
    startDate.getMonth() === endDate.getMonth() &&
    startDate.getFullYear() === endDate.getFullYear()
  ) {
    return `${day.format(startDate)} - ${format(end)}`;
  }
  return `${format(start)} - ${format(end)}`;
}

function QuickAccess({
  icon,
  label,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={styles.quickItem}
    >
      {icon}
      <Text style={styles.quickLabel}>{label.replace(/\\n/g, "\n")}</Text>
    </Pressable>
  );
}

export default function HomeScreen() {
  const { width: windowWidth } = useWindowDimensions();
  const heroScale = Math.min(windowWidth, 402) / 402;
  const [filter, setFilter] = useState<TripStatus>("Live");
  const [sheet, setSheet] = useState<string | null>(null);
  const { trips, loading, error, refresh } = useTrips();
  const visible = trips.filter((trip) => tripStatus(trip) === filter);

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={refresh}
            tintColor={purple}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.brandArea}>
            <Image
              source={require("../../../assets/home-brand-mark.png")}
              style={styles.brandMark}
            />
            <View>
              <Text style={styles.brandName}>EGGSPLORE</Text>
              <Text style={styles.brandTagline}>
                Smarter Trips, Happier You
              </Text>
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Notifications"
            onPress={() => setSheet("Notifications")}
            style={styles.bellButton}
          >
            <Bell size={24} color={purple} />
            <View style={styles.notificationDot} />
          </Pressable>
        </View>

        <View style={[styles.hero, { height: 131 * heroScale }]}>
          <Image
            source={require("../../../assets/home-hero-background.png")}
            resizeMode="contain"
            style={styles.heroBackground}
          />
          <Image
            source={require("../../../assets/home-hero-mascot.png")}
            resizeMode="contain"
            style={[
              styles.heroMascot,
              {
                width: 131 * heroScale,
                height: 103 * heroScale,
                right: 11 * heroScale,
                top: 28 * heroScale,
              },
            ]}
          />
          <View
            style={[
              styles.heroCopy,
              {
                paddingLeft: 12 * heroScale,
                paddingTop: 10 * heroScale,
                gap: 4 * heroScale,
              },
            ]}
          >
            <Text
              style={[
                styles.heroTitle,
                {
                  fontSize: 28 * heroScale,
                  lineHeight: 36 * heroScale,
                },
              ]}
            >
              Hi there!
            </Text>
            <Text
              style={[
                styles.heroSubtitle,
                {
                  fontSize: 12 * heroScale,
                  lineHeight: 18 * heroScale,
                  marginBottom: 8 * heroScale,
                },
              ]}
            >
              Where would you like to go next?
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push("/trips/create")}
              style={[
                styles.createButton,
                {
                  minWidth: 144 * heroScale,
                  height: 42 * heroScale,
                  paddingHorizontal: 20 * heroScale,
                  borderRadius: 24 * heroScale,
                  gap: 6 * heroScale,
                },
              ]}
            >
              <Plus size={17 * heroScale} color="white" strokeWidth={2.5} />
              <Text
                style={[
                  styles.createButtonText,
                  {
                    fontSize: 16 * heroScale,
                    lineHeight: 20 * heroScale,
                  },
                ]}
              >
                Create Trip
              </Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.body}>
          <View style={styles.filterBar}>
            {(["Live", "Upcoming", "Past"] as const).map((value) => (
              <Pressable
                key={value}
                accessibilityRole="button"
                accessibilityState={{ selected: filter === value }}
                onPress={() => setFilter(value)}
                style={[
                  styles.filterItem,
                  filter === value && styles.filterSelected,
                ]}
              >
                <Text
                  style={[
                    styles.filterText,
                    filter === value && styles.filterTextSelected,
                  ]}
                >
                  {value}
                </Text>
              </Pressable>
            ))}
          </View>

          {!!error && <Message error>{error}</Message>}
          {!!error && (
            <Pressable onPress={refresh} style={styles.retryButton}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          )}
          {visible.map((trip, index) => (
            <DestinationCard
              key={trip.id}
              trip={trip}
              spacingAfter={index < visible.length - 1}
            />
          ))}
          {!loading && !error && visible.length === 0 && (
            <View style={styles.emptyTrips}>
              <Text style={styles.emptyTitle}>
                No {filter.toLowerCase()} trips yet
              </Text>
              <Text style={styles.emptyDescription}>
                Create a trip and start planning together.
              </Text>
            </View>
          )}

          <Text style={styles.sectionTitle}>Quick access</Text>
          <View style={styles.quickRow}>
            <QuickAccess
              icon={<MapPin size={28} color={purple} strokeWidth={1.8} />}
              label="Explore\nMap"
              onPress={() => router.push("/map")}
            />
            <QuickAccess
              icon={<CalendarDays size={28} color={purple} strokeWidth={1.8} />}
              label="My\nItinerary"
              onPress={() => router.push("/trips")}
            />
            <QuickAccess
              icon={<Sparkles size={28} color={purple} strokeWidth={1.8} />}
              label="Consult\nAI"
              onPress={() => setSheet("AI Travel Assistant")}
            />
            <QuickAccess
              icon={<Star size={28} color={purple} strokeWidth={1.8} />}
              label="Trip\nPreference"
              onPress={() => router.push("/profile")}
            />
          </View>

          <View style={styles.newHereCard}>
            <Image
              source={require("../../../assets/home-new-here.png")}
              style={styles.newHereIcon}
            />
            <View style={styles.newHereCopy}>
              <Text style={styles.newHereTitle}>New here?</Text>
              <Text style={styles.newHereDescription}>
                Create your first trip and let Eggsplore handle the rest!
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Create your first trip"
              onPress={() => router.push("/trips/create")}
              style={styles.newHereButton}
            >
              <Plus size={20} color="white" />
            </Pressable>
          </View>
        </View>
      </ScrollView>
      <BottomSheet
        visible={!!sheet}
        title={sheet ?? ""}
        onClose={() => setSheet(null)}
      >
        <Message>
          {sheet === "Notifications"
            ? "No notifications yet. Live alerts are not connected in this foundation release."
            : "The AI assistant is planned for Module C. No AI request has been sent."}
        </Message>
      </BottomSheet>
    </SafeAreaView>
  );
}

const styles = {
  safeArea: { flex: 1, backgroundColor: "#FBF9FD" },
  scrollContent: {
    width: "100%" as const,
    maxWidth: 402,
    alignSelf: "center" as const,
    paddingBottom: 18,
  },
  header: {
    height: 64,
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
  },
  brandArea: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 12,
  },
  brandMark: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: "white",
  },
  brandName: {
    color: ink,
    fontFamily: "Fredoka",
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "700" as const,
  },
  brandTagline: { color: muted, fontSize: 11, lineHeight: 16 },
  bellButton: {
    width: 40,
    height: 40,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    position: "relative" as const,
  },
  notificationDot: {
    position: "absolute" as const,
    width: 8,
    height: 8,
    borderRadius: 4,
    top: 8,
    right: 8,
    backgroundColor: "#BD4C42",
    borderWidth: 1,
    borderColor: "#FBF9FD",
  },
  hero: {
    width: "100%" as const,
    marginTop: 10,
    overflow: "hidden" as const,
  },
  heroBackground: {
    position: "absolute" as const,
    left: 0,
    top: 0,
    width: "100%" as const,
    height: "100%" as const,
  },
  heroMascot: {
    position: "absolute" as const,
    width: 131,
    height: 103,
    right: 11,
    top: 28,
  },
  heroCopy: { paddingLeft: 12, paddingTop: 10, gap: 4 },
  heroTitle: {
    color: ink,
    fontFamily: "Fredoka",
    fontSize: 28,
    lineHeight: 36,
    fontWeight: "700" as const,
  },
  heroSubtitle: {
    color: muted,
    fontFamily: "Inter",
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 8,
  },
  createButton: {
    minWidth: 144,
    height: 42,
    paddingHorizontal: 20,
    alignSelf: "flex-start" as const,
    borderRadius: 24,
    backgroundColor: purple,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: 6,
    shadowColor: purple,
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  createButtonText: {
    color: "white",
    fontFamily: "Inter",
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "600" as const,
  },
  body: { paddingTop: 10, gap: 10 },
  filterBar: {
    height: 44,
    marginHorizontal: 16,
    padding: 4,
    borderRadius: 24,
    backgroundColor: "#EAE0F5",
    flexDirection: "row" as const,
    alignItems: "center" as const,
  },
  filterItem: {
    flex: 1,
    height: 36,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    borderRadius: 20,
  },
  filterSelected: {
    backgroundColor: purple,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  filterText: {
    color: muted,
    fontFamily: "Inter",
    fontSize: 16,
    fontWeight: "600" as const,
  },
  filterTextSelected: { color: "white" },
  tripCard: {
    height: 140,
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: border,
    borderRadius: 20,
    overflow: "hidden" as const,
    backgroundColor: "white",
    shadowColor: ink,
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  tripCardSpacing: { marginBottom: 6 },
  tripPhoto: {
    flex: 1,
    justifyContent: "space-between" as const,
    overflow: "hidden" as const,
  },
  tripPhotoFallback: { backgroundColor: "#F1E9F9" },
  tripCover: {
    position: "absolute" as const,
    left: 0,
    top: 0,
    width: "100%" as const,
    height: "100%" as const,
  },
  fallbackMapPin: {
    position: "absolute" as const,
    right: 24,
    top: 22,
    opacity: 0.45,
  },
  photoShade: {
    ...({
      ...{
        position: "absolute" as const,
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
      },
      backgroundColor: "rgba(0,0,0,0.34)",
    } as const),
  },
  fallbackPhotoShade: { backgroundColor: "rgba(241,233,249,0.1)" },
  livePill: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 6,
    alignSelf: "flex-start" as const,
    marginLeft: 12,
    marginTop: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.96)",
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#4CAF7D" },
  liveText: {
    color: "#4CAF7D",
    fontSize: 11,
    lineHeight: 13,
    fontWeight: "600" as const,
  },
  tripCardBottom: { paddingHorizontal: 16, paddingBottom: 14, gap: 5 },
  tripTitle: {
    color: "white",
    fontFamily: "Fredoka",
    fontSize: 20,
    lineHeight: 25,
    fontWeight: "600" as const,
  },
  fallbackTripTitle: { color: ink },
  tripMetaRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
  },
  tripMetaLeft: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 10,
    flexShrink: 1,
  },
  tripMetaItem: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 4,
    flexShrink: 1,
  },
  tripMetaText: {
    color: "white",
    fontFamily: "Inter",
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "500" as const,
    flexShrink: 1,
  },
  fallbackMetaText: { color: ink },
  emptyTrips: {
    height: 296,
    marginHorizontal: 16,
    paddingHorizontal: 20,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: 4,
  },
  emptyTitle: { color: ink, fontSize: 14, fontWeight: "600" as const },
  emptyDescription: {
    color: muted,
    fontSize: 12,
    textAlign: "center" as const,
  },
  retryButton: { alignSelf: "center" as const, padding: 8 },
  retryText: { color: purple, fontWeight: "600" as const },
  sectionTitle: {
    marginHorizontal: 16,
    color: ink,
    fontFamily: "Fredoka",
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "700" as const,
  },
  quickRow: {
    paddingHorizontal: 16,
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    gap: 10,
  },
  quickItem: {
    flex: 1,
    height: 98,
    paddingHorizontal: 4,
    paddingVertical: 16,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: border,
    backgroundColor: "white",
    shadowColor: ink,
    shadowOpacity: 0.03,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  quickLabel: {
    color: ink,
    fontFamily: "Inter",
    fontSize: 11,
    lineHeight: 13,
    textAlign: "center" as const,
    fontWeight: "500" as const,
  },
  newHereCard: {
    minHeight: 83,
    marginHorizontal: 16,
    padding: 16,
    borderWidth: 1,
    borderStyle: "dashed" as const,
    borderColor: "#A978D6",
    borderRadius: 20,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 12,
  },
  newHereIcon: { width: 44, height: 44, borderRadius: 22 },
  newHereCopy: { flex: 1, gap: 2 },
  newHereTitle: {
    color: ink,
    fontFamily: "Inter",
    fontSize: 15,
    lineHeight: 19,
    fontWeight: "600" as const,
  },
  newHereDescription: {
    color: muted,
    fontFamily: "Inter",
    fontSize: 11,
    lineHeight: 14.3,
  },
  newHereButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    backgroundColor: purple,
  },
};
