import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  new URL("../supabase/migrations/028_budget_access_and_estimate_quota.sql", import.meta.url),
  "utf8",
);

test("only the member's own personal budget row is readable", () => {
  assert.match(migration, /create policy trip_budgets_read[\s\S]*?using\s*\(user_id\s*=\s*\(select auth\.uid\(\)\)\s+and public\.is_trip_member\(trip_id\)\)/i);
});

test("split updates are restricted to the debtor's settled flag", () => {
  assert.match(migration, /create policy expense_splits_update[\s\S]*?using\s*\(user_id\s*=\s*\(select auth\.uid\(\)\)\)\s+with check\s*\(user_id\s*=\s*\(select auth\.uid\(\)\)\)/i);
  assert.match(migration, /revoke update on public\.expense_splits from authenticated/i);
  assert.match(migration, /grant update\s*\(settled\) on public\.expense_splits to authenticated/i);
});

test("expense transaction validates membership, payer settlement and share totals", () => {
  assert.match(migration, /create function public\.add_trip_expense[\s\S]*?public\.is_trip_member\(target_trip\)/i);
  assert.match(migration, /s\.settled and s\.user_id <> target_paid_by/i);
  assert.match(migration, /round\(shares_total \* 100\) <> round\(expense_amount \* 100\)/i);
  assert.match(migration, /returns uuid language plpgsql security definer/i);
});

test("estimate quota is isolated, persistent, and limits per minute and day", () => {
  assert.match(migration, /create table public\.cost_estimate_request_usage/i);
  assert.match(migration, /cardinality\(recent\) >= 5 or usage\.day_count >= 30/i);
  assert.match(migration, /grant execute on function public\.consume_cost_estimate_request\(\) to authenticated/i);
});
