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
