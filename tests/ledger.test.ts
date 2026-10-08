import { test } from "node:test";
import assert from "node:assert/strict";
import {
  debtsOwedBy,
  initialsOf,
  mySpent,
  toSplitRows,
} from "../src/features/budget/ledger";

test("split rows skip zero shares and mark the payer's row settled", () => {
  assert.deepEqual(toSplitRows({ a: 10, b: 0, c: 5 }, "a"), [
    { user_id: "a", amount_owed: 10, settled: true },
    { user_id: "c", amount_owed: 5, settled: false },
  ]);
});

test("my spent counts only my own split rows", () => {
  assert.equal(
    mySpent(
      [
        { user_id: "a", amount_owed: 10 },
        { user_id: "a", amount_owed: 5.5 },
        { user_id: "b", amount_owed: 20 },
      ],
      "a",
    ),
    15.5,
  );
});

test("debts ignore settled rows, my own payments and unpaid-by expenses", () => {
  const expenses = [
    { id: "e1", paid_by: "alex" },
    { id: "e2", paid_by: "a" },
    { id: "e3", paid_by: null },
    { id: "e4", paid_by: "alex" },
    { id: "e5", paid_by: "mei" },
  ];
  const splits = [
    { expense_id: "e1", user_id: "a", amount_owed: 50, settled: false },
    { expense_id: "e1", user_id: "b", amount_owed: 10, settled: false },
    { expense_id: "e2", user_id: "a", amount_owed: 30, settled: true },
    { expense_id: "e3", user_id: "a", amount_owed: 5, settled: false },
    { expense_id: "e4", user_id: "a", amount_owed: 20, settled: true },
    { expense_id: "e5", user_id: "a", amount_owed: 0.1, settled: false },
    { expense_id: "e5", user_id: "a", amount_owed: 0.2, settled: false },
  ];
  assert.deepEqual(debtsOwedBy("a", expenses, splits), {
    alex: 50,
    mei: 0.3,
  });
});

test("initials handle one name, two names and missing names", () => {
  assert.equal(initialsOf("Anson Wong"), "AW");
  assert.equal(initialsOf("alex"), "AL");
  assert.equal(initialsOf(null), "?");
});