import { test } from "node:test";
import assert from "node:assert/strict";
import {
  localDate,
  tripStatus,
  validDate,
  validateTrip,
} from "../src/features/trips/model";
import { errorMessage } from "../src/lib/errors";
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
