import DragReorderRow, { ReorderHandle, useReorderScrollEnabled } from "@/components/DragReorderRow";
import { useMemo, useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowDown, ArrowLeft, ArrowUp, CalendarDays, Check, GripVertical, MapPin, Minus, Pencil, Plane, Plus, RotateCcw, X } from "lucide-react-native";
import { adjustRecoveryTime, reorderRecoveryDay } from "./model";
import type { DisruptionActivity, DisruptionEvent, RecoveryChange } from "./model";

const ink = "#37134F", purple = "#8050C5", muted = "#89789D", line = "#EEE7F5", pale = "#F5F0FB";

export function DisruptionReviewScreen({ visible, event, activities, changes, startDate, destination, isLeader, busy, error, onClose, onChange, onPublish, onDismiss, onReset }: {
  visible: boolean;
  event: DisruptionEvent | null;
  activities: DisruptionActivity[];
  changes: RecoveryChange[];
  startDate?: string | null;
  destination?: string | null;
  isLeader: boolean;
  busy: boolean;
  error: string;
  onClose: () => void;
  onChange: (changes: RecoveryChange[]) => void;
  onPublish: () => void;
  onDismiss: () => void;
  onReset: () => void;
}) {
  const reorderScrollEnabled = useReorderScrollEnabled();
  const [resetNotice, setResetNotice] = useState("");
  const manualIds = useMemo(() => new Set(activities.filter((item) => item.start_time && item.start_time.slice(0, 10) === event?.impact_date).map((item) => item.id)), [activities, event?.impact_date]);
  const issues = useMemo(() => getScheduleIssues(changes, activities, event?.impact_date ?? ""), [changes, activities, event?.impact_date]);
  if (!event) return null;
  const eventChanges = changes.filter((change) => manualIds.has(change.item_id)).sort((a, b) => Date.parse(a.new_start_time) - Date.parse(b.new_start_time));
  const manualReview = activities.filter((item) => item.start_time && item.start_time.slice(0, 10) === event.impact_date && !changes.some((change) => change.item_id === item.id) && shouldBeManualReview(item, event));
  const canPublish = isLeader && !busy && eventChanges.length > 0 && issues.length === 0;

  return <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => { if (!busy) onClose(); }}>
    <SafeAreaView edges={["top", "bottom", "left", "right"]} style={{ flex: 1, backgroundColor: "#FBF8FD" }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={{ height: 68, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: "#F4F0F8", backgroundColor: "#FBF9FE" }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back to itinerary" disabled={busy} onPress={onClose} hitSlop={10} style={{ width: 40, height: 40, justifyContent: "center" }}><ArrowLeft size={22} color={ink} /></Pressable>
          <Text accessibilityRole="header" style={{ flex: 1, color: "#6131AB", fontFamily: "Fredoka", fontSize: 25, fontWeight: "700" }}>Review Impact</Text>
          <View style={{ width: 38 }} />
        </View>
        <ScrollView scrollEnabled={reorderScrollEnabled} style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 12, gap: 12 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={{ borderRadius: 18, borderWidth: 1, borderColor: "#EBDDFF", backgroundColor: "#F8F4FF", padding: 16, flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={{ width: 38, height: 38, borderRadius: 20, backgroundColor: "white", alignItems: "center", justifyContent: "center" }}><Pencil size={18} color={purple} /></View>
            <View style={{ flex: 1, gap: 4 }}><View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}><Text style={{ color: "#6639B2", fontSize: 13, fontWeight: "800" }}>Here is your updated plan!</Text>{event.source === "demo" && <Text style={{ color: "#8050C5", backgroundColor: "white", borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, fontSize: 8, fontWeight: "800" }}>DEMO</Text>}</View><Text style={{ color: "#6639B2", fontSize: 11, fontWeight: "700" }}>{headline(event)}</Text><View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 1 }}><Plane size={11} color={muted} /><Text style={{ color: muted, fontSize: 9 }}>{event.flight_number}</Text><Text style={{ color: "#C7BBD2", fontSize: 9 }}>·</Text><CalendarDays size={10} color={muted} /><Text style={{ color: muted, fontSize: 9 }}>{formatDate(event.flight_date)}</Text></View><Text style={{ color: muted, fontSize: 10, lineHeight: 14 }}>{isLeader ? "Use + / - to adjust times. Hold the purple handle, drag, then release to reorder before publishing." : "Review how the flight update affects your trip. The Group Leader can adjust and publish the plan."}</Text></View>
          </View>

          <ImpactDayCard event={event} activities={activities} changes={eventChanges} startDate={startDate} destination={destination} isLeader={isLeader} busy={busy} manualReview={manualReview} onChange={onChange} allChanges={changes} />

          {issues.length > 0 && <View accessibilityRole="alert" style={{ borderRadius: 13, borderWidth: 1, borderColor: "#F2C6CE", backgroundColor: "#FFF5F6", padding: 12, gap: 6 }}><Text style={{ color: "#A3324C", fontSize: 11, fontWeight: "800" }}>Resolve these schedule issues before publishing</Text>{issues.map((issue) => <Text key={issue} style={{ color: "#A3324C", fontSize: 10, lineHeight: 15 }}>• {issue}</Text>)}</View>}
          {!!error && <Text accessibilityRole="alert" style={{ color: "#B43F60", fontSize: 10, lineHeight: 15 }}>{error}</Text>}
          {isLeader && <Pressable accessibilityRole="button" accessibilityLabel="Regenerate suggested schedule" disabled={busy} onPress={() => { onReset(); setResetNotice("Suggested schedule regenerated. Manual adjustments have been reset."); }} style={{ minHeight: 40, borderRadius: 12, borderWidth: 1, borderColor: line, backgroundColor: "white", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 }}><RotateCcw size={14} color={purple} /><Text style={{ color: purple, fontSize: 11, fontWeight: "700" }}>Regenerate suggested schedule</Text></Pressable>}
          {!!resetNotice && <Text accessibilityLiveRegion="polite" style={{ color: purple, fontSize: 11, textAlign: "center" }}>{resetNotice}</Text>}
          <Pressable accessibilityRole="button" disabled={busy} onPress={onClose} style={{ alignSelf: "center", minHeight: 38, justifyContent: "center", paddingHorizontal: 12, opacity: busy ? 0.6 : 1 }}><Text style={{ color: muted, fontSize: 11 }}>Close review</Text></Pressable>
          {isLeader && <Pressable accessibilityRole="button" disabled={busy} onPress={onDismiss} style={{ alignSelf: "center", paddingVertical: 5 }}><Text style={{ color: "#A3324C", fontSize: 10, textDecorationLine: "underline" }}>Dismiss disruption</Text></Pressable>}
        </ScrollView>
        <View style={{ borderTopWidth: 1, borderTopColor: "#ECE4FA", backgroundColor: "#FBF9FE", paddingHorizontal: 24, paddingVertical: 14, gap: 8 }}>
          <Text style={{ color: muted, textAlign: "center", fontSize: 10, lineHeight: 15 }}>{isLeader ? "Your current itinerary stays unchanged until you publish." : "Only the Group Leader can publish changes to the shared itinerary."}</Text>
          {isLeader && <Pressable accessibilityRole="button" disabled={!canPublish} onPress={onPublish} style={{ minHeight: 48, borderRadius: 22, backgroundColor: purple, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, opacity: canPublish ? 1 : 0.5, elevation: 2 }}><Check size={16} color="white" /><Text style={{ color: "white", fontSize: 13, fontWeight: "800" }}>{busy ? "Publishing…" : "Confirm & Publish Plan"}</Text></Pressable>}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  </Modal>;
}

function ImpactDayCard({ event, activities, changes, allChanges, startDate, destination, isLeader, busy, manualReview, onChange }: {
  event: DisruptionEvent;
  activities: DisruptionActivity[];
  changes: RecoveryChange[];
  allChanges: RecoveryChange[];
  startDate?: string | null;
  destination?: string | null;
  isLeader: boolean;
  busy: boolean;
  manualReview: DisruptionActivity[];
  onChange: (changes: RecoveryChange[]) => void;
}) {
  const [moveNotice, setMoveNotice] = useState("");
  const [controlsFor, setControlsFor] = useState<string | null>(null);
  const dayNumber = getTripDayNumber(startDate, event.impact_date);
  const changeById = new Map(changes.map((change) => [change.item_id, change]));
  const dayActivities = activities.filter((item) => item.start_time?.slice(0, 10) === event.impact_date)
    .sort((left, right) => (changeById.get(left.id)?.new_start_time ?? left.start_time ?? "").localeCompare(changeById.get(right.id)?.new_start_time ?? right.start_time ?? ""));

  function moveActivity(from: number, to: number) {
    const next = reorderRecoveryDay(activities, allChanges, from, to, event.impact_date);
    if (!next) { setMoveNotice("This move would cross midnight. Choose another position or adjust the times."); return; }
    setMoveNotice(""); onChange(next);
  }
  function adjustTime(activity: DisruptionActivity, minutes: number) {
    const next = adjustRecoveryTime(activity, allChanges, minutes, event.impact_date);
    if (!next) return;
    setMoveNotice(""); onChange(next);
  }

  return <View style={{ borderRadius: 24, borderWidth: 1, borderColor: "#F0EDF5", backgroundColor: "white", padding: 15, marginBottom: 1 }}>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 }}>
      <View style={{ width: 42, height: 42, borderRadius: 24, backgroundColor: "#B189FF", alignItems: "center", justifyContent: "center" }}><Text style={{ color: "white", fontSize: 9, lineHeight: 12 }}>Day</Text><Text style={{ color: "white", fontSize: 17, lineHeight: 19, fontWeight: "800" }}>{dayNumber}</Text></View>
      <View style={{ flex: 1 }}><Text style={{ color: muted, fontSize: 10 }}>{formatLongDate(event.impact_date)}</Text><Text style={{ color: ink, fontSize: 14, fontWeight: "800", marginTop: 3 }}>{destination ? `Explore ${destination}` : "Affected itinerary"}</Text></View>
      <View style={{ backgroundColor: "#FFF5E8", paddingHorizontal: 9, paddingVertical: 5, borderRadius: 99 }}><Text style={{ color: "#A85D00", fontSize: 9, fontWeight: "700" }}>{changes.length} affected</Text></View>
    </View>
    <View style={{ height: 1, backgroundColor: "#F4F0F8", marginBottom: 5 }} />
    {dayActivities.map((activity, index) => {
      const change = changeById.get(activity.id);
      const canEdit = isLeader && !busy && event.leg_type !== "return" && !isCancelled(event) && (event.source === "demo" || Date.parse(activity.start_time ?? "") > Date.now());
      const nextTime = change?.new_start_time ?? activity.start_time;
      return <DragReorderRow key={activity.id} label={activity.title} index={index} max={dayActivities.length - 1} disabled={!canEdit} onTap={() => setControlsFor(controlsFor === activity.id ? null : activity.id)} onMove={(target) => moveActivity(index, target)} style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "stretch", minHeight: 78, gap: 8, borderBottomWidth: index < dayActivities.length - 1 ? 1 : 0, borderBottomColor: "#F4F0F8" }}>
        <ReorderHandle />
        <View style={{ width: 38, justifyContent: "center" }}><Text style={{ color: change ? purple : muted, fontSize: 10, fontWeight: "700" }}>{formatTime(nextTime)}</Text>{change && <Text style={{ color: muted, fontSize: 8, marginTop: 2 }}>was {formatTime(change.expected_start_time)}</Text>}</View>
        <View style={{ width: 11, alignItems: "center", paddingTop: 23 }}><View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: change ? purple : "#D1C6DC" }} />{index < dayActivities.length - 1 && <View style={{ flex: 1, borderLeftWidth: 2, borderStyle: "dashed", borderColor: "#EADDFF", marginTop: 5 }} />}</View>
        <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 9, paddingVertical: 10, paddingHorizontal: 5 }}>
          <View style={{ width: 32, height: 32, borderRadius: 18, backgroundColor: "#F5EEFF", alignItems: "center", justifyContent: "center" }}><MapPin size={15} color={purple} /></View>
          <View style={{ flex: 1, gap: 3 }}><Text numberOfLines={2} style={{ color: ink, fontSize: 11, lineHeight: 15, fontWeight: "700" }}>{activity.title}</Text>{activity.location_name ? <Text numberOfLines={1} style={{ color: muted, fontSize: 9 }}>{activity.location_name}</Text> : null}{!change && <Text style={{ color: muted, fontSize: 8 }}>{manualReview.some((item) => item.id === activity.id) ? "Needs manual review" : "Unchanged"}</Text>}</View>
          {isLeader && <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}><Pressable accessibilityRole="button" accessibilityLabel={`Move ${activity.title} 15 minutes earlier`} disabled={!canEdit || adjustRecoveryTime(activity, allChanges, -15, event.impact_date) === null} onPress={() => adjustTime(activity, -15)} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center", opacity: canEdit ? 1 : 0.4 }}><Minus size={13} color={purple} /></Pressable><Pressable accessibilityRole="button" accessibilityLabel={`Move ${activity.title} 15 minutes later`} disabled={!canEdit || adjustRecoveryTime(activity, allChanges, 15, event.impact_date) === null} onPress={() => adjustTime(activity, 15)} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center", opacity: canEdit ? 1 : 0.4 }}><Plus size={13} color={purple} /></Pressable></View>}
        </View>
        {controlsFor === activity.id && canEdit && <View style={{ flexBasis: "100%", flexDirection: "row", justifyContent: "flex-end", gap: 5, backgroundColor: "white", padding: 4, borderRadius: 12, borderWidth: 1, borderColor: line }}><Pressable accessibilityRole="button" disabled={index === 0} accessibilityLabel={`Move ${activity.title} up`} onPress={() => moveActivity(index, index - 1)} style={{ minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center", opacity: index === 0 ? 0.4 : 1 }}><ArrowUp size={13} color={purple} /></Pressable><Pressable accessibilityRole="button" disabled={index === dayActivities.length - 1} accessibilityLabel={`Move ${activity.title} down`} onPress={() => moveActivity(index, index + 1)} style={{ minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center", opacity: index === dayActivities.length - 1 ? 0.4 : 1 }}><ArrowDown size={13} color={purple} /></Pressable></View>}
      </DragReorderRow>;
    })}
    {!!moveNotice && <Text accessibilityRole="alert" style={{ color: "#A3324C", fontSize: 11, marginTop: 10 }}>{moveNotice}</Text>}
    {!dayActivities.length && <Text style={{ color: muted, fontSize: 11, lineHeight: 16, paddingVertical: 12 }}>{event.leg_type === "return" ? "Check the airport transfer and final-day schedule against your updated departure." : isCancelled(event) ? "Wait for a confirmed replacement flight before changing your plan." : "There are no scheduled itinerary events on this date to adjust."}</Text>}
    {!!manualReview.length && <View style={{ marginTop: 12, borderRadius: 13, borderWidth: 1, borderColor: "#F4D9A8", backgroundColor: "#FFFBF2", padding: 11, gap: 6 }}><Text style={{ color: "#9A5B00", fontSize: 10, fontWeight: "800" }}>Needs manual review · {manualReview.length}</Text><Text style={{ color: muted, fontSize: 9, lineHeight: 13 }}>The full delay would move these events past midnight. Use the time controls to choose a later time on this day.</Text></View>}
  </View>;
}

function getTripDayNumber(startDate: string | null | undefined, impactDate: string) {
  if (!startDate) return 1;
  const start = Date.parse(`${startDate.slice(0, 10)}T00:00:00Z`), day = Date.parse(`${impactDate}T00:00:00Z`);
  return Number.isFinite(start) && Number.isFinite(day) && day >= start ? Math.floor((day - start) / 86_400_000) + 1 : 1;
}

function formatLongDate(value: string) {
  const date = new Date(`${value.slice(0, 10)}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

function getScheduleIssues(changes: RecoveryChange[], activities: DisruptionActivity[], impactDate: string) {
  const issues: string[] = [];
  for (const change of changes) {
    if (!activities.some((item) => item.id === change.item_id)) issues.push(`${change.title} is no longer in the itinerary. Close and reopen Review Impact to refresh the draft.`);
  }
  const changedIds = new Set(changes.map((change) => change.item_id));
  const proposed = new Map<string, string>();
  for (const change of changes) {
    const expected = Date.parse(change.expected_start_time), next = Date.parse(change.new_start_time);
    if (!Number.isFinite(expected) || !Number.isFinite(next) || change.new_start_time.slice(0, 10) !== impactDate || next <= expected) {
      issues.push(`${change.title} must stay on the affected day and move later than its current time.`);
    }
    if (proposed.has(change.new_start_time)) issues.push(`Two events are scheduled at ${formatTime(change.new_start_time)}.`);
    proposed.set(change.new_start_time, change.title);
  }
  for (const change of changes) {
    const collision = activities.find((item) => !changedIds.has(item.id) && item.start_time === change.new_start_time);
    if (collision) issues.push(`${change.title} has the same start time as ${collision.title}.`);
  }
  return [...new Set(issues)];
}

function shouldBeManualReview(item: DisruptionActivity, event: DisruptionEvent) {
  if (!item.start_time || event.leg_type === "return" || isCancelled(event)) return false;
  const scheduled = event.scheduled_arrival ? Date.parse(event.scheduled_arrival) : NaN;
  if (Number.isFinite(scheduled) && Date.parse(item.start_time) < scheduled) return false;
  const providerDelay = Number.isFinite(Date.parse(event.scheduled_arrival ?? "")) && Number.isFinite(Date.parse(event.estimated_arrival ?? ""))
    ? Math.max(0, Math.round((Date.parse(event.estimated_arrival!) - Date.parse(event.scheduled_arrival!)) / 60_000)) : 0;
  const delay = Math.max(event.delay_minutes ?? 0, providerDelay);
  return delay > 0 && new Date(Date.parse(item.start_time) + delay * 60_000).toISOString().slice(0, 10) !== event.impact_date;
}

function headline(event: DisruptionEvent) {
  const status = event.flight_status.toLowerCase();
  const delay = event.delay_minutes ?? 0;
  const duration = delay >= 60 ? `${Math.floor(delay / 60)}h${delay % 60 ? ` ${delay % 60}m` : ""}` : `${delay} min`;
  if (status === "cancelled") return `Your flight ${event.flight_number} was cancelled.`;
  if (status === "diverted") return `Your flight ${event.flight_number} was diverted.`;
  return `Your flight ${event.flight_number} is delayed by ${duration}.`;
}
function isCancelled(event: DisruptionEvent) { return ["cancelled", "diverted"].includes(event.flight_status.toLowerCase()); }
function formatTime(value: string | null) { return value && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value) ? value.slice(11, 16) : "—"; }
function formatDate(value: string | null) { if (!value) return "Date not set"; const day = value.slice(0, 10); const date = new Date(`${day}T12:00:00Z`); return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }); }
function canAddFifteen(value: string, day: string) { const date = new Date(Date.parse(value) + 15 * 60_000); return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === day; }
