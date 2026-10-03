import { test } from "node:test";
import assert from "node:assert/strict";
import {
  totals,
  toggleVote,
  makeDraft,
  moveStop,
  seedCandidates,
  validTime,
  tripDays,
} from "../src/features/decision-engine/model";
test("votes toggle off without phantom count and switch direction", () => {
  const votes = toggleVote({}, "a", "up");
  assert.deepEqual(toggleVote(votes, "a", "up"), {});
  assert.deepEqual(toggleVote(votes, "a", "down"), { a: "down" });
  const c = seedCandidates("Tokyo")[0];
  assert.equal(totals(c, "up").percent, 100);
  assert.equal(totals(c, "down").percent, 0);
});
test("draft respects negative votes, trip duration, rankings and input immutability", () => {
  const candidates = seedCandidates("Tokyo");
  const original = candidates.map((c) => c.id);
  const stops = makeDraft(
    {
      candidates,
      votes: { "seed-0": "down", "seed-2": "up" },
      draft: null,
      published: null,
    },
    1,
  );
  assert.equal(stops.length, 4);
  assert.equal(stops[0].id, "seed-2");
  assert.ok(!stops.some((s) => s.id === "seed-0"));
  assert.deepEqual(
    candidates.map((c) => c.id),
    original,
  );
  const moved = moveStop(stops, stops[0].id, 1);
  assert.equal(moved[1].id, stops[0].id);
  assert.equal(moved[1].time, "11:00");
  assert.equal(stops[0].time, "09:00");
});
test("destination defaults and date/time constraints", () => {
  assert.equal(seedCandidates("Paris").length, 0);
  assert.match(seedCandidates("Osaka")[0].name, /Universal/);
  assert.equal(tripDays("2026-10-03", "2026-10-05"), 3);
  assert.equal(validTime("24:00"), false);
  assert.equal(validTime("09:30"), true);
});
