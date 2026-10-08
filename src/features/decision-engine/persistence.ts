import { toggleVote, type Candidate, type Pool, type Vote } from "./model";

export type PoolSnapshot = {
  pool: Pool;
  revision: string;
  otherVotes: Record<string, { up: number; down: number }>;
};

type Dependencies = {
  saveVote?: (
    userId: string,
    tripId: string,
    candidateId: string,
    vote: Vote | null,
  ) => Promise<void>;
  read: (userId: string, tripId: string) => Promise<PoolSnapshot | null>;
  initialize: (
    userId: string,
    tripId: string,
    candidates: Candidate[],
  ) => Promise<void>;
  save: (
    userId: string,
    tripId: string,
    snapshot: PoolSnapshot,
    next: Pool,
  ) => Promise<void>;
};
type LegacyPreferences = Record<string, unknown>;
type LegacyDependencies = {
  read: (userId: string) => Promise<LegacyPreferences>;
  change: (
    userId: string,
    change: (preferences: LegacyPreferences) => LegacyPreferences,
  ) => Promise<LegacyPreferences>;
  cache: {
    getItem: (key: string) => Promise<string | null>;
    setItem: (key: string, value: string) => Promise<unknown>;
  };
};

function validate(value: Pool): Pool {
  if (
    !value ||
    !Array.isArray(value.candidates) ||
    !value.votes ||
    typeof value.votes !== "object" ||
    Array.isArray(value.votes) ||
    (value.draft !== null && !Array.isArray(value.draft)) ||
    (value.published !== null && !Array.isArray(value.published))
  ) {
    throw Error(
      "Invalid saved candidate pool. Your data has not been overwritten.",
    );
  }
  return value;
}

export function poolCacheKey(userId: string, tripId: string) {
  return `eggsplore:pool:v2:${userId}:${tripId}`;
}

export function createPoolStore(
  deps: Dependencies,
): ReturnType<typeof createSharedPoolStore>;
export function createPoolStore(
  deps: LegacyDependencies,
): ReturnType<typeof createLegacyPoolStore>;
export function createPoolStore(deps: Dependencies | LegacyDependencies) {
  return "initialize" in deps
    ? createSharedPoolStore(deps)
    : createLegacyPoolStore(deps);
}

function createSharedPoolStore(deps: Dependencies) {
  const queues = new Map<string, Promise<unknown>>();
  function enqueue<T>(key: string, work: () => Promise<T>): Promise<T> {
    const result = (queues.get(key) ?? Promise.resolve())
      .catch(() => undefined)
      .then(work);
    queues.set(key, result);
    void result
      .finally(() => {
        if (queues.get(key) === result) queues.delete(key);
      })
      .catch(() => undefined);
    return result;
  }

  async function readOrInitialize(
    userId: string,
    tripId: string,
    initial: () => Pool,
  ) {
    let snapshot = await deps.read(userId, tripId);
    if (!snapshot) {
      await deps.initialize(userId, tripId, initial().candidates);
      snapshot = await deps.read(userId, tripId);
    }
    if (!snapshot)
      throw Error("Could not load the shared candidate pool. Please retry.");
    snapshot.pool = validate(snapshot.pool);
    return snapshot;
  }

  return {
    load(userId: string, tripId: string, initial: () => Pool): Promise<Pool> {
      if (!userId) return Promise.reject(Error("Sign in to load candidates."));
      return enqueue(
        `${userId}:${tripId}`,
        async () => (await readOrInitialize(userId, tripId, initial)).pool,
      );
    },
    vote(
      userId: string,
      tripId: string,
      candidateId: string,
      value: Vote,
    ): Promise<Pool> {
      if (!userId) return Promise.reject(Error("Sign in to vote."));
      return enqueue(userId + ":" + tripId, async () => {
        const snapshot = await readOrInitialize(userId, tripId, () => ({
          candidates: [],
          votes: {},
          draft: null,
          published: null,
        }));
        if (
          !snapshot.pool.candidates.some(
            (candidate) => candidate.id === candidateId,
          )
        )
          throw Error(
            "This candidate was removed. Reload the pool before voting.",
          );
        const votes = toggleVote(snapshot.pool.votes, candidateId, value);
        if (deps.saveVote)
          await deps.saveVote(
            userId,
            tripId,
            candidateId,
            votes[candidateId] ?? null,
          );
        else
          await deps.save(userId, tripId, snapshot, {
            ...snapshot.pool,
            votes,
          });
        const saved = await deps.read(userId, tripId);
        if (!saved)
          throw Error("Your vote could not be confirmed. Reload the pool.");
        return validate(saved.pool);
      });
    },
    update(
      userId: string,
      tripId: string,
      fn: (pool: Pool) => Pool,
    ): Promise<Pool> {
      if (!userId) return Promise.reject(Error("Sign in to save candidates."));
      return enqueue(`${userId}:${tripId}`, async () => {
        for (let attempt = 0; attempt < 3; attempt++) {
          const snapshot = await readOrInitialize(userId, tripId, () => ({
            candidates: [],
            votes: {},
            draft: null,
            published: null,
          }));
          const next = validate(fn(snapshot.pool));
          try {
            await deps.save(userId, tripId, snapshot, next);
            const saved = await deps.read(userId, tripId);
            if (!saved)
              throw Error("The shared candidate pool could not be reloaded.");
            return validate(saved.pool);
          } catch (error) {
            if (
              !error ||
              typeof error !== "object" ||
              !("message" in error) ||
              !String(error.message).includes("changed on another device") ||
              attempt === 2
            )
              throw error;
          }
        }
        throw Error("The shared candidate pool changed. Please retry.");
      });
    },
  };
}

function createLegacyPoolStore(deps: LegacyDependencies) {
  const namespace = "candidatePoolsV1";
  const readPools = (preferences: LegacyPreferences): Record<string, Pool> => {
    const value = preferences[namespace];
    if (value === undefined) return {};
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw Error(
        "Invalid saved candidate pools. Your data has not been overwritten.",
      );
    return value as Record<string, Pool>;
  };
  const writeLegacy = async (userId: string, tripId: string, pool: Pool) => {
    try {
      await deps.cache.setItem(
        poolCacheKey(userId, tripId),
        JSON.stringify(pool),
      );
    } catch {}
  };
  const change = async (
    userId: string,
    fn: (preferences: LegacyPreferences) => LegacyPreferences,
  ) => {
    for (let attempt = 0; ; attempt++) {
      try {
        return await deps.change(userId, fn);
      } catch (error) {
        if (
          attempt >= 2 ||
          !(error instanceof Error) ||
          !error.message.includes("profile changed on another device")
        )
          throw error;
      }
    }
  };
  const queues = new Map<string, Promise<unknown>>();
  const enqueue = <T>(key: string, work: () => Promise<T>): Promise<T> => {
    const result = (queues.get(key) ?? Promise.resolve())
      .catch(() => undefined)
      .then(work);
    queues.set(key, result);
    void result
      .finally(() => {
        if (queues.get(key) === result) queues.delete(key);
      })
      .catch(() => undefined);
    return result;
  };
  return {
    load(userId: string, tripId: string, initial: () => Pool): Promise<Pool> {
      if (!userId) return Promise.reject(Error("Sign in to load candidates."));
      return enqueue(`${userId}:${tripId}`, async () => {
        const current = readPools(await deps.read(userId))[tripId];
        if (current) return validate(current);
        const raw = await deps.cache.getItem(poolCacheKey(userId, tripId));
        const local = raw ? validate(JSON.parse(raw)) : initial();
        const saved = await change(userId, (preferences) => ({
          ...preferences,
          [namespace]: {
            ...readPools(preferences),
            [tripId]: readPools(preferences)[tripId] ?? local,
          },
        }));
        const pool = validate(readPools(saved)[tripId]);
        await writeLegacy(userId, tripId, pool);
        return pool;
      });
    },
    update(
      userId: string,
      tripId: string,
      fn: (pool: Pool) => Pool,
    ): Promise<Pool> {
      if (!userId) return Promise.reject(Error("Sign in to save candidates."));
      return enqueue(`${userId}:${tripId}`, async () => {
        const saved = await change(userId, (preferences) => {
          const all = readPools(preferences);
          if (!all[tripId]) throw Error("Candidate pool is not initialized.");
          return {
            ...preferences,
            [namespace]: {
              ...all,
              [tripId]: validate(fn(validate(all[tripId]))),
            },
          };
        });
        const pool = validate(readPools(saved)[tripId]);
        await writeLegacy(userId, tripId, pool);
        return pool;
      });
    },
  };
}

export function poolCandidateBase(
  candidate: Candidate,
  otherVotes?: { up: number; down: number },
) {
  const {
    weightedOtherScore: _score,
    ownVoteWeight: _weight,
    ...base
  } = candidate;
  return {
    ...base,
    up: Math.max(0, candidate.up - (otherVotes?.up ?? 0)),
    down: Math.max(0, candidate.down - (otherVotes?.down ?? 0)),
  };
}

export type SharedVote = Vote;
