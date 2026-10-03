import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createPoolStore,
  poolCacheKey,
} from "../src/features/decision-engine/persistence";
import type { Candidate, Pool } from "../src/features/decision-engine/model";
const empty = (): Pool => ({
  candidates: [],
  votes: {},
  draft: null,
  published: null,
});
const candidate = (id: string): Candidate => ({
  id,
  name: id,
  location: "Tokyo",
  tags: [],
  cover: "japan",
  up: 0,
  down: 0,
  source: "https://maps.google.com/?q=Tokyo",
  image: "data:image/jpeg;base64,cGhvdG8=",
});
function fixture() {
  const profiles = new Map<string, Record<string, unknown>>();
  const local = new Map<string, string>();
  let fail = false,
    cacheFail = false,
    conflicts = 0;
  const deps = {
    read: async (id: string) => structuredClone(profiles.get(id) ?? {}),
    change: async (
      id: string,
      change: (value: Record<string, unknown>) => Record<string, unknown>,
    ) => {
      if (fail) throw Error("Network unavailable");
      if (conflicts > 0) {
        conflicts--;
        throw Error("Your profile changed on another device. Please retry.");
      }
      const next = change(structuredClone(profiles.get(id) ?? {}));
      profiles.set(id, structuredClone(next));
      return next;
    },
    cache: {
      getItem: async (key: string) => local.get(key) ?? null,
      setItem: async (key: string, value: string) => {
        if (cacheFail) throw Error("Quota exceeded");
        local.set(key, value);
      },
    },
  };
  return {
    profiles,
    local,
    store: createPoolStore(deps),
    restart: () => createPoolStore(deps),
    fail: (value: boolean) => {
      fail = value;
    },
    cacheFail: () => {
      cacheFail = true;
    },
    conflict: () => {
      conflicts = 1;
    },
  };
}
test("photo and link candidates survive restart without a device cache", async () => {
  const f = fixture();
  await f.store.load("alice", "trip", empty);
  await f.store.update("alice", "trip", (p) => ({
    ...p,
    candidates: [candidate("a")],
  }));
  f.local.clear();
  const saved = await f.restart().load("alice", "trip", empty);
  assert.deepEqual(saved.candidates, [candidate("a")]);
});
test("candidate saves are isolated by user and trip and preserve profile preferences", async () => {
  const f = fixture();
  f.profiles.set("alice", {
    settings: { units: "metric" },
    profiles: [{ name: "Beach" }],
  });
  await f.store.load("alice", "one", empty);
  await f.store.load("alice", "two", empty);
  await f.store.load("bob", "one", empty);
  await f.store.update("alice", "one", (p) => ({
    ...p,
    candidates: [candidate("a")],
  }));
  assert.equal(
    (await f.store.load("alice", "two", empty)).candidates.length,
    0,
  );
  assert.equal((await f.store.load("bob", "one", empty)).candidates.length, 0);
  assert.deepEqual(f.profiles.get("alice")?.settings, { units: "metric" });
  assert.deepEqual(f.profiles.get("alice")?.profiles, [{ name: "Beach" }]);
});
test("legacy candidates migrate once and deletion cannot be resurrected by stale cache", async () => {
  const f = fixture();
  const legacy = { ...empty(), candidates: [candidate("old")] };
  f.local.set(poolCacheKey("alice", "trip"), JSON.stringify(legacy));
  assert.equal(
    (await f.store.load("alice", "trip", empty)).candidates.length,
    1,
  );
  await f.store.update("alice", "trip", (p) => ({ ...p, candidates: [] }));
  f.local.set(poolCacheKey("alice", "trip"), JSON.stringify(legacy));
  assert.equal(
    (await f.restart().load("alice", "trip", empty)).candidates.length,
    0,
  );
});
test("queued saves survive screen recreation and failed writes can be retried", async () => {
  const f = fixture();
  await f.store.load("alice", "trip", empty);
  const first = f.store.update("alice", "trip", (p) => ({
    ...p,
    candidates: [...p.candidates, candidate("one")],
  }));
  const second = f.store.update("alice", "trip", (p) => ({
    ...p,
    candidates: [...p.candidates, candidate("two")],
  }));
  const reopened = f.store.load("alice", "trip", empty);
  await Promise.all([first, second]);
  assert.equal((await reopened).candidates.length, 2);
  f.fail(true);
  await assert.rejects(
    f.store.update("alice", "trip", (p) => ({ ...p, candidates: [] })),
    /Network/,
  );
  assert.equal(
    (await f.store.load("alice", "trip", empty)).candidates.length,
    2,
  );
  f.fail(false);
  await f.store.update("alice", "trip", (p) => ({ ...p, candidates: [] }));
  assert.equal(
    (await f.restart().load("alice", "trip", empty)).candidates.length,
    0,
  );
});
test("cache quota failure does not lose account data and version conflicts retry", async () => {
  const f = fixture();
  f.cacheFail();
  f.conflict();
  await f.store.load("alice", "trip", empty);
  await f.store.update("alice", "trip", (p) => ({
    ...p,
    candidates: [candidate("a")],
  }));
  assert.equal(
    (await f.restart().load("alice", "trip", empty)).candidates.length,
    1,
  );
});
test("corrupt saved data is reported without replacing it with starter candidates", async () => {
  const f = fixture();
  f.profiles.set("alice", {
    candidatePoolsV1: { trip: { candidates: "invalid" } },
  });
  const before = structuredClone(f.profiles.get("alice"));
  await assert.rejects(
    f.store.load("alice", "trip", empty),
    /not been overwritten/,
  );
  assert.deepEqual(f.profiles.get("alice"), before);
});
