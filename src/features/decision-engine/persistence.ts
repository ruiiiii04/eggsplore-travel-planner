import type { Pool } from "./model";
type Preferences = Record<string, unknown>;
type Dependencies = {
  read: (userId: string) => Promise<Preferences>;
  change: (
    userId: string,
    change: (preferences: Preferences) => Preferences,
  ) => Promise<Preferences>;
  cache: {
    getItem: (key: string) => Promise<string | null>;
    setItem: (key: string, value: string) => Promise<unknown>;
  };
};
const namespace = "candidatePoolsV1";
export const poolCacheKey = (userId: string, tripId: string) =>
  "eggsplore:pool:v2:" + userId + ":" + tripId;
function pools(preferences: Preferences): Record<string, Pool> {
  const value = preferences[namespace];
  if (value === undefined) return {};
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw Error(
      "Invalid saved candidate pools. Your data has not been overwritten.",
    );
  return value as Record<string, Pool>;
}
function validate(value: Pool): Pool {
  if (
    !value ||
    !Array.isArray(value.candidates) ||
    !value.votes ||
    typeof value.votes !== "object" ||
    Array.isArray(value.votes) ||
    (value.draft !== null && !Array.isArray(value.draft)) ||
    (value.published !== null && !Array.isArray(value.published))
  )
    throw Error(
      "Invalid saved candidate pool. Your data has not been overwritten.",
    );
  return value;
}
export function createPoolStore(deps: Dependencies) {
  const queues = new Map<string, Promise<unknown>>();
  function enqueue<T>(userId: string, work: () => Promise<T>): Promise<T> {
    if (!userId) return Promise.reject(Error("Sign in to save candidates."));
    const result = (queues.get(userId) ?? Promise.resolve())
      .catch(() => undefined)
      .then(work);
    queues.set(userId, result);
    void result
      .finally(() => {
        if (queues.get(userId) === result) queues.delete(userId);
      })
      .catch(() => undefined);
    return result;
  }
  async function change(
    userId: string,
    fn: (preferences: Preferences) => Preferences,
  ) {
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
  }
  async function cache(userId: string, tripId: string, pool: Pool) {
    // Supabase is authoritative; a device cache failure must not undo a successful save.
    try {
      await deps.cache.setItem(
        poolCacheKey(userId, tripId),
        JSON.stringify(pool),
      );
    } catch {}
  }
  return {
    load(userId: string, tripId: string, initial: () => Pool): Promise<Pool> {
      return enqueue(userId, async () => {
        const preferences = await deps.read(userId);
        const remote = pools(preferences)[tripId];
        if (remote !== undefined) return validate(remote);
        const raw = await deps.cache.getItem(poolCacheKey(userId, tripId));
        const local = raw ? validate(JSON.parse(raw)) : initial();
        const saved = await change(userId, (current) => ({
          ...current,
          [namespace]: {
            ...pools(current),
            [tripId]: pools(current)[tripId] ?? local,
          },
        }));
        const pool = validate(pools(saved)[tripId]);
        await cache(userId, tripId, pool);
        return pool;
      });
    },
    update(
      userId: string,
      tripId: string,
      fn: (pool: Pool) => Pool,
    ): Promise<Pool> {
      return enqueue(userId, async () => {
        const saved = await change(userId, (current) => {
          const all = pools(current);
          return {
            ...current,
            [namespace]: {
              ...all,
              [tripId]: validate(fn(validate(all[tripId]))),
            },
          };
        });
        const pool = validate(pools(saved)[tripId]);
        await cache(userId, tripId, pool);
        return pool;
      });
    },
  };
}
