import { test } from "node:test";
import assert from "node:assert/strict";
import { debtBreakdown } from "../src/features/budget/ledger";

const expenses = [
  { id: "e1", paid_by: "alex", title: "Ramen" },
  { id: "e2", paid_by: "alex", title: "Taxi" },
  { id: "e3", paid_by: "mei", title: "Hotel" },
  { id: "e4", paid_by: "a", title: "Mine" },
  { id: "e5", paid_by: null, title: "Unknown" },
];
const split = (id: string, expense_id: string, user_id: string, amount_owed: number, settled = false) =>
  ({ id, expense_id, user_id, amount_owed, settled });

test("debts group unsettled shares by payer, largest first", () => {
  const debts = debtBreakdown("a", expenses, [
    split("s1", "e1", "a", 25.1),
    split("s2", "e2", "a", 10.2),
    split("s3", "e3", "a", 50),
    split("s4", "e1", "a", 99, true),
    split("s5", "e4", "a", 5),
    split("s6", "e5", "a", 5),
    split("s7", "e1", "b", 25),
  ]);
  assert.deepEqual(debts.map((d) => [d.payerId, d.total]), [
    ["mei", 50],
    ["alex", 35.3],
  ]);
  assert.deepEqual(debts[1].lines.map((l) => l.splitId), ["s1", "s2"]);
});

test("no debts gives an empty list", () => {
  assert.deepEqual(debtBreakdown("a", expenses, [split("s1", "e4", "a", 5)]), []);
});