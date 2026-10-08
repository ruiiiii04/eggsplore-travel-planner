import type { ExpenseCategory } from "./model";

export type CostRange = { low: number; high: number };
type CostProfile = Record<ExpenseCategory, CostRange>;

// Rough per-person, per-day costs in RM, excluding flights. These are
// placeholder numbers for the demo: tune them freely.
const DEFAULT_PROFILE: CostProfile = {
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

// Add a destination by adding another entry with its keywords.
const PROFILES: { keywords: string[]; profile: CostProfile }[] = [
  {
    keywords: ["japan", "tokyo", "osaka", "kyoto", "hokkaido"],
    profile: JAPAN_PROFILE,
  },
];

export function profileFor(destination: string | null): CostProfile {
  const text = (destination ?? "").toLowerCase();
  const match = PROFILES.find((p) => p.keywords.some((k) => text.includes(k)));
  return match ? match.profile : DEFAULT_PROFILE;
}

export function categoryHint(
  destination: string | null,
  category: ExpenseCategory,
): CostRange {
  return profileFor(destination)[category];
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

export function estimateTripCost(
  destination: string | null,
  start: string | null,
  end: string | null,
): ({ days: number } & CostRange) | null {
  const days = tripDays(start, end);
  if (days === null) return null;
  const perDay = Object.values(profileFor(destination)).reduce<CostRange>(
    (sum, range) => ({
      low: sum.low + range.low,
      high: sum.high + range.high,
    }),
    { low: 0, high: 0 },
  );
  return { days, low: perDay.low * days, high: perDay.high * days };
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