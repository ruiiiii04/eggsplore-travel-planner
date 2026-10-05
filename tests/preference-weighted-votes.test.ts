import { test } from "node:test";
import assert from "node:assert/strict";
import {
  memberCategoryWeights,
  preferenceVoteWeight,
} from "../supabase/functions/_shared/preference-weights";
import { createSnapshotReader } from "../src/features/decision-engine/sharedSnapshot";
import {
  makeDraft,
  totals,
  type Candidate,
} from "../src/features/decision-engine/model";
import { poolCandidateBase } from "../src/features/decision-engine/persistence";
test("explicit weights normalize, clamp invalid values, and preserve zero exclusions", () => {
  assert.deepEqual(
    memberCategoryWeights([
      { categoryWeights: { Food: 80, Nature: 20, Beach: 0 } },
    ]),
    { Food: 0.8, Nature: 0.2, Beach: 0 },
  );
  assert.deepEqual(
    memberCategoryWeights([{ categoryWeights: { Food: 0 }, tags: ["Food"] }]),
    {},
  );
  assert.equal(preferenceVoteWeight(["Food", "Food"], { Food: 1 }), 2);
  assert.equal(preferenceVoteWeight(["unrecognized"], { Food: 1 }), 1);
  assert.deepEqual(
    memberCategoryWeights([{ categoryWeights: { Food: Infinity } }]),
    {},
  );
});
test("existing interests map into categories and extra profiles never multiply vote strength", () => {
  const profile = {
    interests: ["Street food hunting", "Specialty coffee & cafes"],
    tags: ["Food"],
  };
  assert.deepEqual(
    memberCategoryWeights([profile, profile]),
    memberCategoryWeights([profile]),
  );
  assert.equal(
    preferenceVoteWeight(["Food"], memberCategoryWeights([profile])),
    2,
  );
  const nature = { tags: ["Nature"] };
  assert.deepEqual(
    memberCategoryWeights([profile, nature, profile]),
    memberCategoryWeights([profile, nature]),
  );
});
test("all viewers get identical weighted scores, signed dislikes, accurate raw counts and fresh preferences", async () => {
  const candidates: Candidate[] = [
    {
      id: "food",
      name: "Market",
      location: "Paris",
      tags: ["Food"],
      cover: "generic",
      up: 0,
      down: 0,
      confirmed: true,
    },
    {
      id: "park",
      name: "Park",
      location: "Paris",
      tags: ["Nature"],
      cover: "generic",
      up: 0,
      down: 0,
      confirmed: true,
    },
  ];
  const members = [
    { user_id: "a", profiles: [{ categoryWeights: { Food: 100 } }] },
    { user_id: "b", profiles: [{ categoryWeights: { Nature: 100 } }] },
  ];
  const snapshot = {
    revision: "1",
    pool: { updated_at: "1", candidates, draft: null, published: null },
    members,
    votes: [
      { candidate_id: "food", user_id: "a", vote: "up" as const },
      { candidate_id: "food", user_id: "b", vote: "down" as const },
      { candidate_id: "park", user_id: "a", vote: "up" as const },
    ],
  };
  const reader = createSnapshotReader(async (_id, known) => ({
    ...snapshot,
    pool: known ? null : snapshot.pool,
  }));
  const a = (await reader("a", "trip"))!,
    b = (await reader("b", "trip"))!;
  for (const id of ["food", "park"])
    assert.equal(
      totals(
        a.pool.candidates.find((c) => c.id === id)!,
        a.pool.votes[id],
      ).score,
      totals(
        b.pool.candidates.find((c) => c.id === id)!,
        b.pool.votes[id],
      ).score,
    );
  assert.equal(totals(a.pool.candidates[0], a.pool.votes.food).score, 1);
  assert.equal(totals(a.pool.candidates[0], a.pool.votes.food).total, 2);
  assert.equal(totals(a.pool.candidates[0], "down").score, -3);
  assert.equal(totals(a.pool.candidates[0]).score, -1);
  assert.equal(
    "weightedOtherScore" in
      poolCandidateBase(a.pool.candidates[0], a.otherVotes.food),
    false,
  );
  // Same pool revision, changed member preferences: refresh must reweight votes.
  members[0].profiles = [{ categoryWeights: { Nature: 100 } }];
  const latest = (await reader("a", "trip"))!;
  assert.equal(
    totals(latest.pool.candidates[1], latest.pool.votes.park).score,
    2,
  );
  assert.equal(makeDraft(latest.pool, 1)[0].id, "park");
});
