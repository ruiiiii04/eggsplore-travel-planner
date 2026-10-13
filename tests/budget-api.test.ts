import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

function loadApi(rpcResult: { error: Error | null }) {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const db = {
    rpc: async (name: string, args: Record<string, unknown>) => {
      calls.push({ name, args });
      return rpcResult;
    },
  };
  const source = readFileSync(
    new URL("../src/features/budget/api.ts", import.meta.url),
    "utf8",
  );
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const exports: Record<string, any> = {};
  runInNewContext(compiled, {
    exports,
    require(name: string) {
      if (name === "@/lib/supabase") return { getSupabase: () => db };
      throw new Error(`Unexpected import: ${name}`);
    },
  });
  return { api: exports, calls };
}

const expense = {
  trip_id: "trip-1",
  paid_by: "payer-1",
  created_by: "payer-1",
  title: "Dinner",
  amount: 10,
  category: "food",
  original_amount: 25,
  original_currency: "USD",
  splits: [
    { user_id: "payer-1", amount_owed: 5, settled: true },
    { user_id: "member-2", amount_owed: 5, settled: false },
  ],
};

test("expense creation calls one transactional RPC with all split data", async () => {
  const { api, calls } = loadApi({ error: null });
  await api.addExpense(expense);
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [
    {
      name: "add_trip_expense",
      args: {
        target_trip: expense.trip_id,
        expense_title: expense.title,
        expense_amount: expense.amount,
        expense_category: expense.category,
        target_paid_by: expense.paid_by,
        target_original_amount: expense.original_amount,
        target_original_currency: expense.original_currency,
        split_rows: expense.splits,
      },
    },
  ]);
});

test("expense creation surfaces a failed transaction to the caller", async () => {
  const failure = new Error("Split total does not match expense total");
  const { api } = loadApi({ error: failure });
  await assert.rejects(api.addExpense(expense), failure);
});
