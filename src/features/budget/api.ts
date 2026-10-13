import { getSupabase } from "@/lib/supabase";
import type { Trip } from "@/features/trips/model";
import type { Expense, ExpenseSplit, TripBudget } from "./model";
import type { SplitRow } from "./ledger";

export type MemberProfile = {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
};

export type BudgetData = {
  trip: Trip;
  budget: TripBudget | null;
  expenses: Expense[];
  splits: ExpenseSplit[];
  members: MemberProfile[];
};

// Postgres numeric can arrive as a string, so normalise to numbers.
function expenseRow(row: Expense): Expense {
  return {
    ...row,
    amount: Number(row.amount),
    original_amount:
      row.original_amount == null ? null : Number(row.original_amount),
  };
}

export async function loadBudgetData(
  tripId: string,
  userId: string,
): Promise<BudgetData> {
  const db = getSupabase();
  const [trip, budget, expenses, members] = await Promise.all([
    db.from("trips").select("*").eq("id", tripId).single(),
    db
      .from("trip_budgets")
      .select("*")
      .eq("trip_id", tripId)
      .eq("user_id", userId)
      .maybeSingle(),
    db
      .from("expenses")
      .select("*")
      .eq("trip_id", tripId)
      .order("created_at", { ascending: false }),
    db.rpc("trip_member_profiles", { target: tripId }),
  ]);
  for (const result of [trip, budget, expenses, members]) {
    if (result.error) throw result.error;
  }

  const expenseList = ((expenses.data ?? []) as Expense[]).map(expenseRow);
  let splits: ExpenseSplit[] = [];
  if (expenseList.length > 0) {
    const { data, error } = await db
      .from("expense_splits")
      .select("*")
      .in(
        "expense_id",
        expenseList.map((e) => e.id),
      );
    if (error) throw error;
    splits = ((data ?? []) as ExpenseSplit[]).map((s) => ({
      ...s,
      amount_owed: Number(s.amount_owed),
    }));
  }

  const budgetRow = budget.data as TripBudget | null;
  return {
    trip: trip.data as Trip,
    budget: budgetRow
      ? { ...budgetRow, budget_amount: Number(budgetRow.budget_amount) }
      : null,
    expenses: expenseList,
    splits,
    members: (members.data ?? []) as MemberProfile[],
  };
}

export async function saveBudget(
  tripId: string,
  userId: string,
  amount: number,
): Promise<void> {
  const { error } = await getSupabase()
    .from("trip_budgets")
    .upsert(
      { trip_id: tripId, user_id: userId, budget_amount: amount, currency: "RM" },
      { onConflict: "trip_id,user_id" },
    );
  if (error) throw error;
}

export type NewExpense = {
  trip_id: string;
  paid_by: string;
  created_by: string;
  title: string;
  amount: number;
  category: string | null;
  original_amount: number;
  original_currency: string;
  splits: SplitRow[];
};

// Save the expense and all shares through one transactional database function.
export async function addExpense(input: NewExpense): Promise<void> {
  const db = getSupabase();
  const { error } = await db.rpc("add_trip_expense", {
    target_trip: input.trip_id,
    expense_title: input.title,
    expense_amount: input.amount,
    expense_category: input.category,
    target_paid_by: input.paid_by,
    target_original_amount: input.original_amount,
    target_original_currency: input.original_currency,
    split_rows: input.splits,
  });
  if (error) throw error;
}

export async function setSplitSettled(
  splitId: string,
  settled: boolean,
): Promise<void> {
  const { error } = await getSupabase()
    .from("expense_splits")
    .update({ settled })
    .eq("id", splitId);
  if (error) throw error;
}

// One update for all the rows, so the payer gets a single notification.
export async function setSplitsSettled(splitIds: string[]): Promise<void> {
  if (splitIds.length === 0) return;
  const { error } = await getSupabase()
    .from("expense_splits")
    .update({ settled: true })
    .in("id", splitIds);
  if (error) throw error;
}
