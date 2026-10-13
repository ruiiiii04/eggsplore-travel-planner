export type DisruptionEvent = {
  id: string;
  trip_id: string;
  flight_number: string;
  flight_date: string;
  leg_type: "outbound" | "return" | "demo";
  source: "live" | "demo";
  flight_status: string;
  delay_minutes: number | null;
  departure: string | null;
  arrival: string | null;
  scheduled_arrival: string | null;
  estimated_arrival: string | null;
  impact_date: string;
  state: "detected" | "draft_ready" | "applied" | "dismissed" | "recovered";
  summary: string;
  proposed_plan: RecoveryChange[];
  detected_at: string;
  updated_at: string;
};

export type DisruptionActivity = { id: string; title: string; start_time: string | null; location_name?: string | null };
export type RecoveryChange = {
  item_id: string;
  expected_start_time: string;
  new_start_time: string;
  title: string;
};

export function buildRecoveryPlan(
  activities: DisruptionActivity[],
  event: Pick<DisruptionEvent, "impact_date" | "scheduled_arrival" | "estimated_arrival" | "delay_minutes" | "flight_status"> & { leg_type?: DisruptionEvent["leg_type"] },
): RecoveryChange[] {
  return assessRecovery(activities, event).changes;
}

export function buildManualReviewActivities(
  activities: DisruptionActivity[],
  event: Pick<DisruptionEvent, "impact_date" | "scheduled_arrival" | "estimated_arrival" | "delay_minutes" | "flight_status"> & { leg_type?: DisruptionEvent["leg_type"] },
): DisruptionActivity[] {
  return assessRecovery(activities, event).manualReview;
}

function assessRecovery(
  activities: DisruptionActivity[],
  event: Pick<DisruptionEvent, "impact_date" | "scheduled_arrival" | "estimated_arrival" | "delay_minutes" | "flight_status"> & { leg_type?: DisruptionEvent["leg_type"] },
) {
  if (event.leg_type === "return") return { changes: [] as RecoveryChange[], manualReview: [] as DisruptionActivity[] };
  const scheduled = event.scheduled_arrival ? Date.parse(event.scheduled_arrival) : NaN;
  const estimated = event.estimated_arrival ? Date.parse(event.estimated_arrival) : NaN;
  const providerDelta = Number.isFinite(scheduled) && Number.isFinite(estimated)
    ? Math.max(0, Math.round((estimated - scheduled) / 60_000)) : 0;
  const delay = Math.max(event.delay_minutes ?? 0, providerDelta);
  if (delay <= 0 || ["cancelled", "diverted"].includes(event.flight_status.toLowerCase())) {
    return { changes: [] as RecoveryChange[], manualReview: [] as DisruptionActivity[] };
  }
  const candidates = activities
    .filter((item): item is DisruptionActivity & { start_time: string } =>
      !!item.start_time && item.start_time.slice(0, 10) === event.impact_date &&
      (!Number.isFinite(scheduled) || Date.parse(item.start_time) >= scheduled),
    )
    .sort((left, right) => left.start_time.localeCompare(right.start_time));
  const changes: RecoveryChange[] = [];
  const manualReview: DisruptionActivity[] = [];
  for (const item of candidates) {
    const oldAt = Date.parse(item.start_time);
    if (!Number.isFinite(oldAt)) continue;
    const shifted = new Date(oldAt + delay * 60_000).toISOString();
    // Same-day movement is safe to publish; next-day movement needs a person to review it.
    if (shifted.slice(0, 10) !== event.impact_date) manualReview.push(item);
    else changes.push({ item_id: item.id, expected_start_time: item.start_time, new_start_time: shifted, title: item.title });
  }
  return { changes, manualReview };
}

export function mockDelaySummary(flightNumber = "DEMO123", delayMinutes = 180) {
  return `Demo simulation: flight ${flightNumber} is delayed by ${delayMinutes} minutes.`;
}

// Manual review changes still obey the same-day, forward-only publication rules.
export function adjustRecoveryTime(activity: DisruptionActivity, changes: RecoveryChange[], minutes: number, day: string): RecoveryChange[] | null {
 if (!activity.start_time) return null;
 const current = changes.find((change) => change.item_id === activity.id);
 const expected = Date.parse(activity.start_time), next = Date.parse(current?.new_start_time ?? activity.start_time) + minutes * 60_000;
 if (!Number.isFinite(next) || next < expected || new Date(next).toISOString().slice(0, 10) !== day) return null;
 const others = changes.filter((change) => change.item_id !== activity.id);
 if (next === expected) return others;
 return [...others, { item_id: activity.id, title: activity.title, expected_start_time: activity.start_time, new_start_time: new Date(next).toISOString() }];
}
export function reorderRecoveryDay(activities: DisruptionActivity[], changes: RecoveryChange[], from: number, to: number, day: string): RecoveryChange[] | null {
 const byId = new Map(changes.map((change) => [change.item_id, change]));
 const ordered = activities.filter((item) => item.start_time?.slice(0, 10) === day).sort((a, b) => Date.parse(byId.get(a.id)?.new_start_time ?? a.start_time!) - Date.parse(byId.get(b.id)?.new_start_time ?? b.start_time!));
 if (from < 0 || to < 0 || from >= ordered.length || to >= ordered.length || from === to) return null;
 const slots = ordered.map((item) => Date.parse(byId.get(item.id)?.new_start_time ?? item.start_time!));
 const [moving] = ordered.splice(from, 1); ordered.splice(to, 0, moving);
 let previous = -Infinity;
 const replacement: RecoveryChange[] = [];
 for (const [index, item] of ordered.entries()) {
  const original = Date.parse(item.start_time!);
  const next = Math.max(slots[index], original, previous + 15 * 60_000);
  if (!Number.isFinite(next) || new Date(next).toISOString().slice(0, 10) !== day) return null;
  previous = next;
  if (next > original) replacement.push({ item_id: item.id, title: item.title, expected_start_time: item.start_time!, new_start_time: new Date(next).toISOString() });
 }
 const ids = new Set(ordered.map((item) => item.id));
 return [...changes.filter((change) => !ids.has(change.item_id)), ...replacement];
}
