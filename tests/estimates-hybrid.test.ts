import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_PROFILE,
  dailyCost,
  destinationKey,
  estimateFromProfile,
  knownProfile,
  parseProfile,
} from "../src/features/budget/estimates";

const range = (low: number, high: number) => ({ low, high });
const good = {
  food: range(30.4, 60.6),
  transport: range(10, 30),
  stay: range(60, 200),
  activities: range(20, 90),
  shopping: range(0, 60),
  other: range(10, 25),
};

test("chip destinations have their own profiles and unknown places do not", () => {
  assert.ok(knownProfile("Tokyo"));
  assert.ok(knownProfile("Bali"));
  assert.ok(knownProfile("Seoul, South Korea"));
  assert.ok(knownProfile("BANGKOK"));
  assert.notDeepEqual(knownProfile("Bali"), knownProfile("Seoul"));
  assert.equal(knownProfile("Lisbon"), null);
  assert.equal(knownProfile(null), null);
});

test("destination keys ignore case and extra spaces", () => {
  assert.equal(destinationKey("  New   York "), "new york");
  assert.equal(destinationKey(null), "");
});

test("daily cost sums every category", () => {
  assert.deepEqual(dailyCost(DEFAULT_PROFILE), { low: 100, high: 355 });
});

test("estimate from a profile multiplies by trip days and needs both dates", () => {
  assert.deepEqual(
    estimateFromProfile(DEFAULT_PROFILE, "2025-10-05", "2025-10-07"),
    { days: 3, low: 300, high: 1065 },
  );
  assert.equal(estimateFromProfile(DEFAULT_PROFILE, "2025-10-05", null), null);
  assert.equal(estimateFromProfile(DEFAULT_PROFILE, null, null), null);
});

test("parsed profiles are rounded and bad AI answers are rejected", () => {
  const parsed = parseProfile(good);
  assert.deepEqual(parsed?.food, { low: 30, high: 61 });
  assert.equal(parseProfile(null), null);
  assert.equal(parseProfile("text"), null);
  const { other: _missing, ...incomplete } = good;
  assert.equal(parseProfile(incomplete), null);
  assert.equal(parseProfile({ ...good, food: range(80, 20) }), null);
  assert.equal(parseProfile({ ...good, food: range(-5, 20) }), null);
  assert.equal(parseProfile({ ...good, food: range(10, 5000) }), null);
  assert.equal(parseProfile({ ...good, food: { low: "10", high: 20 } }), null);
  assert.equal(parseProfile({ ...good, food: range(10, Infinity) }), null);
});