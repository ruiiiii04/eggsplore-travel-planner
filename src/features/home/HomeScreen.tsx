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
import { rememberTrip } from "@/features/trips/recentTrip";
import {
  Bell,
  CalendarDays,
  MapPin,
  Plus,
  ReceiptText,
  ShieldAlert,
  ThumbsUp,
  UserRoundPlus,
  UsersRound,
} from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BottomSheet, Button, Message } from "@/components/ui";
import { useTrips } from "@/features/trips/useTrips";
import { tripStatus, type TripStatus } from "@/features/trips/model";
import type { Trip } from "@/features/trips/model";
import { useAuth } from "@/features/auth/useAuth";
import { useProfile } from "@/features/profile/useProfile";
// import { getSupabase } from "@/lib/supabase";
import { NotificationBell } from "@/features/notifications/NotificationBell";

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
      onPress={() => {
        void rememberTrip(trip.id);
        router.push({ pathname: "/trips/[id]/itinerary", params: { id: trip.id, from: "home" } });
      }}
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

export default function HomeScreen() {
  const { width: windowWidth } = useWindowDimensions();
  const heroScale = Math.min(windowWidth, 402) / 402;
  const [filter, setFilter] = useState<TripStatus | "All">("All");
  // const [sheet, setSheet] = useState<"notifications" | "expense" | "emergency" | "message" | null>(null);
  const [sheet, setSheet] = useState<"notifications" | "emergency" | "message" | null>(null);
  const [quickMessage, setQuickMessage] = useState("");
  // const [expenseTitle, setExpenseTitle] = useState("");
  // const [expenseAmount, setExpenseAmount] = useState("");
  // const [expenseCategory, setExpenseCategory] = useState("");
  // const [expenseBusy, setExpenseBusy] = useState(false);
  // const [expenseError, setExpenseError] = useState("");
  const { trips, loading, error, refresh } = useTrips();
  const { user } = useAuth();
  const { profile } = useProfile();
  const visible = trips.filter((trip) => filter === "All" || tripStatus(trip) === filter);
  const currentTrip = trips.find((trip) => tripStatus(trip) === "Live") ?? trips.find((trip) => tripStatus(trip) === "Upcoming");
  const liveTrip = trips.find((trip) => tripStatus(trip) === "Live");

  // function openExpense() {
  //   if (!liveTrip) {
  //     setQuickMessage("Add Expense is available while you have a live trip.");
  //     setSheet("message");
  //     return;
  //   }
  //   if (!user || liveTrip.owner_id !== user.id) {
  //     setQuickMessage("Only the trip owner can add expenses right now.");
  //     setSheet("message");
  //     return;
  //   }
  //   setExpenseTitle("");
  //   setExpenseAmount("");
  //   setExpenseCategory("");
  //   setExpenseError("");
  //   setSheet("expense");
  // }

    function openExpense() {
    if (!liveTrip) {
      setQuickMessage("Add Expense is available while you have a live trip.");
      setSheet("message");
      return;
    }
    void rememberTrip(liveTrip.id);
    router.push({ pathname: "/add-expense", params: { tripId: liveTrip.id } });
  }

  // async function saveExpense() {
  //   const amount = Number(expenseAmount.trim().replace(",", "."));
  //   if (!liveTrip || !user) return;
  //   if (!expenseTitle.trim()) { setExpenseError("Enter an expense name."); return; }
  //   if (!Number.isFinite(amount) || amount <= 0) { setExpenseError("Enter an amount greater than zero."); return; }
  //   setExpenseBusy(true);
  //   setExpenseError("");
  //   try {
  //     const { error: saveError } = await getSupabase().from("expenses").insert({
  //       trip_id: liveTrip.id,
  //       paid_by: user.id,
  //       title: expenseTitle.trim(),
  //       amount,
  //       category: expenseCategory.trim() || null,
  //     });
  //     if (saveError) throw saveError;
  //     setSheet(null);
  //   } catch (cause) {
  //     setExpenseError(cause instanceof Error ? cause.message : "Could not save this expense.");
  //   } finally {
  //     setExpenseBusy(false);
  //   }
  // }

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
              source={require("../../../assets/eggsplore-logo.png")}
              style={styles.brandMark}
            />
            <View>
              <Text style={styles.brandName}>EGGSPLORE</Text>
              <Text style={styles.brandTagline}>
                Smarter Trips, Happier You
              </Text>
            </View>
          </View>
          {/* <Pressable
            accessibilityRole="button"
            accessibilityLabel="Notifications"
            onPress={() => setSheet("notifications")}
            style={styles.bellButton}
          >
            <Bell size={24} color={purple} />
            <View style={styles.notificationDot} />
          </Pressable> */}
            <NotificationBell />
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
          <Text style={styles.sectionTitle}>Your trips</Text>
          <View style={styles.filterBar}>
            {(["All", "Live", "Upcoming", "Past"] as const).map((value) => (
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
          {visible.length > 0 && (
            <ScrollView
              nestedScrollEnabled
              showsVerticalScrollIndicator={visible.length > 3}
              style={{
                height: Math.min(visible.length, 3) * 146,
                maxHeight: 438,
                flexGrow: 0,
              }}
              contentContainerStyle={{ paddingBottom: 2 }}
            >
              {visible.map((trip, index) => (
                <DestinationCard
                  key={trip.id}
                  trip={trip}
                  spacingAfter={index < visible.length - 1}
                />
              ))}
            </ScrollView>
          )}
          {!loading && !error && visible.length === 0 && (
            <View style={styles.emptyTrips}>
              <Text style={styles.emptyTitle}>
                No {filter === "All" ? "" : `${filter.toLowerCase()} `}trips yet
              </Text>
              <Text style={styles.emptyDescription}>
                Create a trip and start planning together.
              </Text>
            </View>
          )}
          <Text style={styles.sectionTitle}>Quick access</Text>
          <View style={styles.quickRow}>
            <QuickAccess icon={<ReceiptText size={28} color={purple} strokeWidth={1.8} />} label={["Add", "Expense"]} onPress={openExpense} />
            <QuickAccess icon={<ThumbsUp size={28} color={purple} strokeWidth={1.8} />} label={["Pending", "Votes"]} onPress={() => {
              if (!currentTrip) { setQuickMessage("Create a trip to start voting on places."); setSheet("message"); return; }
              void rememberTrip(currentTrip.id);
              router.push({ pathname: "/trips/[id]/candidates", params: { id: currentTrip.id, from: "home" } });
            }} />
            <QuickAccess icon={<ShieldAlert size={28} color={purple} strokeWidth={1.8} />} label={["Emergency", "Info"]} onPress={() => setSheet("emergency")} />
            <QuickAccess icon={<UserRoundPlus size={28} color={purple} strokeWidth={1.8} />} label={["Invite", "Members"]} onPress={() => {
              const inviteTrip = trips.find(trip => trip.owner_id === user?.id && tripStatus(trip) !== "Past");
              if (!inviteTrip) { setQuickMessage("Create a trip as Group Leader to invite members."); setSheet("message"); return; }
              void rememberTrip(inviteTrip.id);
              router.push({ pathname: "/trips/[id]/itinerary", params: { id: inviteTrip.id, from: "home", action: "invite" } });
            }} />
          </View>
        </View>
      </ScrollView>
      <BottomSheet
        visible={!!sheet}
        // title={sheet === "expense" ? "Add Expense" : sheet === "emergency" ? "Emergency Info" : sheet === "message" ? "Quick access" : "Notifications"}
        title={sheet === "emergency" ? "Emergency Info" : sheet === "message" ? "Quick access" : "Notifications"}
        onClose={() => setSheet(null)}
        // busy={expenseBusy}
      >
        {/* {sheet === "expense" ? <>
          <Text style={{ color: muted, fontSize: 13 }}>Quickly record an expense for {liveTrip?.title ?? "your live trip"}.</Text>
          <Field label="Expense name" value={expenseTitle} onChangeText={setExpenseTitle} placeholder="e.g. Dinner" />
          <Field label="Amount (RM)" value={expenseAmount} onChangeText={setExpenseAmount} placeholder="0.00" keyboardType="decimal-pad" />
          <Field label="Category (optional)" value={expenseCategory} onChangeText={setExpenseCategory} placeholder="Food, transport…" />
          {!!expenseError && <Message error>{expenseError}</Message>}
          <Button busy={expenseBusy} onPress={saveExpense}>Save Expense</Button> */}
        {/* </> : sheet === "emergency" ? <> */}
          {sheet === "emergency" ? <>
          <Text style={{ color: muted, fontSize: 13 }}>Your personal emergency contact details saved in Profile.</Text>
          {profile?.emergency_contact.name || profile?.emergency_contact.phone ? <View style={styles.infoCard}>
            {!!profile.emergency_contact.name && <Text style={styles.infoTitle}>{profile.emergency_contact.name}{profile.emergency_contact.relationship ? ` · ${profile.emergency_contact.relationship}` : ""}</Text>}
            {!!profile.emergency_contact.phone && <Text style={styles.infoText}>{profile.emergency_contact.phone}</Text>}
            {!!profile.emergency_contact.destinationNotes && <Text style={styles.infoText}>{profile.emergency_contact.destinationNotes}</Text>}
          </View> : <Message>No emergency contact saved yet. Add one in Profile.</Message>}
          <Button variant="secondary" onPress={() => { setSheet(null); router.push("/(tabs)/profile"); }}>Open Profile</Button>
        </> : sheet === "message" ? <Message>{quickMessage}</Message> : <Message>No notifications yet. Live alerts are not connected in this foundation release.</Message>}
      </BottomSheet>
    </SafeAreaView>
  );
}

function QuickAccess({ icon, label, onPress }: { icon: React.ReactNode; label: [string, string]; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label.join(" ")} onPress={onPress} style={styles.quickItem}>
    {icon}
    <Text style={styles.quickLabel}>{label.join("\n")}</Text>
  </Pressable>;
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
    boxShadow: "0px 4px 6px rgba(60, 25, 80, 0.2)",
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
    boxShadow: "0px 2px 4px rgba(60, 25, 80, 0.1)",
    elevation: 2,
  },
  filterText: {
    color: muted,
    fontSize: 11,
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
    boxShadow: "0px 4px 8px rgba(60, 25, 80, 0.08)",
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
    marginHorizontal: 16,
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    gap: 10,
  },
  quickItem: {
    flex: 1,
    minHeight: 98,
    paddingHorizontal: 8,
    paddingVertical: 16,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: 9,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: border,
    backgroundColor: "white",
    boxShadow: "0px 4px 6px rgba(60, 25, 80, 0.03)",
    elevation: 1,
  },
  quickLabel: {
    color: ink,
    fontFamily: "Inter",
    fontSize: 11,
    lineHeight: 13.2,
    textAlign: "center" as const,
    fontWeight: "500" as const,
  },
  infoCard: { backgroundColor: "white", borderRadius: 16, borderWidth: 1, borderColor: border, padding: 14, gap: 7 },
  infoTitle: { color: ink, fontFamily: "Fredoka", fontSize: 16, fontWeight: "600" as const },
  infoText: { color: muted, fontSize: 13, lineHeight: 19 },
};
