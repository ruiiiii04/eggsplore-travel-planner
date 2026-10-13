import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(
  new URL("../src/features/trips/TripWorkspace.tsx", import.meta.url),
  "utf8",
);

test("the disruption card stays mounted while itinerary and notes tabs switch", () => {
  const instances = source.match(/<FlightDisruptionCard\b/g) ?? [];
  assert.equal(instances.length, 1);
  assert.match(source, /<FlightDisruptionCard showAlert=\{activeMode === "itinerary"\}/);
  assert.doesNotMatch(source, /activeMode !== "itinerary"\s*&&\s*!!user\s*&&\s*<FlightDisruptionCard/);
});
