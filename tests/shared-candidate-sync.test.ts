import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createPoolStore,
  poolCandidateBase,
  type PoolSnapshot,
} from "../src/features/decision-engine/persistence";
import {
  candidateFilterCounts,
  type Pool,
  type Vote,
} from "../src/features/decision-engine/model";
test("concurrent member saves retain shared candidates, draft and independent votes", async () => {
  let version = 0;
  let state: Pool | null = null;
  const memberVotes: Record<string, Record<string, Vote>> = {};
  const deps = {
    read: async (userId: string): Promise<PoolSnapshot | null> => {
      if (!state) return null;
      const otherVotes: PoolSnapshot["otherVotes"] = {};
      for (const [member, votes] of Object.entries(memberVotes))
        if (member !== userId)
          for (const [id, vote] of Object.entries(votes)) {
            const counts = (otherVotes[id] ??= { up: 0, down: 0 });
            counts[vote]++;
          }
      const pool = structuredClone(state);
      pool.candidates = pool.candidates.map((c) => ({
        ...c,
        up: c.up + (otherVotes[c.id]?.up ?? 0),
        down: c.down + (otherVotes[c.id]?.down ?? 0),
      }));
      pool.votes = { ...memberVotes[userId] };
      return { pool, revision: String(version), otherVotes };
    },
    initialize: async () => {
      state ??= { candidates: [], votes: {}, draft: null, published: null };
    },
    save: async (
      userId: string,
      _trip: string,
      snapshot: PoolSnapshot,
      next: Pool,
    ) => {
      if (snapshot.revision !== String(version))
        throw {
          message: "Candidate pool changed on another device. Please retry.",
        };
      state = {
        ...structuredClone(next),
        candidates: next.candidates.map((c) =>
          poolCandidateBase(c, snapshot.otherVotes[c.id]),
        ),
        votes: {},
      };
      memberVotes[userId] = { ...next.votes };
      version++;
    },
  };
  const store = createPoolStore(deps);
  await store.load("leader", "trip", () => ({
    candidates: [],
    votes: {},
    draft: null,
    published: null,
  }));
  await Promise.all([
    store.update("leader", "trip", (p) => ({
      ...p,
      candidates: [
        ...p.candidates,
        {
          id: "a",
          name: "A",
          location: "Seoul",
          cover: "generic",
          tags: [],
          up: 0,
          down: 0,
        },
      ],
    })),
    store.update("member", "trip", (p) => ({
      ...p,
      candidates: [
        ...p.candidates,
        {
          id: "b",
          name: "B",
          location: "Seoul",
          cover: "generic",
          tags: [],
          up: 0,
          down: 0,
        },
      ],
    })),
  ]);
  await store.update("leader", "trip", (p) => ({
    ...p,
    candidates: p.candidates.map((c) => ({ ...c, confirmed: c.id === "a" })),
    draft: [
      { id: "a", title: "Edited A", location: "Seoul", day: 1, time: "09:00" },
    ],
    votes: { a: "up" },
  }));
  await store.update("member", "trip", (p) => ({ ...p, votes: { a: "down" } }));
  const leader = await store.load("leader", "trip", () => {
    throw Error("must not reinitialize");
  });
  const member = await store.load("member", "trip", () => {
    throw Error("must not reinitialize");
  });
  assert.equal(leader.candidates.length, 2);
  assert.equal(member.candidates.length, 2);
  assert.deepEqual(
    candidateFilterCounts(leader),
    candidateFilterCounts(member),
  );
  assert.equal(leader.votes.a, "up");
  assert.equal(member.votes.a, "down");
  assert.deepEqual(leader.draft, member.draft);
  assert.equal(member.draft?.[0].title, "Edited A");
  assert.equal(member.candidates.find((c) => c.id === "a")?.confirmed, true);
});
