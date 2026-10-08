import { makeDraft, type Pool, type Stop } from "./model";

export function makeReviewDraft(
  pool: Pool,
  days: number,
  existingItems: {
    id: string;
    title: string;
    description: string | null;
    activity_category: string | null;
    location_name: string | null;
    start_time: string | null;
    position: number;
  }[],
  startDate?: string | null,
): Stop[] {
  const existing: Stop[] = existingItems.map((item) => {
    const legacy = item.description?.match(
      /Day\s*(\d+)\s*[·|•-]?\s*(\d{1,2}:\d{2})?/i,
    );
    const dayFromDate =
      startDate && item.start_time
        ? Math.floor(
            (Date.parse(item.start_time) -
              Date.parse(`${startDate}T00:00:00Z`)) /
              86400000,
          ) + 1
        : undefined;
    return {
      id: item.id,
      existingId: item.id,
      title: item.title,
      location: item.location_name || "",
      description: item.description,
      activityCategory: item.activity_category,
      existingSnapshot: existingItemSnapshot(item),
      day: Math.max(1, Math.min(days, dayFromDate || Number(legacy?.[1]) || 1)),
      time: item.start_time?.slice(11, 16) || legacy?.[2] || "09:00",
    };
  });
  const existingNames = new Set(
    existing.map((stop) => normalizePlace(stop.title)),
  );
  const additions = makeDraft(pool, days).filter(
    (stop) => !existingNames.has(normalizePlace(stop.title)),
  );
  const combined = existing.filter(
    (stop) =>
      pool.draftExcludedExisting?.[stop.existingId!] !== stop.existingSnapshot,
  );
  for (const addition of additions) {
    let day = addition.day;
    while (
      day <= days &&
      combined.filter((stop) => stop.day === day).length >= 4
    )
      day++;
    if (day > days) continue;
    const used = new Set(
      combined.filter((stop) => stop.day === day).map((stop) => stop.time),
    );
    const time =
      ["09:00", "11:00", "14:00", "17:00"].find((value) => !used.has(value)) ||
      "19:00";
    combined.push({ ...addition, day, time });
  }
  return combined.sort((a, b) => a.day - b.day || a.time.localeCompare(b.time));
}

export function synchronizeReviewDraft(
  pool: Pool,
  days: number,
  existingItems: {
    id: string;
    title: string;
    description: string | null;
    activity_category: string | null;
    location_name: string | null;
    start_time: string | null;
    position: number;
  }[],
  startDate?: string | null,
): Pool {
  const rebuilt = makeReviewDraft(pool, days, existingItems, startDate);
  const previousByExistingId = new Map(
    (pool.draft ?? [])
      .filter((stop) => stop.existingId)
      .map((stop) => [stop.existingId!, stop]),
  );
  const exclusions = { ...(pool.draftExcludedExisting ?? {}) };
  const currentById = new Map(existingItems.map((item) => [item.id, item]));
  const stops: Stop[] = [];
  for (const freshStop of rebuilt.filter((stop) => stop.existingId)) {
    const id = freshStop.existingId!;
    const item = currentById.get(id)!;
    const fingerprint = existingItemSnapshot(item);
    if (exclusions[id] === fingerprint) continue;
    if (exclusions[id]) delete exclusions[id];
    const previous = previousByExistingId.get(id);
    stops.push(
      previous?.existingSnapshot === fingerprint
        ? { ...freshStop, ...previous }
        : freshStop,
    );
  }
  const selectedIds = new Set(
    pool.candidates
      .filter((candidate) => candidate.confirmed)
      .map((candidate) => candidate.id),
  );
  for (const previous of pool.draft ?? []) {
    if (previous.existingId) continue;
    if (!previous.id.startsWith("manual-") && !selectedIds.has(previous.id))
      continue;
    stops.push(previous);
  }
  for (const freshStop of rebuilt.filter((stop) => !stop.existingId)) {
    if (!stops.some((stop) => stop.id === freshStop.id)) {
      const used = new Set(
        stops
          .filter((stop) => stop.day === freshStop.day)
          .map((stop) => stop.time),
      );
      const time = used.has(freshStop.time)
        ? ["09:00", "11:00", "14:00", "17:00", "19:00"].find(
            (value) => !used.has(value),
          )
        : freshStop.time;
      if (time) stops.push({ ...freshStop, time });
    }
  }
  stops.sort((a, b) => a.day - b.day || a.time.localeCompare(b.time));
  return { ...pool, draft: stops, draftExcludedExisting: exclusions };
}

export function existingItemSnapshot(item: {
  id: string;
  title: string;
  description: string | null;
  activity_category: string | null;
  location_name: string | null;
  start_time: string | null;
  position: number;
}) {
  return JSON.stringify([
    item.title,
    item.description,
    item.activity_category,
    item.location_name,
    item.start_time,
    item.position,
  ]);
}

export function normalizePlace(value: string) {
  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}
export type ExistingReviewItem = {
  id: string;
  title: string;
  description: string | null;
  activity_category: string | null;
  location_name: string | null;
  start_time: string | null;
  position: number;
};
export function setCandidateDraftSelection(
  pool: Pool,
  id: string,
  selected: boolean,
  existingItems: ExistingReviewItem[],
): Pool {
  const candidate = pool.candidates.find((entry) => entry.id === id);
  if (!candidate) return pool;
  const matching = existingItems.filter(
    (item) => normalizePlace(item.title) === normalizePlace(candidate.name),
  );
  const matchingIds = new Set(matching.map((item) => item.id));
  const exclusions = { ...(pool.draftExcludedExisting ?? {}) };
  for (const item of matching) {
    if (selected) delete exclusions[item.id];
    else exclusions[item.id] = existingItemSnapshot(item);
  }
  return {
    ...pool,
    candidates: pool.candidates.map((entry) =>
      entry.id === id ? { ...entry, confirmed: selected } : entry,
    ),
    draftExcludedExisting: exclusions,
    draft:
      pool.draft === null
        ? null
        : pool.draft.filter(
            (stop) =>
              selected ||
              (stop.id !== id && !matchingIds.has(stop.existingId ?? "")),
          ),
  };
}
export function removeReviewStop(
  pool: Pool,
  stop: Stop,
  existingItems: ExistingReviewItem[],
): Pool {
  let next = pool;
  const existing = existingItems.find((item) => item.id === stop.existingId);
  for (const candidate of pool.candidates) {
    if (
      candidate.id === stop.id ||
      (existing &&
        normalizePlace(candidate.name) === normalizePlace(existing.title))
    ) {
      next = setCandidateDraftSelection(
        next,
        candidate.id,
        false,
        existingItems,
      );
    }
  }
  const exclusions = { ...(next.draftExcludedExisting ?? {}) };
  if (existing) exclusions[existing.id] = existingItemSnapshot(existing);
  return {
    ...next,
    draftExcludedExisting: exclusions,
    draft: next.draft?.filter((entry) => entry.id !== stop.id) ?? [],
  };
}
