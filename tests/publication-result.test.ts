import { test } from "node:test";
import assert from "node:assert/strict";
import { readPublicationResult } from "../src/features/decision-engine/publication";
test("publication returns persisted IDs and flexible day counts for immediate itinerary display", () => {
  const input = {
    revision: "2026-10-05T12:00:00Z",
    flexibleDayCount: 3,
    items: [
      {
        id: "saved-id",
        title: "Seoul Palace",
        description: "Day 3 \u00b7 14:00",
        activity_category: "sightseeing",
        location_name: "Seoul",
        start_time: null,
        position: 0,
      },
    ],
  };
  const result = readPublicationResult(input);
  assert.deepEqual(result, input);
  assert.equal(result.items[0].id, "saved-id");
  assert.equal(result.flexibleDayCount, 3);
});
test("missing or empty publication responses cannot be mistaken for a saved itinerary", () => {
  for (const value of [
    null,
    "old revision response",
    { revision: "timestamp", items: [] },
    { revision: "timestamp", items: [{ title: "Missing ID", position: 0 }] },
  ])
    assert.throws(() => readPublicationResult(value), /Reopen/);
});
