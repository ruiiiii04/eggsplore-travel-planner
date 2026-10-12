import { useCallback, useState } from "react";
import type { ReactNode } from "react";
import { Image, Pressable, Switch, Text, TextInput, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { AlertTriangle, Check, Plane, RefreshCw } from "lucide-react-native";
import { BottomSheet } from "@/components/ui";
import { errorMessage } from "@/lib/errors";
import { getSupabase } from "@/lib/supabase";
import { CalendarDateField } from "../creation/CalendarDateField";
import { buildRecoveryPlan, type DisruptionActivity, type DisruptionEvent, type RecoveryChange } from "./model";
import { DisruptionReviewScreen } from "./DisruptionReviewScreen";

const ink = "#37134F", purple = "#8050C5", muted = "#89789D", line = "#EEE7F5", pale = "#F5F0FB";
const inputStyle = { minHeight: 42, borderRadius: 12, borderWidth: 1, borderColor: line, backgroundColor: "white", paddingHorizontal: 12, color: ink, fontSize: 13 } as const;

type SavedFlight = {
  id: string; trip_id: string; user_id: string; flight_number: string; flight_date: string;
  leg_type: "outbound" | "return" | "demo";
  share_with_trip: boolean; monitoring_enabled: boolean; is_demo: boolean; last_status: string | null;
  last_delay_minutes: number | null; last_departure: string | null; last_arrival: string | null;
  last_checked_at: string | null; scheduled_arrival: string | null; estimated_arrival: string | null;
};
type FlightLeg = "outbound" | "return";
type FlightDraft = { number: string; date: string; share: boolean; monitor: boolean };

export function FlightDisruptionCard({ tripId, userId, startDate, destination, isLeader, activities, onItineraryChanged, showSetup = false, showAlert = false, fallback, onCloseSetup }: {
  tripId: string; userId: string; startDate?: string | null; destination?: string | null; isLeader: boolean;
  activities: DisruptionActivity[];
  onItineraryChanged: () => void;
  showSetup?: boolean;
  showAlert?: boolean;
  fallback?: ReactNode;
  onCloseSetup?: () => void;
}) {
  const [flights, setFlights] = useState<SavedFlight[]>([]);
  const [event, setEvent] = useState<DisruptionEvent | null>(null);
  const [drafts, setDrafts] = useState<Record<FlightLeg, FlightDraft>>({
    outbound: { number: "", date: startDate ?? "", share: false, monitor: true },
    return: { number: "", date: "", share: false, monitor: true },
  });
  const [editingLeg, setEditingLeg] = useState<FlightLeg | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [draft, setDraft] = useState<RecoveryChange[]>([]);
  const [suggestedDraft, setSuggestedDraft] = useState<RecoveryChange[]>([]);
  const [reviewMessage, setReviewMessage] = useState("");

  const refresh = useCallback(async () => {
    const db = getSupabase();
    const [flightResult, eventResult] = await Promise.all([
      db.from("trip_flights").select("*").eq("trip_id", tripId).eq("user_id", userId).in("leg_type", ["outbound", "return"]).order("flight_date", { ascending: true }),
      db.from("trip_disruptions").select("*").eq("trip_id", tripId).order("detected_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (flightResult.error && !flightResult.error.message.includes("does not exist")) setError(flightErrorMessage(flightResult.error));
    if (flightResult.data) {
      const saved = (flightResult.data as SavedFlight[]).filter((flight) => flight.leg_type === "outbound" || flight.leg_type === "return");
      setFlights(saved);
      setDrafts((current) => {
        const next = { ...current };
        for (const flight of saved) {
          if (editingLeg === flight.leg_type) continue;
          if (flight.leg_type === "outbound" || flight.leg_type === "return") next[flight.leg_type] = { number: flight.flight_number, date: flight.flight_date, share: flight.share_with_trip, monitor: flight.monitoring_enabled };
        }
        return next;
      });
    } else if (!flightResult.error) {
      setFlights([]);
    }
    if (eventResult.error && !eventResult.error.message.includes("does not exist")) setError(flightErrorMessage(eventResult.error));
    setEvent((eventResult.data as DisruptionEvent | null) ?? null);
  }, [tripId, userId, startDate, editingLeg]);

  useFocusEffect(useCallback(() => {
    void refresh();
    if (!tripId) return;
    const db = getSupabase();
    // Expo Router can keep the previous stack screen mounted, and React Strict
    // Mode can reconnect effects quickly. Give every focused subscription its
    // own topic and remove it as soon as the screen blurs.
    const channel = db.channel(`trip-disruptions:${tripId}:${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "trip_disruptions", filter: `trip_id=eq.${tripId}` }, () => { void refresh(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "trip_flights", filter: `trip_id=eq.${tripId}` }, () => { void refresh(); })
      .subscribe();
    return () => { void db.removeChannel(channel); };
  }, [tripId, refresh]));

  const liveDisruption = event && ["detected", "draft_ready"].includes(event.state) ? event : null;

  function currentFlight(leg: FlightLeg) { return flights.find((item) => item.leg_type === leg) ?? null; }
  function updateDraft(leg: FlightLeg, changes: Partial<FlightDraft>) {
    setDrafts((current) => ({ ...current, [leg]: { ...current[leg], ...changes } }));
  }
  async function saveFlight(leg: FlightLeg): Promise<SavedFlight | null> {
    const draft = drafts[leg];
    const flight = currentFlight(leg);
    const flightNumber = draft.number.trim().toUpperCase().replace(/\s+/g, "");
    if (!/^[A-Z0-9]{2,3}\d{1,4}$/.test(flightNumber)) { setError("Enter a flight number such as MH123 or AK6123."); return null; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date) || Number.isNaN(Date.parse(`${draft.date}T12:00:00Z`)) || new Date(`${draft.date}T12:00:00Z`).toISOString().slice(0, 10) !== draft.date) { setError("Enter a valid flight date as YYYY-MM-DD."); return null; }
    setBusy(true); setError("");
    try {
      const values = { flight_number: flightNumber, flight_date: draft.date, share_with_trip: draft.share, monitoring_enabled: draft.monitor };
      const result = flight
        ? await getSupabase().from("trip_flights").update(values).eq("id", flight.id).select("*").single()
        : await getSupabase().from("trip_flights").insert({ trip_id: tripId, user_id: userId, leg_type: leg, ...values }).select("*").single();
      if (result.error) throw result.error;
      const saved = result.data as SavedFlight;
      setFlights((current) => [...current.filter((item) => item.leg_type !== leg), saved]);
      setDrafts((current) => ({ ...current, [leg]: { number: saved.flight_number, date: saved.flight_date, share: saved.share_with_trip, monitor: saved.monitoring_enabled } }));
      setEditingLeg(null);
      return saved;
    } catch (cause) { setError(flightErrorMessage(cause)); return null; }
    finally { setBusy(false); }
  }

  async function checkNow(leg: FlightLeg) {
    const saved = await saveFlight(leg);
    if (!saved) return;
    setBusy(true); setError("");
    try {
      const { data, error: failure } = await getSupabase().functions.invoke("check-flight-status", { body: { flightId: saved.id } });
      if (failure) {
        const response = (failure as { context?: Response }).context;
        let detail = "";
        try { if (response) detail = String((await response.clone().json())?.error ?? ""); } catch { /* Keep SDK message. */ }
        throw new Error(detail || flightErrorMessage(failure));
      }
      if (data?.error) throw new Error(String(data.error));
      await refresh();
    } catch (cause) { setError(flightErrorMessage(cause)); }
    finally { setBusy(false); }
  }

  async function simulate() {
    setBusy(true); setError("");
    try {
      const { error: failure } = await getSupabase().rpc("simulate_trip_flight_disruption", { target_trip: tripId });
      if (failure) throw failure;
      await refresh();
    } catch (cause) { setError(flightErrorMessage(cause)); }
    finally { setBusy(false); }
  }

  async function openReview() {
    if (!liveDisruption) return;
    const nextDraft = liveDisruption.leg_type === "return" ? [] : buildRecoveryPlan(activities, liveDisruption);
    setDraft(nextDraft); setSuggestedDraft(nextDraft); setReviewMessage("");
    if (showSetup) {
      onCloseSetup?.();
      setTimeout(() => setReviewOpen(true), 280);
    } else setReviewOpen(true);
    if (isLeader) {
      const { error: failure } = await getSupabase().rpc("save_trip_disruption_plan", { target_event: liveDisruption.id, proposed: nextDraft });
      if (failure) setReviewMessage(flightErrorMessage(failure));
    }
  }

  async function applyPlan() {
    if (!liveDisruption || !isLeader || !draft.length) return;
    setBusy(true); setReviewMessage("");
    try {
      const { error: saveFailure } = await getSupabase().rpc("save_trip_disruption_plan", { target_event: liveDisruption.id, proposed: draft });
      if (saveFailure) throw saveFailure;
      const { error: failure } = await getSupabase().rpc("apply_trip_disruption_plan", { target_event: liveDisruption.id });
      if (failure) throw failure;
      setReviewOpen(false); await refresh(); onItineraryChanged();
    } catch (cause) { setReviewMessage(flightErrorMessage(cause)); }
    finally { setBusy(false); }
  }

  async function dismiss() {
    if (!event || !isLeader) return;
    setBusy(true); setReviewMessage("");
    const { error: failure } = await getSupabase().rpc("dismiss_trip_disruption", { target_event: event.id });
    if (failure) setReviewMessage(flightErrorMessage(failure)); else { setReviewOpen(false); await refresh(); }
    setBusy(false);
  }

  const applied = event?.state === "applied";

  return <>
    {showAlert && liveDisruption ? <View style={{ marginHorizontal: 6, marginTop: 4, marginBottom: 20, minHeight: 126, borderRadius: 20, borderWidth: 1, borderColor: "#FFE8CC", backgroundColor: "#FFF9F0", paddingHorizontal: 12, paddingVertical: 12, shadowColor: "#000000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 }}>
      <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 7 }}>
        <View style={{ flex: 1, justifyContent: "space-between", gap: 4, minWidth: 0 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            <AlertTriangle size={12} color="#D97706" strokeWidth={2} />
            <Text style={{ color: "#D97706", fontFamily: "Inter", fontSize: 10, lineHeight: 15, fontWeight: "700" }}>Disruption Detected</Text>
          </View>
          <Text numberOfLines={4} style={{ color: "#5D3A9B", fontFamily: "Inter", fontSize: 12, lineHeight: 17, fontWeight: "800" }}>{disruptionHeadline(liveDisruption)}</Text>
          <Text numberOfLines={2} style={{ color: "#6B7280", fontFamily: "Inter", fontSize: 9, lineHeight: 13 }}>{liveDisruption.leg_type === "return" ? "Check your final-day plans and airport transfer." : "Tap to see how this affects your plan."}</Text>
        </View>
        <Image
          accessibilityLabel="Worried Eggsplore mascot in windy weather"
          source={require("../../../../assets/flight-disruption-mascot.png")}
          resizeMode="contain"
          style={{ width: 54, height: 50 }}
        />
        <Pressable accessibilityRole="button" accessibilityLabel="Review flight disruption impact" hitSlop={8} onPress={() => void openReview()} style={{ height: 34, width: 90, borderRadius: 999, backgroundColor: "#7B4BD5", alignItems: "center", justifyContent: "center", paddingHorizontal: 7 }}><Text numberOfLines={2} style={{ color: "white", fontFamily: "Inter", fontSize: 9, lineHeight: 12, fontWeight: "700", textAlign: "center" }}>Review Impact</Text></Pressable>
      </View>
    </View> : showAlert && applied ? <View style={{ marginHorizontal: 0, marginBottom: 14, borderRadius: 18, borderWidth: 1, borderColor: "#CBE9DC", backgroundColor: "#F1FBF5", padding: 14, flexDirection: "row", alignItems: "center", gap: 8 }}><Check size={17} color="#16845B" /><Text style={{ flex: 1, color: "#16845B", fontSize: 12, fontWeight: "700" }}>Recovery plan published</Text><Text style={{ color: muted, fontSize: 10 }}>{event?.flight_number}</Text></View> : showAlert ? fallback ?? null : null}

    <BottomSheet visible={showSetup} title="Flight details" onClose={() => onCloseSetup?.()} busy={busy}>
      <Text style={{ color: muted, fontSize: 11, lineHeight: 16, marginBottom: 10 }}>Add your flights separately. A return flight is optional; each member manages their own flight details.</Text>
      {(["outbound", "return"] as const).map((leg) => {
        const saved = currentFlight(leg), draftFlight = drafts[leg], editing = editingLeg === leg;
        const label = leg === "outbound" ? "Outbound flight" : "Return flight (optional)";
        const updateOption = async (field: "share_with_trip" | "monitoring_enabled", value: boolean) => {
          if (!saved) return;
          updateDraft(leg, field === "share_with_trip" ? { share: value } : { monitor: value });
          const { error: failure } = await getSupabase().from("trip_flights").update({ [field]: value }).eq("id", saved.id);
          if (failure) setError(errorMessage(failure)); else void refresh();
        };
        return <View key={leg} style={{ borderRadius: 18, borderWidth: 1, borderColor: line, backgroundColor: "white", padding: 13, gap: 9, marginBottom: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}><Plane size={15} color={purple} /><Text style={{ color: ink, fontSize: 12, fontWeight: "700", flex: 1 }}>{label}</Text></View>
          {saved && !editing ? <>
            <Text style={{ color: muted, fontSize: 10 }}>{saved.flight_number} · {saved.flight_date}{saved.last_status ? ` · ${saved.last_status.replaceAll("_", " ")}` : " · Waiting for first check"}</Text>
            {saved.last_checked_at && <Text style={{ color: muted, fontSize: 9 }}>Last checked {relativeTime(saved.last_checked_at)}{saved.last_delay_minutes !== null ? ` · ${saved.last_delay_minutes} min delay` : ""}</Text>}
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}><Text style={{ flex: 1, color: ink, fontSize: 10 }}>Share disruption with trip members</Text><Switch value={draftFlight.share} onValueChange={(value) => void updateOption("share_with_trip", value)} trackColor={{ false: "#DED6E7", true: "#DCC8F2" }} thumbColor={draftFlight.share ? purple : "#FFFFFF"} /></View>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}><Text style={{ flex: 1, color: ink, fontSize: 10 }}>Monitor near departure</Text><Switch value={draftFlight.monitor} onValueChange={(value) => void updateOption("monitoring_enabled", value)} trackColor={{ false: "#DED6E7", true: "#DCC8F2" }} thumbColor={draftFlight.monitor ? purple : "#FFFFFF"} /></View>
            <View style={{ flexDirection: "row", gap: 8 }}><Pressable accessibilityRole="button" disabled={busy} onPress={() => void checkNow(leg)} style={{ flex: 1, minHeight: 38, borderRadius: 12, backgroundColor: purple, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, opacity: busy ? 0.6 : 1 }}><RefreshCw size={13} color="white" /><Text style={{ color: "white", fontSize: 10, fontWeight: "700" }}>{busy ? "Checking…" : "Check now"}</Text></Pressable><Pressable accessibilityRole="button" onPress={() => setEditingLeg(leg)} style={{ minHeight: 38, borderRadius: 12, backgroundColor: pale, paddingHorizontal: 12, alignItems: "center", justifyContent: "center" }}><Text style={{ color: purple, fontSize: 10, fontWeight: "700" }}>Edit</Text></Pressable></View>
          </> : <>
            <TextInput accessibilityLabel={`${label} number`} value={draftFlight.number} onChangeText={(value) => updateDraft(leg, { number: value })} placeholder="Flight number, e.g. MH123" placeholderTextColor="#A99CB5" autoCapitalize="characters" autoCorrect={false} style={inputStyle} />
            <CalendarDateField label="Flight date" title={`${label} date`} value={draftFlight.date} onChange={(value) => updateDraft(leg, { date: value })} inline />
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}><Text style={{ flex: 1, color: muted, fontSize: 10 }}>Share disruption with trip members</Text><Switch value={draftFlight.share} onValueChange={(value) => updateDraft(leg, { share: value })} trackColor={{ false: "#DED6E7", true: "#DCC8F2" }} thumbColor={draftFlight.share ? purple : "#FFFFFF"} /></View>
            <Pressable accessibilityRole="button" disabled={busy} onPress={() => void saveFlight(leg)} style={{ minHeight: 39, borderRadius: 12, backgroundColor: purple, alignItems: "center", justifyContent: "center", opacity: busy ? 0.6 : 1 }}><Text style={{ color: "white", fontSize: 10, fontWeight: "700" }}>{busy ? "Saving…" : "Save flight"}</Text></Pressable>
          </>}
        </View>;
      })}
      {!!error && <Text accessibilityRole="alert" style={{ color: "#B43F60", fontSize: 10, lineHeight: 15 }}>{error}</Text>}
      {isLeader && <Pressable accessibilityRole="button" disabled={busy} onPress={() => void simulate()} style={{ alignSelf: "flex-start", paddingVertical: 4, opacity: busy ? 0.5 : 1 }}><Text style={{ color: muted, fontSize: 10, textDecorationLine: "underline" }}>Demo: simulate a 3-hour delay</Text></Pressable>}
    </BottomSheet>

    <DisruptionReviewScreen visible={reviewOpen} event={liveDisruption} activities={activities} changes={draft} startDate={startDate} destination={destination} isLeader={isLeader} busy={busy} error={reviewMessage} onChange={setDraft} onClose={() => setReviewOpen(false)} onPublish={() => void applyPlan()} onDismiss={() => void dismiss()} onReset={() => setDraft(suggestedDraft)} />
  </>;
}

function relativeTime(value: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - Date.parse(value)) / 60_000));
  if (!Number.isFinite(minutes) || minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours} h ago`;
}

function disruptionHeadline(event: DisruptionEvent) {
  const code = (value: string | null) => {
    if (!value) return null;
    const embedded = value.match(/\(([A-Z]{3})\)/)?.[1];
    return embedded ?? (/^[A-Z]{3}$/.test(value) ? value : null);
  };
  const origin = code(event.departure), destination = code(event.arrival);
  const route = origin && destination ? `${origin} → ${destination}` : event.flight_number;
  const status = event.flight_status.toLowerCase();
  if (status === "cancelled") return `Your flight ${route} was cancelled.`;
  if (status === "diverted") return `Your flight ${route} was diverted.`;
  const delay = event.delay_minutes ?? 0;
  const hours = Math.floor(delay / 60), minutes = delay % 60;
  const duration = hours ? `${hours} ${hours === 1 ? "hour" : "hours"}${minutes ? ` ${minutes} min` : ""}` : `${delay} min`;
  return `Your flight ${route} is delayed by ${duration}.`;
}

function flightErrorMessage(value: unknown) {
  const message = errorMessage(value);
  if (/PGRST202|PGRST205|schema cache|could not find the function|could not find the table/i.test(message)) {
    return "Flight monitoring is not set up on this Supabase project yet. Apply migration 027 to enable saved flights and demo disruptions.";
  }
  return message;
}
