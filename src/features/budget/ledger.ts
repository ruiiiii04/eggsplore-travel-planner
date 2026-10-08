import type { Expense, ExpenseSplit } from "./model";

export type SplitRow = {
  user_id: string;
  amount_owed: number;
  settled: boolean;
};

// Turns per-person shares into rows to insert. The payer's own row is
// marked settled because they have already paid their share.
export function toSplitRows(
  shares: Record<string, number>,
  payerId: string,
): SplitRow[] {
  return Object.entries(shares)
    .filter(([, amount]) => amount > 0)
    .map(([user_id, amount_owed]) => ({
      user_id,
      amount_owed,
      settled: user_id === payerId,
    }));
}

// The user's own share of the trip so far (what counts against their budget).
export function mySpent(
  splits: Pick<ExpenseSplit, "user_id" | "amount_owed">[],
  userId: string,
): number {
  const cents = splits
    .filter((s) => s.user_id === userId)
    .reduce((sum, s) => sum + Math.round(s.amount_owed * 100), 0);
  return cents / 100;
}

// Unsettled amounts the user owes, grouped by who paid.
export function debtsOwedBy(
  userId: string,
  expenses: Pick<Expense, "id" | "paid_by">[],
  splits: Pick<
    ExpenseSplit,
    "expense_id" | "user_id" | "amount_owed" | "settled"
  >[],
): Record<string, number> {
  const payerOf = new Map(expenses.map((e) => [e.id, e.paid_by]));
  const cents: Record<string, number> = {};
  for (const split of splits) {
    if (split.user_id !== userId || split.settled) continue;
    const payer = payerOf.get(split.expense_id);
    if (!payer || payer === userId) continue;
    cents[payer] = (cents[payer] ?? 0) + Math.round(split.amount_owed * 100);
  }
  const result: Record<string, number> = {};
  for (const [id, value] of Object.entries(cents)) result[id] = value / 100;
  return result;
}

export function initialsOf(name: string | null): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}