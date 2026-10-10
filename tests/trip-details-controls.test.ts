import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calendarCells,
  parseBudget,
  formatBudget,
  adjustBudget,
} from "../src/features/trips/creation/detailsModel";
test("calendar aligns Monday weeks, leap days and month endings", () => {
  const leap = calendarCells(2028, 1);
  assert.equal(leap.length % 7, 0);
  assert(leap.includes("2028-02-29"));
  assert(!calendarCells(2027, 1).includes("2027-02-29"));
  const october = calendarCells(2026, 9);
  assert.deepEqual(october.slice(0, 4), [null, null, null, "2026-10-01"]);
  assert(october.includes("2026-10-31"));
  assert.equal(calendarCells(2026, 10)[6], "2026-11-01");
});
test("budget parses formatted amounts and adjusts both bounds without crossing", () => {
  assert.deepEqual(parseBudget(formatBudget(1000, 2000)), [1000, 2000]);
  assert.deepEqual(adjustBudget([1000, 2000], 0, 2700), [2000, 2000]);
  assert.deepEqual(adjustBudget([1000, 2000], 1, 30100), [1000, 30000]);
  assert.deepEqual(adjustBudget([1000, 2000], 0, 100), [1000, 2000]);
  assert.deepEqual(adjustBudget([1000, 2000], 1, 3760), [1000, 3800]);
});
