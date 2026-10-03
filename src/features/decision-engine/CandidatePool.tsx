import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Keyboard,
  useWindowDimensions,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  Box,
  Check,
  CircleCheck,
  ChevronDown,
  GripVertical,
  Image as Photo,
  Link,
  MapPin,
  MoreHorizontal,
  Pencil,
  Plus,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  X,
} from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "../auth/AuthProvider";
import { getSupabase } from "../../lib/supabase";
import { readProfile, updateProfile } from "../profile/service";
import { errorMessage } from "../../lib/errors";
import { createPoolStore } from "./persistence";
import type { Trip } from "../trips/model";
import {
  Candidate,
  Pool,
  Stop,
  Vote,
  makeDraft,
  moveStop,
  seedCandidates,
  tags,
  toggleVote,
  totals,
  tripDays,
  validTime,
} from "./model";
const purple = "#7D49D5",
  ink = "#241738",
  muted = "#828397",
  border = "#ECE4FA",
  bg = "#FBF9FE";
const bali = require("../../../assets/trip-bali-cover.png"),
  japan = require("../../../assets/trip-japan-cover.png");
const poolStore = createPoolStore({
  read: async (userId) => (await readProfile(userId)).preferences,
  change: async (userId, change) =>
    (
      await updateProfile(userId, (profile) => ({
        preferences: change(profile.preferences),
      }))
    ).preferences,
  cache: AsyncStorage,
});
const fresh = (destination: string): Pool => ({
  candidates: seedCandidates(destination),
  votes: {},
  draft: null,
  published: null,
});
function Action({
  children,
  onPress,
  disabled = false,
  secondary = false,
}: {
  children: React.ReactNode;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.action,
        secondary && s.secondary,
        disabled && { opacity: 0.45 },
        pressed && { opacity: 0.75 },
      ]}
    >
      <Text style={[s.actionText, secondary && { color: purple }]}>
        {children}
      </Text>
    </Pressable>
  );
}
function IconButton({
  label,
  onPress,
  children,
}: {
  label: string;
  onPress: () => void;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [
        s.icon,
        pressed && { backgroundColor: "#EDE2FD" },
      ]}
    >
      {children}
    </Pressable>
  );
}
function Field({
  label,
  value,
  onChange,
  placeholder,
  maxLength = 120,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
}) {
  return (
    <View style={{ gap: 10 }}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#9AA1B3"
        maxLength={maxLength}
        style={s.input}
      />
    </View>
  );
}
function FullScreen({
  title,
  onClose,
  children,
  footer,
  right,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  right?: React.ReactNode;
}) {
  const { height: windowHeight } = useWindowDimensions();
  const [viewportHeight, setViewportHeight] = useState<number>();
  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    const viewport = window.visualViewport;
    const resize = () =>
      setViewportHeight(viewport?.height ?? window.innerHeight);
    resize();
    viewport?.addEventListener("resize", resize);
    window.addEventListener("resize", resize);
    return () => {
      viewport?.removeEventListener("resize", resize);
      window.removeEventListener("resize", resize);
    };
  }, []);
  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView
        style={[
          s.safe,
          Platform.OS === "web" && {
            height: viewportHeight ?? windowHeight,
            flexGrow: 0,
            flexShrink: 0,
            flexBasis: "auto",
          },
        ]}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={
            Platform.OS === "ios"
              ? "padding"
              : Platform.OS === "android"
                ? "height"
                : undefined
          }
        >
          <View style={s.header}>
            <IconButton label="Back" onPress={onClose}>
              <ArrowLeft size={22} color={ink} />
            </IconButton>
            <Text style={s.heading}>{title}</Text>
            <View style={{ width: 44, alignItems: "center" }}>{right}</View>
          </View>
          <ScrollView
            style={{ flex: 1, minHeight: 0 }}
            showsVerticalScrollIndicator={false}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: 20, paddingBottom: 12 }}
          >
            {children}
          </ScrollView>
          {footer && <View style={s.footer}>{footer}</View>}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
export default function CandidatePool({
  tripId,
  trip,
  onPublished,
}: {
  tripId: string;
  trip: Trip | null;
  onPublished: () => void;
}) {
  const { session } = useAuth();
  const userId = session?.user.id;
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [pool, setPool] = useState<Pool>(fresh("")),
    [ready, setReady] = useState(false),
    [error, setError] = useState("");
  const current = useRef(pool);

  const [screen, setScreen] = useState<"pool" | "add" | "review">("pool");
  const [filter, setFilter] = useState("All"),
    [sort, setSort] = useState("Popularity"),
    [sorting, setSorting] = useState(false),
    [detail, setDetail] = useState<Candidate | null>(null);
  const [publishing, setPublishing] = useState(false),
    [edit, setEdit] = useState<Stop | null>(null),
    [editError, setEditError] = useState("");
  const days = tripDays(trip?.start_date, trip?.end_date);
  useEffect(() => {
    let alive = true;
    setReady(false);
    setError("");
    setScreen("pool");
    if (!userId || !trip) return;
    void poolStore
      .load(userId, tripId, () => fresh(trip.destination || ""))
      .then((value) => {
        if (!alive) return;
        current.current = value;
        setPool(value);
        setReady(true);
      })
      .catch((cause) => {
        if (alive)
          setError(
            "Could not load your saved candidates. " + errorMessage(cause),
          );
      });
    return () => {
      alive = false;
    };
  }, [userId, tripId, trip?.destination, loadAttempt]);
  async function update(fn: (p: Pool) => Pool): Promise<boolean> {
    if (!userId || !ready) return false;
    try {
      const next = await poolStore.update(userId, tripId, fn);
      current.current = next;
      setPool(next);
      setError("");
      return true;
    } catch (cause) {
      setError("Changes were not saved. Please retry. " + errorMessage(cause));
      return false;
    }
  }
  const vote = (id: string, value: Vote) =>
    update((p) => ({ ...p, votes: toggleVote(p.votes, id, value) }));
  const counts = {
    All: pool.candidates.length,
    Shortlist: pool.candidates.filter(
      (c) => pool.votes[c.id] === "up" || c.confirmed,
    ).length,
    Voted: Object.keys(pool.votes).length,
  };
  const visible = pool.candidates
    .filter(
      (c) =>
        filter === "All" ||
        (filter === "Shortlist"
          ? pool.votes[c.id] === "up" || c.confirmed
          : !!pool.votes[c.id]),
    )
    .sort((a, b) =>
      sort === "Name"
        ? a.name.localeCompare(b.name)
        : sort === "Newest"
          ? pool.candidates.indexOf(a) - pool.candidates.indexOf(b)
          : totals(b, pool.votes[b.id]).score -
            totals(a, pool.votes[a.id]).score,
    );
  function review() {
    if (!pool.draft) update((p) => ({ ...p, draft: makeDraft(p, days) }));
    setError("");
    setScreen("review");
  }
  async function publish() {
    if (!pool.draft?.length || publishing) return;
    setPublishing(true);
    setError("");
    try {
      const { error: failure } = await getSupabase().rpc(
        "publish_candidate_draft",
        {
          target_trip: tripId,
          stops: pool.draft.map((stop, position) => ({
            title: stop.title,
            location_name: stop.location,
            description: `Day ${stop.day} · ${stop.time}`,
            start_time: trip?.start_date
              ? new Date(
                  Date.parse(`${trip.start_date}T00:00:00Z`) +
                    (stop.day - 1) * 86400000 +
                    Number(stop.time.slice(0, 2)) * 3600000 +
                    Number(stop.time.slice(3)) * 60000,
                ).toISOString()
              : null,
            position,
          })),
        },
      );
      if (failure) throw failure;
      if (!(await update((p) => ({ ...p, published: p.draft }))))
        throw Error(
          "The itinerary was published, but the saved draft status could not be updated. Please retry.",
        );
      setScreen("pool");
      onPublished();
    } catch (e) {
      setError(
        `Plan not published. ${e instanceof Error ? e.message : (e as { message?: string })?.message || "Please try again."}`,
      );
    } finally {
      setPublishing(false);
    }
  }
  function saveStop() {
    if (!edit) return;
    if (!edit.title.trim()) {
      setEditError("Enter an activity name.");
      return;
    }
    if (!validTime(edit.time)) {
      setEditError("Use a valid 24-hour time, e.g. 09:30.");
      return;
    }
    if (
      pool.draft?.some(
        (x) => x.id !== edit.id && x.day === edit.day && x.time === edit.time,
      )
    ) {
      setEditError("Another activity uses this time. Choose a different time.");
      return;
    }
    update((p) => ({
      ...p,
      draft: [
        ...(p.draft || []).filter((x) => x.id !== edit.id),
        { ...edit, title: edit.title.trim() },
      ].sort((a, b) => a.day - b.day || a.time.localeCompare(b.time)),
    }));
    setEdit(null);
  }
  if (!ready)
    return (
      <View style={{ padding: 25 }}>
        {error ? (
          <View style={{ gap: 12 }}>
            <Text style={s.error}>{error}</Text>
            <Action
              secondary
              onPress={() => setLoadAttempt((value) => value + 1)}
            >
              Retry loading candidates
            </Action>
          </View>
        ) : (
          <ActivityIndicator color={purple} />
        )}
      </View>
    );
  return (
    <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
      <View style={[s.row, { gap: 5, marginBottom: 14 }]}>
        {(["All", "Shortlist", "Voted"] as const).map((f) => (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: f === filter }}
            key={f}
            onPress={() => setFilter(f)}
            style={[
              s.pill,
              f === filter && { backgroundColor: purple, borderColor: purple },
            ]}
          >
            <Text
              style={{
                fontFamily: "Inter",
                fontSize: 10,
                color: f === filter ? "white" : muted,
              }}
            >
              {f} ({counts[f]})
            </Text>
          </Pressable>
        ))}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add Candidate"
          onPress={() => setScreen("add")}
          style={[
            s.pill,
            s.row,
            { marginLeft: "auto", backgroundColor: "#F1E8FC", gap: 3 },
          ]}
        >
          <Plus size={14} color={purple} />
          <Text style={{ color: purple, fontSize: 10, fontWeight: "700" }}>
            Add
          </Text>
        </Pressable>
      </View>
      <View
        style={[s.row, { justifyContent: "space-between", marginBottom: 12 }]}
      >
        <View>
          <Text
            style={{
              fontFamily: "Fredoka",
              fontWeight: "700",
              fontSize: 20,
              color: "#37134F",
            }}
          >
            Candidate Pool
          </Text>
          <Text style={{ fontSize: 11, color: muted, marginTop: 3 }}>
            Explore, vote and decide together!
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => setSorting(!sorting)}
          style={[s.pill, s.row, { gap: 4 }]}
        >
          <ChevronDown size={13} color={purple} />
          <Text style={{ fontSize: 10, color: purple }}>{sort}</Text>
        </Pressable>
      </View>
      {sorting && (
        <View style={[s.card, { padding: 6, marginBottom: 10 }]}>
          {["Popularity", "Newest", "Name"].map((v) => (
            <Pressable
              key={v}
              onPress={() => {
                setSort(v);
                setSorting(false);
              }}
              style={{ padding: 12 }}
            >
              <Text style={{ color: sort === v ? purple : ink }}>
                {v}
                {sort === v ? " ✓" : ""}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
      {!!error && (
        <Text accessibilityRole="alert" style={s.error}>
          {error}
        </Text>
      )}
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        {visible.map((c) => {
          const t = totals(c, pool.votes[c.id]);
          return (
            <View key={c.id} style={s.candidate}>
              <View style={{ height: 74 }}>
                <Image
                  source={
                    c.image
                      ? { uri: c.image }
                      : c.cover === "japan"
                        ? japan
                        : bali
                  }
                  style={{ width: "100%", height: "100%" }}
                />
                {c.confirmed && <Text style={s.badge}>✓ Shortlisted</Text>}
                <Pressable
                  accessibilityLabel={`Details for ${c.name}`}
                  accessibilityRole="button"
                  onPress={() => setDetail(c)}
                  style={s.more}
                >
                  <MoreHorizontal size={15} color={purple} />
                </Pressable>
              </View>
              <View style={{ padding: 8, gap: 5 }}>
                <Text
                  numberOfLines={2}
                  style={{ fontSize: 11, fontWeight: "700", color: ink }}
                >
                  {c.name}
                </Text>
                <View style={[s.row, { gap: 3 }]}>
                  <MapPin size={9} color={muted} />
                  <Text
                    numberOfLines={1}
                    style={{ fontSize: 8, color: muted, flex: 1 }}
                  >
                    {c.location}
                  </Text>
                </View>
                <View style={[s.row, { gap: 3, flexWrap: "wrap" }]}>
                  {c.tags.map((tag) => (
                    <Text key={tag} style={s.tag}>
                      {tag}
                    </Text>
                  ))}
                </View>
                <Text style={{ fontSize: 9, color: muted }}>
                  {t.total} {t.total === 1 ? "vote" : "votes"}
                </Text>
                <View
                  style={[
                    s.row,
                    {
                      borderRadius: 9,
                      overflow: "hidden",
                      backgroundColor: "#F6F0FC",
                    },
                  ]}
                >
                  {(["up", "down"] as Vote[]).map((v) => {
                    const Icon = v === "up" ? ThumbsUp : ThumbsDown;
                    return (
                      <Pressable
                        key={v}
                        accessibilityRole="button"
                        accessibilityLabel={`${v === "up" ? "Like" : "Dislike"} ${c.name}`}
                        accessibilityState={{
                          selected: pool.votes[c.id] === v,
                        }}
                        onPress={() => vote(c.id, v)}
                        style={[
                          s.vote,
                          pool.votes[c.id] === v && {
                            backgroundColor: "#E9DCFB",
                          },
                        ]}
                      >
                        <Icon size={12} color={purple} />
                        <Text style={{ color: purple, fontSize: 9 }}>
                          {pool.votes[c.id] === v
                            ? "Voted"
                            : `${v === "up" ? t.percent : t.total ? 100 - t.percent : 0}%`}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </View>
          );
        })}
      </View>
      {!visible.length && (
        <View style={[s.card, { padding: 24, alignItems: "center", gap: 8 }]}>
          <MapPin color={purple} />
          <Text style={{ color: ink, fontWeight: "700" }}>
            No{" "}
            {filter === "All" ? "candidates" : filter.toLowerCase() + " places"}{" "}
            yet
          </Text>
          <Text style={s.small}>
            {filter === "All"
              ? "Add a place to start planning together."
              : "Vote on a place in All to see it here."}
          </Text>
        </View>
      )}
      <View
        style={[
          s.card,
          s.row,
          { padding: 12, marginTop: 16, gap: 8, backgroundColor: "#FCFAFF" },
        ]}
      >
        <Image
          source={require("../../../assets/figma-welcome-mascot.png")}
          resizeMode="contain"
          style={{ width: 48, height: 62 }}
        />
        <View style={{ flex: 1 }}>
          <Text style={{ color: "#6537B1", fontWeight: "700", fontSize: 13 }}>
            Almost there!
          </Text>
          <Text style={[s.small, { fontSize: 10, marginTop: 3 }]}>
            Vote for your favorite spots to help shape the itinerary.
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          disabled={!pool.candidates.length}
          onPress={review}
          style={[s.result, !pool.candidates.length && { opacity: 0.4 }]}
        >
          <Text style={{ color: "white", fontSize: 10, fontWeight: "700" }}>
            View Results
          </Text>
          <ArrowRight size={12} color="white" />
        </Pressable>
      </View>
      <Text
        style={[
          s.small,
          { fontSize: 10, textAlign: "center", marginVertical: 10 },
        ]}
      >
        Candidates and votes are saved to your account for this trip. Drafts use
        vote rankings.
      </Text>
      {screen === "add" && (
        <AddCandidate
          destination={trip?.destination || ""}
          onClose={() => setScreen("pool")}
          onSubmit={async (c) => {
            const saved = await update((p) => ({
              ...p,
              candidates: [c, ...p.candidates],
              draft: null,
            }));
            if (!saved)
              throw Error(
                "Your candidate could not be saved. Check your connection and try again.",
              );
            setFilter("All");
            setScreen("pool");
          }}
          existing={pool.candidates}
        />
      )}
      {screen === "review" && (
        <FullScreen
          title="Review Draft"
          onClose={() => {
            if (!publishing) setScreen("pool");
          }}
          footer={
            <>
              <Text style={[s.small, { textAlign: "center", marginBottom: 8 }]}>
                {trip?.owner_id !== session?.user.id
                  ? "Only the trip organiser can publish."
                  : "Publishing replaces the current trip itinerary."}
              </Text>
              <Action
                disabled={
                  publishing ||
                  !pool.draft?.length ||
                  trip?.owner_id !== session?.user.id
                }
                onPress={() => void publish()}
              >
                {publishing ? "Publishing…" : "✓  Confirm & Publish Plan"}
              </Action>
            </>
          }
        >
          <View
            style={[
              s.card,
              s.row,
              {
                backgroundColor: "#F8F4FF",
                borderColor: "#EBDDFF",
                padding: 16,
                gap: 12,
                marginBottom: 12,
              },
            ]}
          >
            <View style={s.circle}>
              <Pencil color={purple} size={21} />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{ color: "#6639B2", fontWeight: "700", fontSize: 13 }}
              >
                Here is your updated plan!
              </Text>
              <Text style={[s.small, { fontSize: 10, marginTop: 4 }]}>
                Ranked from your votes. Tap an activity to edit or use its
                handle to reorder before finalizing.
              </Text>
            </View>
          </View>
          {!!error && <Text style={s.error}>{error}</Text>}
          {Array.from({ length: days }, (_, i) => i + 1).map((day) => (
            <View
              key={day}
              style={[
                s.card,
                { padding: 16, marginBottom: 12, borderRadius: 24 },
              ]}
            >
              <View style={[s.row, { gap: 12, marginBottom: 18 }]}>
                <View style={s.day}>
                  <Text style={{ fontSize: 10, color: "white" }}>Day</Text>
                  <Text
                    style={{ fontSize: 18, fontWeight: "700", color: "white" }}
                  >
                    {day}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.small}>
                    {trip?.start_date
                      ? new Date(
                          Date.parse(`${trip.start_date}T12:00:00Z`) +
                            (day - 1) * 86400000,
                        ).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          weekday: "long",
                        })
                      : `Day ${day} · Flexible date`}
                  </Text>
                  <Text
                    style={{
                      fontWeight: "700",
                      color: ink,
                      fontSize: 16,
                      marginTop: 4,
                    }}
                  >
                    {day === 1 ? "Explore" : "Discover"}{" "}
                    {trip?.destination || "your destination"}
                  </Text>
                </View>
              </View>
              {(pool.draft || [])
                .filter((stop) => stop.day === day)
                .map((stop) => (
                  <DraftRow
                    key={stop.id}
                    stop={stop}
                    onEdit={() => {
                      setEditError("");
                      setEdit({ ...stop });
                    }}
                    onMove={(offset) =>
                      update((p) => ({
                        ...p,
                        draft: moveStop(p.draft || [], stop.id, offset),
                      }))
                    }
                    first={
                      pool.draft?.filter((x) => x.day === day)[0].id === stop.id
                    }
                    last={
                      pool.draft?.filter((x) => x.day === day).at(-1)?.id ===
                      stop.id
                    }
                  />
                ))}
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setEditError("");
                  setEdit({
                    id: `manual-${Date.now()}`,
                    day,
                    time: "09:00",
                    title: "",
                    location: trip?.destination || "",
                  });
                }}
                style={[s.row, { gap: 10, marginTop: 12 }]}
              >
                <Plus size={18} color="#B5B3C5" />
                <View style={s.insert}>
                  <Text style={{ color: muted, fontSize: 12 }}>
                    Insert activity here...
                  </Text>
                </View>
              </Pressable>
            </View>
          ))}
          <Action
            secondary
            onPress={() => update((p) => ({ ...p, draft: makeDraft(p, days) }))}
          >
            Rebuild draft from current votes
          </Action>
          {!!edit && (
            <Modal
              transparent
              visible
              animationType="fade"
              onRequestClose={() => setEdit(null)}
            >
              <View style={s.overlay}>
                <View
                  style={[
                    s.card,
                    { padding: 22, width: "100%", maxWidth: 380, gap: 16 },
                  ]}
                >
                  <View style={[s.row, { justifyContent: "space-between" }]}>
                    <Text
                      style={{
                        fontFamily: "Fredoka",
                        fontSize: 24,
                        color: purple,
                      }}
                    >
                      Edit activity
                    </Text>
                    <IconButton
                      label="Close editor"
                      onPress={() => setEdit(null)}
                    >
                      <X color={purple} />
                    </IconButton>
                  </View>
                  <Field
                    label="ACTIVITY NAME"
                    value={edit.title}
                    onChange={(title) => setEdit({ ...edit, title })}
                  />
                  <Field
                    label="LOCATION / AREA"
                    value={edit.location}
                    onChange={(location) => setEdit({ ...edit, location })}
                  />
                  <Field
                    label="TIME (24-HOUR)"
                    value={edit.time}
                    maxLength={5}
                    onChange={(time) => setEdit({ ...edit, time })}
                  />
                  <View style={s.row}>
                    <Text style={s.small}>
                      Day {edit.day} of {days}
                    </Text>
                    <IconButton
                      label="Previous day"
                      onPress={() =>
                        setEdit({ ...edit, day: Math.max(1, edit.day - 1) })
                      }
                    >
                      <ArrowLeft color={purple} size={18} />
                    </IconButton>
                    <IconButton
                      label="Next day"
                      onPress={() =>
                        setEdit({ ...edit, day: Math.min(days, edit.day + 1) })
                      }
                    >
                      <ArrowRight color={purple} size={18} />
                    </IconButton>
                  </View>
                  {!!editError && <Text style={s.error}>{editError}</Text>}
                  <Action onPress={saveStop}>Save activity</Action>
                  <Action
                    secondary
                    onPress={() => {
                      update((p) => ({
                        ...p,
                        draft: p.draft?.filter((x) => x.id !== edit.id) || [],
                      }));
                      setEdit(null);
                    }}
                  >
                    Remove activity
                  </Action>
                </View>
              </View>
            </Modal>
          )}
        </FullScreen>
      )}

      {!!detail && (
        <Modal
          transparent
          visible
          animationType="fade"
          onRequestClose={() => setDetail(null)}
        >
          <View style={s.overlay}>
            <View
              style={[
                s.card,
                { padding: 22, width: "100%", maxWidth: 380, gap: 14 },
              ]}
            >
              <View style={[s.row, { justifyContent: "space-between" }]}>
                <Text
                  style={{
                    fontFamily: "Fredoka",
                    fontSize: 22,
                    color: ink,
                    flex: 1,
                  }}
                >
                  {detail.name}
                </Text>
                <IconButton
                  label="Close details"
                  onPress={() => setDetail(null)}
                >
                  <X color={purple} />
                </IconButton>
              </View>
              <Text style={s.small}>{detail.location}</Text>
              <Text style={s.small}>{detail.tags.join(" · ")}</Text>
              {!!detail.source && (
                <Text selectable style={s.small}>
                  {detail.source}
                </Text>
              )}
              <Text style={s.small}>
                {totals(detail, pool.votes[detail.id]).up} likes ·{" "}
                {totals(detail, pool.votes[detail.id]).down} dislikes
              </Text>
              <Action
                secondary
                onPress={() => {
                  update((p) => ({
                    ...p,
                    candidates: p.candidates.map((c) =>
                      c.id === detail.id
                        ? { ...c, confirmed: !c.confirmed }
                        : c,
                    ),
                  }));
                  setDetail(null);
                }}
              >
                {detail.confirmed
                  ? "Remove from shortlist"
                  : "Add to shortlist"}
              </Action>
              <Action
                secondary
                onPress={() => {
                  update((p) => {
                    const votes = { ...p.votes };
                    delete votes[detail.id];
                    return {
                      ...p,
                      votes,
                      candidates: p.candidates.filter(
                        (c) => c.id !== detail.id,
                      ),
                      draft: p.draft?.filter((x) => x.id !== detail.id) || null,
                    };
                  });
                  setDetail(null);
                }}
              >
                Remove candidate
              </Action>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}
function DraftRow({
  stop,
  onEdit,
  onMove,
  first,
  last,
}: {
  stop: Stop;
  onEdit: () => void;
  onMove: (v: number) => void;
  first: boolean;
  last: boolean;
}) {
  const [controls, setControls] = useState(false);
  const dragY = useRef<number | null>(null);
  return (
    <View>
      <View style={[s.row, { minHeight: 78, gap: 8 }]}>
        <View
          onStartShouldSetResponder={() => true}
          onResponderGrant={(e) => {
            dragY.current = e.nativeEvent.pageY;
          }}
          onResponderRelease={(e) => {
            const delta =
              e.nativeEvent.pageY - (dragY.current ?? e.nativeEvent.pageY);
            if (Math.abs(delta) > 25) onMove(delta > 0 ? 1 : -1);
            else setControls(!controls);
            dragY.current = null;
          }}
          accessibilityRole="button"
          accessibilityLabel={`Reorder ${stop.title}`}
          style={{ paddingVertical: 18, paddingRight: 4 }}
        >
          <GripVertical size={14} color="#CFCCD8" />
        </View>
        <Text
          style={{
            fontSize: 11,
            color: stop.top ? "#F39B00" : muted,
            width: 36,
            fontWeight: "600",
          }}
        >
          {stop.time}
        </Text>
        <View
          style={{
            alignSelf: "stretch",
            alignItems: "center",
            width: 10,
            paddingTop: 23,
          }}
        >
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: stop.top ? "#FFAB0B" : "#B189FF",
            }}
          />
          <View
            style={{
              flex: 1,
              borderLeftWidth: 2,
              borderStyle: "dashed",
              borderColor: "#EADDFF",
              marginTop: 5,
            }}
          />
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={onEdit}
          style={[
            s.row,
            { flex: 1, gap: 10, padding: 10, borderRadius: 17 },
            stop.top && {
              backgroundColor: "#FFFBEA",
              borderWidth: 1,
              borderColor: "#FFD56C",
            },
          ]}
        >
          {stop.top && <Text style={s.topVote}>✓ Top Vote</Text>}
          <View
            style={[
              s.circle,
              { width: 32, height: 32, backgroundColor: "#F5EEFF" },
            ]}
          >
            <MapPin size={16} color={stop.top ? "#EB9300" : purple} />
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontWeight: "600",
                fontSize: 13,
                color: stop.top ? "#A74A00" : ink,
              }}
            >
              {stop.title}
            </Text>
            <Text style={[s.small, { fontSize: 11, marginTop: 5 }]}>
              {stop.location}
            </Text>
          </View>
        </Pressable>
      </View>
      {controls && (
        <View
          style={[
            s.row,
            { justifyContent: "flex-end", gap: 8, paddingBottom: 8 },
          ]}
        >
          <Pressable
            accessibilityRole="button"
            disabled={first}
            onPress={() => onMove(-1)}
            style={[s.pill, { opacity: first ? 0.4 : 1 }]}
          >
            <Text style={{ color: purple }}>↑ Move up</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={last}
            onPress={() => onMove(1)}
            style={[s.pill, { opacity: last ? 0.4 : 1 }]}
          >
            <Text style={{ color: purple }}>↓ Move down</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
function AddCandidate({
  destination,
  onClose,
  onSubmit,
  existing,
}: {
  destination: string;
  onClose: () => void;
  onSubmit: (c: Candidate) => Promise<void>;
  existing: Candidate[];
}) {
  const [name, setName] = useState(""),
    [location, setLocation] = useState(""),
    [selected, setSelected] = useState<string[]>(["Culture"]),
    [photo, setPhoto] = useState<string>(),
    [source, setSource] = useState(""),
    [linkOpen, setLinkOpen] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [custom, setCustom] = useState(""),
    [customOpen, setCustomOpen] = useState(false);
  const clear = () => {
    setName("");
    setLocation("");
    setSelected([]);
    setPhoto(undefined);
    setSource("");
    setError("");
    setCustom("");
    setCustomOpen(false);
    setLinkOpen(false);
  };
  async function extract(body: Record<string, string>) {
    Keyboard.dismiss();
    setBusy(true);
    setError("");
    try {
      const { data, error: failure } = await getSupabase().functions.invoke(
        "candidate-autofill",
        { body, timeout: 30000 },
      );
      if (failure) throw failure;
      if (!data?.name || !data?.location)
        throw Error("No place identified. Please enter the details manually.");
      setName(String(data.name).slice(0, 120));
      setLocation(String(data.location).slice(0, 120));
      setSelected(
        Array.isArray(data.tags)
          ? [
              ...new Set<string>(
                data.tags
                  .filter((v: unknown) => typeof v === "string")
                  .map((v: string) => v.slice(0, 24)),
              ),
            ].slice(0, 3)
          : [],
      );
      setLinkOpen(false);
    } catch {
      setError(
        "AI auto-fill is unavailable. Your photo/link is attached; enter the place details below.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function pickPhoto() {
    Keyboard.dismiss();
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.65,
        base64: true,
        allowsEditing: true,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset.base64 || asset.base64.length >= 6000000) {
        setError(
          "Choose a smaller photo (under 4 MB) so it can be saved with your candidate.",
        );
        return;
      }
      const mimeType = asset.mimeType || "image/jpeg";
      setPhoto("data:" + mimeType + ";base64," + asset.base64);
      await extract({ image: asset.base64, mimeType });
    } catch {
      setError(
        "Could not open your photos. Check photo permissions and try again.",
      );
    }
  }
  async function submit() {
    if (busy) return;
    Keyboard.dismiss();
    if (!name.trim() || !location.trim()) {
      setError("Enter a candidate name and location.");
      return;
    }
    if (
      existing.some(
        (c) =>
          c.name.toLowerCase() === name.trim().toLowerCase() &&
          c.location.toLowerCase() === location.trim().toLowerCase(),
      )
    ) {
      setError("This place is already in the candidate pool.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onSubmit({
        id: `candidate-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: name.trim(),
        location: location.trim(),
        tags: selected,
        image: photo,
        source: source || undefined,
        cover: /japan|tokyo|osaka|kyoto/i.test(destination) ? "japan" : "bali",
        up: 0,
        down: 0,
      });
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }
  function toggle(tag: string) {
    if (selected.includes(tag)) setSelected(selected.filter((t) => t !== tag));
    else if (selected.length < 3) setSelected([...selected, tag]);
    else setError("Select up to 3 tags. Remove a tag to choose another.");
  }
  return (
    <FullScreen
      title="Add Candidate"
      onClose={onClose}
      right={
        <Pressable accessibilityRole="button" disabled={busy} onPress={clear}>
          <Text style={{ fontSize: 12, color: purple }}>Clear</Text>
        </Pressable>
      }
      footer={
        <View style={{ gap: 8 }}>
          {!!error && (
            <Text accessibilityRole="alert" style={s.error}>
              {error}
            </Text>
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Submit for Voting"
            accessibilityState={{ disabled: busy, busy }}
            disabled={busy}
            onPress={() => void submit()}
            style={({ pressed }) => [
              s.submitButton,
              pressed && { backgroundColor: "#6934BB" },
            ]}
          >
            {busy && <ActivityIndicator color="#FFFFFF" size="small" />}
            <Text style={s.submitButtonText}>
              {busy ? "Please wait..." : "Submit for Voting"}
            </Text>
          </Pressable>
        </View>
      }
    >
      <View style={[s.card, { padding: 16, borderRadius: 24 }]}>
        <View style={s.autofill}>
          <View style={[s.circle, { backgroundColor: "white" }]}>
            <Box size={25} color={purple} />
          </View>
          <Text
            style={{
              color: "#6339AD",
              fontSize: 16,
              fontWeight: "700",
              marginTop: 10,
            }}
          >
            Auto-fill with AI ✨
          </Text>
          <Text
            style={[
              s.small,
              {
                textAlign: "center",
                fontSize: 11,
                lineHeight: 16,
                marginTop: 6,
              },
            ]}
          >
            Upload a photo or paste a link (TikTok, IG, Maps) and we'll extract
            the details!
          </Text>
          <View style={[s.row, { gap: 12, marginTop: 18, width: "100%" }]}>
            <Pressable
              disabled={busy}
              accessibilityRole="button"
              onPress={() => void pickPhoto()}
              style={s.import}
            >
              <Photo size={15} color={purple} />
              <Text style={s.importText}>Photo</Text>
            </Pressable>
            <Pressable
              disabled={busy}
              accessibilityRole="button"
              onPress={() => setLinkOpen(!linkOpen)}
              style={s.import}
            >
              <Link size={15} color={purple} />
              <Text style={s.importText}>Paste Link</Text>
            </Pressable>
          </View>
          {busy && (
            <ActivityIndicator color={purple} style={{ marginTop: 14 }} />
          )}
          {!!photo && (
            <Image
              source={{ uri: photo }}
              style={{ width: 70, height: 70, borderRadius: 12, marginTop: 12 }}
            />
          )}
        </View>
        {linkOpen && (
          <View style={{ gap: 10, marginTop: 14 }}>
            <TextInput
              accessibilityLabel="Place link"
              autoCapitalize="none"
              value={source}
              onChangeText={setSource}
              placeholder="https://maps.google.com/..."
              style={s.input}
            />
            <Action
              secondary
              disabled={busy}
              onPress={() => {
                try {
                  const u = new URL(source);
                  if (!["http:", "https:"].includes(u.protocol)) throw Error();
                  void extract({ url: source });
                } catch {
                  setError("Paste a valid https:// link.");
                }
              }}
            >
              Extract place details
            </Action>
          </View>
        )}
      </View>
      <View style={[s.row, { gap: 12, marginVertical: 28 }]}>
        <View style={s.rule} />
        <Text
          style={{
            color: "#A0A3B4",
            fontSize: 10,
            fontWeight: "700",
            letterSpacing: 1,
          }}
        >
          OR ENTER MANUALLY
        </Text>
        <View style={s.rule} />
      </View>
      <View style={[s.card, { padding: 20, borderRadius: 24, gap: 28 }]}>
        <Field
          label="CANDIDATE NAME"
          value={name}
          onChange={setName}
          placeholder="e.g. Universal Studios"
        />
        <Field
          label="LOCATION / AREA"
          value={location}
          onChange={setLocation}
          placeholder={`e.g. ${destination || "Osaka, Japan"}`}
        />
        <View>
          <View
            style={[
              s.row,
              { justifyContent: "space-between", marginBottom: 14 },
            ]}
          >
            <Text style={s.label}>TAGS</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add custom tag"
              onPress={() => setCustomOpen((value) => !value)}
              hitSlop={10}
            >
              <Text style={{ fontFamily: "Inter", fontSize: 9, color: muted }}>
                Select up to 3
              </Text>
            </Pressable>
          </View>
          <View style={[s.row, { flexWrap: "wrap", gap: 8 }]}>
            {[...new Set([...tags.slice(0, 6), ...selected])].map((tag) => (
              <Pressable
                key={tag}
                accessibilityRole="button"
                accessibilityState={{ selected: selected.includes(tag) }}
                onPress={() => toggle(tag)}
                style={[
                  s.tagPill,
                  selected.includes(tag) && {
                    backgroundColor: "#F8F3FF",
                    borderColor: "#ECDDFF",
                  },
                ]}
              >
                <Text
                  style={{
                    fontSize: 11,
                    color: selected.includes(tag) ? "#6537B1" : "#666D80",
                    fontWeight: selected.includes(tag) ? "700" : "400",
                  }}
                >
                  {tag}
                  {selected.includes(tag) ? "  ×" : ""}
                </Text>
              </Pressable>
            ))}
          </View>
          {customOpen && (
            <View style={[s.row, { gap: 8, marginTop: 12 }]}>
              <TextInput
                accessibilityLabel="Custom tag"
                maxLength={24}
                placeholder="Custom tag"
                value={custom}
                onChangeText={setCustom}
                style={[s.input, { flex: 1, height: 36, fontSize: 11 }]}
              />
              <IconButton
                label="Add custom tag"
                onPress={() => {
                  if (custom.trim()) {
                    toggle(custom.trim());
                    setCustom("");
                  }
                }}
              >
                <Plus color={purple} size={18} />
              </IconButton>
            </View>
          )}
        </View>
      </View>
    </FullScreen>
  );
}
const s = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: bg,
    width: "100%",
    maxWidth: 402,
    alignSelf: "center",
  },
  header: {
    flexShrink: 0,
    height: 68,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#F4F0F8",
  },
  heading: {
    fontFamily: "Fredoka",
    fontSize: 28,
    fontWeight: "700",
    color: "#6131AB",
  },
  icon: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
  },
  row: { flexDirection: "row", alignItems: "center" },
  card: {
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#F0EDF5",
    borderRadius: 18,
    boxShadow: "0 1px 2px #29174F08",
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: border,
    backgroundColor: bg,
  },
  candidate: {
    width: "48.5%",
    borderWidth: 1,
    borderColor: border,
    borderRadius: 15,
    backgroundColor: "white",
    overflow: "hidden",
  },
  tag: {
    fontSize: 7,
    color: "#8C7D9D",
    backgroundColor: "#F6F0FC",
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 3,
  },
  vote: {
    flex: 1,
    minHeight: 30,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  more: {
    position: "absolute",
    right: 5,
    top: 5,
    padding: 4,
    borderRadius: 14,
    backgroundColor: "white",
  },
  badge: {
    position: "absolute",
    top: 5,
    left: 5,
    fontSize: 8,
    backgroundColor: "#F2FFF9",
    color: "#279879",
    borderRadius: 12,
    padding: 4,
  },
  result: {
    backgroundColor: purple,
    borderRadius: 22,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  small: { fontFamily: "Inter", fontSize: 11, color: muted, lineHeight: 16 },
  error: { color: "#B43F60", fontSize: 12, lineHeight: 18, marginBottom: 10 },
  footer: {
    flexShrink: 0,
    paddingHorizontal: 24,
    paddingVertical: 20,
    backgroundColor: bg,
  },
  action: {
    minHeight: 44,
    borderRadius: 28,
    backgroundColor: purple,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    boxShadow: "0 5px 8px #25123B25",
  },
  submitButton: {
    width: "100%",
    maxWidth: 370,
    alignSelf: "center",
    minHeight: 48,
    borderRadius: 28,
    backgroundColor: "#7D49D5",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    boxShadow: "0 5px 8px #25123B25",
  },
  submitButtonText: {
    fontFamily: "Inter",
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
    textAlign: "center",
  },
  actionText: { color: "white", fontSize: 14, fontWeight: "700" },
  secondary: {
    backgroundColor: "#F9F5FF",
    borderWidth: 1,
    borderColor: border,
    boxShadow: "none",
  },
  label: {
    fontFamily: "Inter",
    fontSize: 11,
    fontWeight: "500",
    color: "#697084",
  },
  input: {
    height: 40,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E7EE",
    backgroundColor: "#FAFAFC",
    paddingHorizontal: 14,
    fontFamily: "Inter",
    fontSize: 13,
    color: ink,
  },
  autofill: {
    alignItems: "center",
    padding: 22,
    borderRadius: 22,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "#DFCAFF",
    backgroundColor: "#FAF6FF",
  },
  circle: {
    width: 38,
    height: 38,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "white",
  },
  import: {
    flex: 1,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#E7DCFF",
    borderRadius: 14,
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  importText: {
    fontFamily: "Inter",
    color: purple,
    fontSize: 11,
    fontWeight: "500",
  },
  rule: { flex: 1, height: 1, backgroundColor: "#EBE5F1" },
  tagPill: {
    borderWidth: 1,
    borderColor: "#E0E4EC",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  day: {
    width: 42,
    height: 42,
    borderRadius: 24,
    backgroundColor: "#B189FF",
    alignItems: "center",
    justifyContent: "center",
  },
  insert: {
    flex: 1,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#D7D3E0",
    borderRadius: 13,
    padding: 12,
  },
  topVote: {
    position: "absolute",
    right: 12,
    top: -10,
    borderRadius: 12,
    backgroundColor: "#F6A000",
    color: "white",
    fontSize: 9,
    fontWeight: "700",
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  overlay: {
    flex: 1,
    backgroundColor: "#29134066",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
});
