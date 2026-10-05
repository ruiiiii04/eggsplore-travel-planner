import type { Candidate, Stop, Vote } from "./model";
import {
  memberCategoryWeights,
  preferenceVoteWeight,
} from "../../../supabase/functions/_shared/preference-weights";
import type { PoolSnapshot } from "./persistence";
type PoolRow = {
  updated_at: string;
  candidates: Candidate[];
  draft: Stop[] | null;
  draft_excluded_existing?: Record<string, string>;
  published: Stop[] | null;
};
type Snapshot = {
  revision: string;
  pool: PoolRow | null;
  votes: { candidate_id: string; user_id: string; vote: Vote }[];
  members?: { user_id: string; profiles: unknown }[];
};
// Cache stored base counts, never totals containing other members votes.
export function createSnapshotReader(
  fetch: (
    tripId: string,
    knownRevision: string | null,
  ) => Promise<Snapshot | null>,
) {
  const rows = new Map<string, PoolRow>();
  return async (
    userId: string,
    tripId: string,
  ): Promise<PoolSnapshot | null> => {
    const key = userId + ":" + tripId;
    const cached = rows.get(key);
    const snapshot = await fetch(tripId, cached?.updated_at ?? null);
    if (!snapshot) {
      rows.delete(key);
      return null;
    }
    const row = snapshot.pool ?? cached;
    if (!row || row.updated_at !== snapshot.revision)
      throw Error(
        "The shared candidate snapshot is incomplete. Please reload.",
      );
    rows.set(key, row);
    const weights = new Map(
      (snapshot.members ?? []).map((member) => [
        member.user_id,
        memberCategoryWeights(member.profiles),
      ]),
    );
    const weightedScores: Record<string, number> = {};
    const candidatesById = new Map(row.candidates.map((c) => [c.id, c]));
    const ownVotes: Record<string, Vote> = {};
    const otherVotes: PoolSnapshot["otherVotes"] = {};
    for (const entry of snapshot.votes ?? []) {
      if (entry.user_id === userId) ownVotes[entry.candidate_id] = entry.vote;
      else {
        const counts = (otherVotes[entry.candidate_id] ??= { up: 0, down: 0 });
        counts[entry.vote]++;
        const candidate = candidatesById.get(entry.candidate_id);
        if (candidate)
          weightedScores[candidate.id] =
            (weightedScores[candidate.id] ?? 0) +
            (entry.vote === "up" ? 1 : -1) *
              preferenceVoteWeight(
                candidate.tags,
                weights.get(entry.user_id) ?? {},
              );
      }
    }
    return {
      revision: row.updated_at,
      otherVotes,
      pool: {
        revision: row.updated_at,
        candidates: row.candidates.map((candidate) => ({
          ...candidate,
          weightedOtherScore:
            Number(candidate.up || 0) -
            Number(candidate.down || 0) +
            (weightedScores[candidate.id] ?? 0),
          ownVoteWeight: preferenceVoteWeight(
            candidate.tags,
            weights.get(userId) ?? {},
          ),
          up: Number(candidate.up || 0) + (otherVotes[candidate.id]?.up ?? 0),
          down:
            Number(candidate.down || 0) + (otherVotes[candidate.id]?.down ?? 0),
        })),
        votes: ownVotes,
        draft: row.draft,
        draftExcludedExisting: row.draft_excluded_existing ?? {},
        published: row.published,
      },
    };
  };
}
