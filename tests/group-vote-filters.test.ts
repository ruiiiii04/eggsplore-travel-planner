import { test } from "node:test";
import assert from "node:assert/strict";
import {
  candidateFilterCounts,
  candidateMatchesFilter,
  totals,
  type Pool,
  type Candidate,
} from "../src/features/decision-engine/model";
const candidate = (
  id: string,
  up = 0,
  down = 0,
  confirmed = false,
): Candidate => ({
  id,
  name: id,
  location: "Seoul",
  tags: [],
  cover: "generic",
  up,
  down,
  confirmed,
});
test("leader and members have identical group filters while personal votes differ", () => {
  const leader: Pool = {
    candidates: [
      candidate("a", 0, 1),
      candidate("b", 0, 1, true),
      candidate("c"),
    ],
    votes: { a: "up" },
    draft: null,
    published: null,
  };
  const member: Pool = {
    ...leader,
    candidates: [
      candidate("a", 1, 0),
      candidate("b", 0, 1, true),
      candidate("c"),
    ],
    votes: { a: "down" },
  };
  const observer: Pool = {
    ...leader,
    candidates: [
      candidate("a", 1, 1),
      candidate("b", 0, 1, true),
      candidate("c"),
    ],
    votes: {},
  };
  for (const pool of [leader, member, observer]) {
    assert.deepEqual(candidateFilterCounts(pool), {
      All: 3,
      Unvoted: 1,
      Voted: 2,
      "In Draft": 1,
    });
    assert.deepEqual(
      pool.candidates
        .filter((c) => candidateMatchesFilter(pool, c, "Voted"))
        .map((c) => c.id),
      ["a", "b"],
    );
    assert.equal(totals(pool.candidates[0], pool.votes.a).total, 2);
  }
  assert.equal(leader.votes.a, "up");
  assert.equal(member.votes.a, "down");
  assert.equal(observer.votes.a, undefined);
});
test("unvoted group places stay in draft, and removing the final vote changes all group views", () => {
  const pool: Pool = {
    candidates: [candidate("a", 0, 0, true)],
    votes: {},
    draft: null,
    published: null,
  };
  assert.deepEqual(candidateFilterCounts(pool), {
    All: 1,
    Unvoted: 1,
    Voted: 0,
    "In Draft": 1,
  });
  assert(candidateMatchesFilter(pool, pool.candidates[0], "In Draft"));
  pool.votes.a = "down";
  assert.equal(candidateFilterCounts(pool).Voted, 1);
  delete pool.votes.a;
  assert.equal(candidateFilterCounts(pool).Unvoted, 1);
});
