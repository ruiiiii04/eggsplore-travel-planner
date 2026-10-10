import { test } from "node:test";
import assert from "node:assert/strict";
import { relatedExpenses } from "../src/features/budget/ledger";

const expenses = [
  { id: "e1", paid_by: "me", created_by: "me" },
  { id: "e2", paid_by: "alex", created_by: "alex" },
  { id: "e3", paid_by: "alex", created_by: "alex" },
  { id: "e4", paid_by: "alex", created_by: "me" },
  { id: "e5", paid_by: null, created_by: null },
];
const share = (expense_id: string, user_id: string, amount_owed: number) => ({
  expense_id,
  user_id,
  amount_owed,
});

test("only expenses involving the user are listed, with their own share", () => {
  const result = relatedExpenses("me", expenses, [
    share("e2", "me", 25.1),
    share("e2", "me", 0.2),
    share("e3", "alex", 10),
  ]);
  assert.deepEqual(
    result.map((r) => [r.expense.id, r.myShare]),
    [
      ["e1", null],
      ["e2", 25.3],
      ["e4", null],
    ],
  );
});

test("a user with no involvement sees nothing", () => {
  assert.deepEqual(relatedExpenses("zed", expenses, []), []);
});