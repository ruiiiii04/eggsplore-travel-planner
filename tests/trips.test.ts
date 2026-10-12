import { test } from "node:test";
import assert from "node:assert/strict";
import {
  localDate,
  tripStatus,
  validDate,
  validateTrip,
} from "../src/features/trips/model";
import { errorMessage } from "../src/lib/errors";
import { buildRecoveryPlan, mockDelaySummary } from "../src/features/trips/disruptions/model";
test("dates reject impossible days and accept leap days", () => {
  assert.equal(validDate("2026-02-30"), false);
  assert.equal(validDate("2024-02-29"), true);
  assert.equal(validDate("2026-02-29"), false);
  assert.equal(validDate("26-2-2"), false);
});
test("trip validation handles optional dates and chronological order", () => {
  assert.equal(validateTrip(" ", "", ""), "Enter a trip title.");
  assert.equal(validateTrip("Bali", "", ""), null);
  assert.ok(validateTrip("Bali", "", "2026-10-01"));
  assert.ok(validateTrip("Bali", "2026-10-02", "2026-10-01"));
  assert.equal(validateTrip("Bali", "2026-10-02", "2026-10-02"), null);
});
test("status includes both boundary days and handles undated trips", () => {
  assert.equal(
    tripStatus(
      { start_date: "2026-10-02", end_date: "2026-10-03" },
      "2026-10-02",
    ),
    "Live",
  );
  assert.equal(
    tripStatus(
      { start_date: "2026-10-02", end_date: "2026-10-03" },
      "2026-10-03",
    ),
    "Live",
  );
  assert.equal(
    tripStatus(
      { start_date: "2026-10-02", end_date: "2026-10-03" },
      "2026-10-04",
    ),
    "Past",
  );
  assert.equal(
    tripStatus({ start_date: "2026-10-02", end_date: null }, "2026-10-01"),
    "Upcoming",
  );
  assert.equal(tripStatus({ start_date: null, end_date: null }), "Upcoming");
});
test("local date uses the device calendar", () => {
  assert.equal(localDate(new Date(2026, 9, 2, 0, 1)), "2026-10-02");
});
test("Supabase plain-object errors retain their message", () => {
  assert.equal(
    errorMessage({ message: "Invalid login credentials" }),
    "Invalid login credentials",
  );
});
test("disruption recovery shifts only affected-day activities after arrival", () => {
  const changes = buildRecoveryPlan([
    { id: "before", title: "Lunch", start_time: "2026-10-14T11:00:00.000Z" },
    { id: "arrival", title: "Arrive and collect luggage", start_time: "2026-10-14T12:00:00.000Z" },
    { id: "later", title: "Hotel check-in", start_time: "2026-10-14T16:00:00.000Z" },
    { id: "next-day", title: "Breakfast", start_time: "2026-10-15T08:00:00.000Z" },
  ], {
    impact_date: "2026-10-14",
    scheduled_arrival: "2026-10-14T12:00:00.000Z",
    estimated_arrival: "2026-10-14T15:00:00.000Z",
    delay_minutes: 180,
    flight_status: "delayed",
  });
  assert.deepEqual(changes.map(({ item_id, new_start_time }) => [item_id, new_start_time]), [
    ["arrival", "2026-10-14T15:00:00.000Z"],
    ["later", "2026-10-14T19:00:00.000Z"],
  ]);
});
test("cancelled flights do not produce an unsafe automatic time shift", () => {
  assert.deepEqual(buildRecoveryPlan([
    { id: "arrival", title: "Arrival", start_time: "2026-10-14T12:00:00.000Z" },
  ], {
    impact_date: "2026-10-14", scheduled_arrival: "2026-10-14T12:00:00.000Z",
    estimated_arrival: null, delay_minutes: null, flight_status: "cancelled",
  }), []);
});
test("return flight disruptions do not auto-shift itinerary activities", () => {
  assert.deepEqual(buildRecoveryPlan([
    { id: "last-day", title: "Visit museum", start_time: "2026-10-18T12:00:00.000Z" },
  ], {
    impact_date: "2026-10-18", scheduled_arrival: "2026-10-18T12:00:00.000Z",
    estimated_arrival: "2026-10-18T15:00:00.000Z", delay_minutes: 180,
    flight_status: "delayed", leg_type: "return",
  }), []);
});
test("mock flight copy is explicitly labeled as a simulation", () => {
  assert.match(mockDelaySummary(), /^Demo simulation:/);
});
