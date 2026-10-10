import type { ExpenseCategory } from "./model";

export type CostRange = { low: number; high: number };
export type CostProfile = Record<ExpenseCategory, CostRange>;

// Rough per-person, per-day costs in RM, excluding flights. These are
// placeholder numbers for the demo: tune them freely.
export const DEFAULT_PROFILE: CostProfile = {
  food: { low: 25, high: 60 },
  transport: { low: 10, high: 30 },
  stay: { low: 40, high: 120 },
  activities: { low: 15, high: 60 },
  shopping: { low: 0, high: 60 },
  other: { low: 10, high: 25 },
};

const JAPAN_PROFILE: CostProfile = {
  food: { low: 60, high: 120 },
  transport: { low: 20, high: 50 },
  stay: { low: 60, high: 150 },
  activities: { low: 20, high: 80 },
  shopping: { low: 0, high: 80 },
  other: { low: 10, high: 30 },
};

const BALI_PROFILE: CostProfile = {
  food: { low: 30, high: 70 },
  transport: { low: 10, high: 30 },
  stay: { low: 60, high: 200 },
  activities: { low: 20, high: 90 },
  shopping: { low: 0, high: 60 },
  other: { low: 10, high: 25 },
};

const SEOUL_PROFILE: CostProfile = {
  food: { low: 50, high: 110 },
  transport: { low: 15, high: 35 },
  stay: { low: 80, high: 220 },
  activities: { low: 20, high: 80 },
  shopping: { low: 0, high: 100 },
  other: { low: 10, high: 30 },
};

const BANGKOK_PROFILE: CostProfile = {
  food: { low: 30, high: 80 },
  transport: { low: 10, high: 30 },
  stay: { low: 60, high: 180 },
  activities: { low: 20, high: 80 },
  shopping: { low: 0, high: 80 },
  other: { low: 10, high: 25 },
};

// Add a destination by adding another entry with its keywords.
const PROFILES: { keywords: string[]; profile: CostProfile }[] = [
  {
    keywords: ["japan", "tokyo", "osaka", "kyoto", "hokkaido"],
    profile: JAPAN_PROFILE,
  },
  { keywords: ["bali", "ubud", "seminyak"], profile: BALI_PROFILE },
  { keywords: ["seoul", "south korea"], profile: SEOUL_PROFILE },
  { keywords: ["bangkok"], profile: BANGKOK_PROFILE },
];

const CATEGORIES: ExpenseCategory[] = [
  "food",
  "transport",
  "stay",
  "activities",
  "shopping",
  "other",
];

// Sanity cap per category per day. Anything above it is treated as a bad answer.
const MAX_DAILY = 2000;

export function destinationKey(destination: string | null): string {
  return (destination ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

// Null means "not in the table": the app may ask the AI function instead.
export function knownProfile(destination: string | null): CostProfile | null {
  const text = destinationKey(destination);
  const match = PROFILES.find((p) => p.keywords.some((k) => text.includes(k)));
  return match ? match.profile : null;
}

export function profileFor(destination: string | null): CostProfile {
  return knownProfile(destination) ?? DEFAULT_PROFILE;
}

export function categoryHint(
  destination: string | null,
  category: ExpenseCategory,
): CostRange {
  return profileFor(destination)[category];
}

// AI output is not trusted: every number is checked before it is used.
export function parseProfile(value: unknown): CostProfile | null {
  if (!value || typeof value !== "object") return null;
  const result = {} as CostProfile;
  for (const key of CATEGORIES) {
    const range = (value as Record<string, unknown>)[key];
    if (!range || typeof range !== "object") return null;
    const { low, high } = range as Record<string, unknown>;
    if (typeof low !== "number" || typeof high !== "number") return null;
    if (!Number.isFinite(low) || !Number.isFinite(high)) return null;
    const lo = Math.round(low);
    const hi = Math.round(high);
    if (lo < 0 || hi < lo || hi > MAX_DAILY) return null;
    result[key] = { low: lo, high: hi };
  }
  return result;
}

// Inclusive of both the start and end day.
export function tripDays(
  start: string | null,
  end: string | null,
): number | null {
  if (!start || !end) return null;
  const s = new Date(`${start}T12:00:00Z`).getTime();
  const e = new Date(`${end}T12:00:00Z`).getTime();
  if (Number.isNaN(s) || Number.isNaN(e) || e < s) return null;
  return Math.round((e - s) / 86400000) + 1;
}

export function dailyCost(profile: CostProfile): CostRange {
  return Object.values(profile).reduce<CostRange>(
    (sum, range) => ({
      low: sum.low + range.low,
      high: sum.high + range.high,
    }),
    { low: 0, high: 0 },
  );
}

export function estimateFromProfile(
  profile: CostProfile,
  start: string | null,
  end: string | null,
): ({ days: number } & CostRange) | null {
  const days = tripDays(start, end);
  if (days === null) return null;
  const perDay = dailyCost(profile);
  return { days, low: perDay.low * days, high: perDay.high * days };
}

export function estimateTripCost(
  destination: string | null,
  start: string | null,
  end: string | null,
): ({ days: number } & CostRange) | null {
  return estimateFromProfile(profileFor(destination), start, end);
}

export type BudgetFit = "tight" | "within" | "comfortable";

export function compareBudget(budget: number, estimate: CostRange): BudgetFit {
  if (budget < estimate.low) return "tight";
  if (budget > estimate.high) return "comfortable";
  return "within";
}

export function formatRange(range: CostRange, currency = "RM"): string {
  return `${currency} ${range.low.toLocaleString()}-${range.high.toLocaleString()}`;
}