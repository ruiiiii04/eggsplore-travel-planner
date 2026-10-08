import { test } from "node:test";
import assert from "node:assert/strict";
import { summarizeGroupPreferences } from "../supabase/functions/generate-candidates/group-preferences";
test("each member contributes equally despite extra profiles and repeated tags", () => {
  const summary = summarizeGroupPreferences([
    {
      profiles: [
        { tags: ["Food", "food"], interests: ["Coffee"] },
        { tags: ["Food"], interests: ["Coffee"] },
      ],
    },
    { profiles: [{ tags: ["Nature"] }] },
  ]);
  assert.equal(summary.membersWithPreferences, 2);
  assert.deepEqual(
    summary.interests.find((v) => v.interest === "Nature"),
    { interest: "Nature", members: 1, weight: 0.5 },
  );
  assert.equal(
    summary.interests.find((v) => v.interest === "Food")?.weight,
    0.25,
  );
  assert.equal(
    summary.interests.find((v) => v.interest === "Food")?.members,
    1,
  );
});
test("every member's preferences are retained without identities or private fields", () => {
  const input = Array.from({ length: 12 }, (_, i) => ({
    id: "private-user-" + i,
    email: "private@example.com",
    emergency_contact: { phone: "private-phone" },
    profiles: [
      {
        name: "private-name",
        tags: ["interest-" + i],
        pace: "Relaxed",
        spendingOrder: ["Food", "Stay"],
      },
    ],
  }));
  const summary = summarizeGroupPreferences(input);
  assert.equal(summary.membersTotal, 12);
  assert.equal(summary.membersWithPreferences, 12);
  assert.equal(summary.interests.length, 12);
  assert(!JSON.stringify(summary).includes("private"));
  assert.equal(summary.travelPace.Relaxed, 12);
  assert(summary.spendingPriorities.Food > summary.spendingPriorities.Stay);
});
test("category percentages feed AI suggestions with equal member weighting", () => {
  const summary = summarizeGroupPreferences([
    { profiles: [{ categoryWeights: { Food: 80, Nature: 20 } }] },
    { profiles: [{ categoryWeights: { Nature: 100 } }] },
  ]);
  assert.equal(summary.membersWithPreferences, 2);
  assert.deepEqual(summary.categoryWeights, { Food: 0.4, Nature: 0.6 });
});

test("missing or malformed profiles do not fabricate preferences", () => {
  assert.equal(
    summarizeGroupPreferences([
      { profiles: [] },
      { profiles: "broken" },
      {
        profiles: [
          { tags: 12, interests: [null], settings: { units: "metric" } },
        ],
      },
    ]).membersWithPreferences,
    0,
  );
  assert.deepEqual(summarizeGroupPreferences(null).interests, []);
});
