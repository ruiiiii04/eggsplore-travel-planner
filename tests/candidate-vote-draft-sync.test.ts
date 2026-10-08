import { test } from "node:test";
import assert from "node:assert/strict";
import {
  makeReviewDraft,
  synchronizeReviewDraft,
  setCandidateDraftSelection,
  removeReviewStop,
  type ExistingReviewItem,
} from "../src/features/decision-engine/reviewDraft";
import { createSnapshotReader } from "../src/features/decision-engine/sharedSnapshot";
import { createPoolStore } from "../src/features/decision-engine/persistence";
import type {
  Candidate,
  Pool,
  Vote,
} from "../src/features/decision-engine/model";

const candidate = (id: string, name = id): Candidate => ({
  id,
  name,
  location: "Seoul",
  tags: [],
  cover: "generic",
  up: 0,
  down: 0,
  confirmed: true,
});
const pool = (): Pool => ({
  candidates: [candidate("a", "Namsan Tower"), candidate("b", "Palace")],
  votes: {},
  draft: null,
  published: null,
});
const existing: ExistingReviewItem[] = [
  {
    id: "saved-a",
    title: "Namsan Tower",
    description: "Day 1 ? 09:00",
    activity_category: "sightseeing",
    location_name: "Seoul",
    start_time: null,
    position: 0,
  },
];

test("removing an In Draft place also removes its published itinerary counterpart on repeated review", () => {
  let state = synchronizeReviewDraft(pool(), 1, existing);
  state = setCandidateDraftSelection(state, "a", false, existing);
  for (let i = 0; i < 2; i++)
    state = synchronizeReviewDraft(state, 1, existing);
  assert.equal(state.candidates.find((c) => c.id === "a")?.confirmed, false);
  assert.equal(
    state.draft?.some((s) => s.existingId === "saved-a"),
    false,
  );
  assert.equal(
    state.draft?.some((s) => s.id === "b"),
    true,
  );
  state = setCandidateDraftSelection(state, "a", true, existing);
  state = synchronizeReviewDraft(state, 1, existing);
  assert.equal(
    state.draft?.filter((s) => s.existingId === "saved-a").length,
    1,
  );
});
test("removing a new review activity deselects it and keeps it removed after reopening", () => {
  const state = synchronizeReviewDraft(pool(), 1, []);
  const removed = removeReviewStop(
    state,
    state.draft!.find((s) => s.id === "a")!,
    [],
  );
  const reviewed = synchronizeReviewDraft(removed, 1, []);
  assert.equal(
    reviewed.draft?.some((s) => s.id === "a"),
    false,
  );
  assert.equal(reviewed.candidates.find((c) => c.id === "a")?.confirmed, false);
});
test("removing a saved review activity keeps its matching candidate deselected", () => {
  const state = synchronizeReviewDraft(pool(), 1, existing);
  const removed = removeReviewStop(
    state,
    state.draft!.find((s) => s.existingId)!,
    existing,
  );
  assert.equal(
    synchronizeReviewDraft(removed, 1, existing).draft?.some(
      (s) => s.existingId,
    ),
    false,
  );
  assert.equal(removed.candidates[0].confirmed, false);
});
test("normal review preserves edits and manual additions while another candidate is removed", () => {
  const state = synchronizeReviewDraft(pool(), 2, []);
  state.draft = state.draft!.map((s) =>
    s.id === "b" ? { ...s, title: "Edited Palace", day: 2, time: "17:00" } : s,
  );
  state.draft.push({
    id: "manual-one",
    title: "Lunch",
    location: "Seoul",
    day: 1,
    time: "12:30",
  });
  const reviewed = synchronizeReviewDraft(
    setCandidateDraftSelection(state, "a", false, []),
    2,
    [],
  );
  assert.deepEqual(
    reviewed.draft?.find((s) => s.id === "b"),
    state.draft.find((s) => s.id === "b"),
  );
  assert.equal(
    reviewed.draft?.some((s) => s.id === "manual-one"),
    true,
  );
  assert.equal(
    reviewed.draft?.some((s) => s.id === "a"),
    false,
  );
});
test("changed saved itinerary invalidates an old exclusion; explicit rebuild restores saved activities", () => {
  const removed = setCandidateDraftSelection(pool(), "a", false, existing);
  const changed = [{ ...existing[0], title: "Renamed tower" }];
  assert.equal(
    synchronizeReviewDraft(removed, 1, changed).draft?.some(
      (s) => s.existingId,
    ),
    true,
  );
  assert.equal(
    synchronizeReviewDraft(
      { ...removed, draft: null, draftExcludedExisting: {} },
      1,
      existing,
    ).draft?.some((s) => s.existingId),
    true,
  );
});
test("unchanged photo pools reuse base data while refreshing votes without double counting", async () => {
  const row = {
    updated_at: "r1",
    candidates: [
      { ...candidate("a"), up: 2, image: "data:image/jpeg;base64,photo" },
    ],
    draft: null,
    published: null,
  };
  const known: (string | null)[] = [];
  let count = 0;
  const reader = createSnapshotReader(async (_trip, revision) => {
    known.push(revision);
    count++;
    return {
      revision: "r1",
      pool: revision ? null : row,
      votes:
        count === 1
          ? []
          : [{ candidate_id: "a", user_id: "other", vote: "up" }],
    };
  });
  assert.equal((await reader("me", "trip"))?.pool.candidates[0].up, 2);
  assert.equal((await reader("me", "trip"))?.pool.candidates[0].up, 3);
  assert.equal((await reader("me", "trip"))?.pool.candidates[0].up, 3);
  assert.equal(row.candidates[0].up, 2);
  assert.deepEqual(known, [null, "r1", "r1"]);
});
test("snapshot cache isolates accounts and loads changed pool revisions", async () => {
  let revision = "r1";
  const known: (string | null)[] = [];
  const reader = createSnapshotReader(async (_trip, prior) => {
    known.push(prior);
    return {
      revision,
      pool:
        prior === revision
          ? null
          : {
              updated_at: revision,
              candidates: [candidate(revision)],
              draft: null,
              published: null,
            },
      votes: [],
    };
  });
  await reader("one", "trip");
  await reader("two", "trip");
  revision = "r2";
  assert.equal((await reader("one", "trip"))?.pool.candidates[0].id, "r2");
  assert.deepEqual(known, [null, null, "r1"]);
});
test("vote saves avoid pool writes and serialize toggle actions independently for each member", async () => {
  const members: Record<string, Record<string, Vote>> = {};
  const content = pool();
  content.draft = makeReviewDraft(content, 1, []);
  const before = structuredClone(content);
  let poolWrites = 0,
    voteWrites = 0;
  const store = createPoolStore({
    read: async (userId) => ({
      revision: "r1",
      otherVotes: {},
      pool: { ...structuredClone(content), votes: { ...members[userId] } },
    }),
    initialize: async () => {
      throw Error("Must not initialize");
    },
    save: async () => {
      poolWrites++;
    },
    saveVote: async (userId, _tripId, id, value) => {
      voteWrites++;
      members[userId] ??= {};
      if (value) members[userId][id] = value;
      else delete members[userId][id];
    },
  });
  await Promise.all([
    store.vote("one", "trip", "a", "up"),
    store.vote("two", "trip", "a", "down"),
  ]);
  assert.equal(members.one.a, "up");
  assert.equal(members.two.a, "down");
  await Promise.all([
    store.vote("one", "trip", "a", "up"),
    store.vote("one", "trip", "a", "up"),
  ]);
  assert.equal(members.one.a, "up");
  assert.equal(poolWrites, 0);
  assert.equal(voteWrites, 4);
  assert.deepEqual(content, before);
  await assert.rejects(store.vote("one", "trip", "removed", "up"), /removed/);
  assert.equal(voteWrites, 4);
});

test("excluded itinerary activities free review slots for selected candidates", () => {
  const items: ExistingReviewItem[] = Array.from({ length: 4 }, (_, index) => ({
    ...existing[0],
    id: "saved-" + index,
    title: "Existing " + index,
    position: index,
    description: "Day 1 ? " + ["09:00", "11:00", "14:00", "17:00"][index],
  }));
  const state = pool();
  state.candidates = [
    candidate("old", "Existing 0"),
    candidate("new", "New place"),
  ];
  const removed = setCandidateDraftSelection(state, "old", false, items);
  const reviewed = synchronizeReviewDraft(removed, 1, items);
  assert.equal(reviewed.draft?.length, 4);
  assert.equal(
    reviewed.draft?.some((stop) => stop.existingId === "saved-0"),
    false,
  );
  assert.equal(
    reviewed.draft?.some((stop) => stop.id === "new"),
    true,
  );
});
