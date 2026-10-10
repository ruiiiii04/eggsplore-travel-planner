import { test } from "node:test";
import assert from "node:assert/strict";
import {
  categoryHint,
  compareBudget,
  estimateTripCost,
  tripDays,
} from "../src/features/budget/estimates";

test("trip days count both the start and end day", () => {
  assert.equal(tripDays("2025-10-05", "2025-10-15"), 11);
  assert.equal(tripDays("2025-10-05", "2025-10-05"), 1);
  assert.equal(tripDays(null, "2025-10-15"), null);
  assert.equal(tripDays("2025-10-15", "2025-10-05"), null);
});

test("destination keywords pick a cost profile, case-insensitively", () => {
  assert.deepEqual(categoryHint("Tokyo, Japan", "food"), {
    low: 60,
    high: 120,
  });
  assert.deepEqual(categoryHint("OSAKA", "food"), { low: 60, high: 120 });
});

test("unknown or missing destinations fall back to the default profile", () => {
  assert.deepEqual(categoryHint("Paris", "food"), { low: 25, high: 60 });
  assert.deepEqual(categoryHint(null, "food"), { low: 25, high: 60 });
});

test("trip estimate multiplies the daily range by the number of days", () => {
  assert.deepEqual(estimateTripCost("Tokyo, Japan", "2025-10-05", "2025-10-15"), {
    days: 11,
    low: 1870,
    high: 5610,
  });
  assert.equal(estimateTripCost("Tokyo, Japan", null, null), null);
});

test("budget comparison treats the range edges as within range", () => {
  const range = { low: 1870, high: 5610 };
  assert.equal(compareBudget(1000, range), "tight");
  assert.equal(compareBudget(1870, range), "within");
  assert.equal(compareBudget(2800, range), "within");
  assert.equal(compareBudget(5610, range), "within");
  assert.equal(compareBudget(9000, range), "comfortable");
});