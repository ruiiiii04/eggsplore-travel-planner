import { test } from "node:test";
import assert from "node:assert/strict";
import {
  balanceSummary,
  splitEqually,
  totalSpent,
  validateExpense,
} from "../src/features/budget/model";

test("expense validation requires title and a positive numeric amount", () => {
  assert.equal(validateExpense(" ", "10"), "Enter an expense title.");
  assert.equal(validateExpense("Lunch", ""), "Enter a valid amount.");
  assert.equal(validateExpense("Lunch", "abc"), "Enter a valid amount.");
  assert.equal(
    validateExpense("Lunch", "0"),
    "Amount must be greater than zero.",
  );
  assert.equal(validateExpense("Lunch", "25.50"), null);
});

test("equal split distributes cents so the total always matches", () => {
  const result = splitEqually(10, ["a", "b", "c"]);
  assert.deepEqual(result, { a: 3.34, b: 3.33, c: 3.33 });
  const total = Object.values(result).reduce((sum, v) => sum + v, 0);
  assert.equal(Math.round(total * 100) / 100, 10);
});

test("equal split with no members returns empty", () => {
  assert.deepEqual(splitEqually(50, []), {});
});

test("total spent sums and rounds to two decimals", () => {
  assert.equal(
    totalSpent([{ amount: 10.1 }, { amount: 5.25 }, { amount: 0.05 }]),
    15.4,
  );
});

test("balance summary ignores settled splits and sums the rest per user", () => {
  const summary = balanceSummary([
    { user_id: "a", amount_owed: 10, settled: false },
    { user_id: "a", amount_owed: 5, settled: false },
    { user_id: "b", amount_owed: 20, settled: true },
    { user_id: "c", amount_owed: 7.5, settled: false },
  ]);
  assert.deepEqual(summary, { a: 15, c: 7.5 });
});