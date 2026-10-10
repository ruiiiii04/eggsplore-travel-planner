import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { Pencil, Plus } from "lucide-react-native";
import { BottomSheet, Button, Card, Message } from "@/components/ui";
import { useAuth } from "@/features/auth/useAuth";
import { errorMessage } from "@/lib/errors";
import { BudgetSummaryCard } from "./components/BudgetSummaryCard";
import { SettlementRow } from "./components/SettlementRow";
import { ExpenseListItem } from "./components/ExpenseListItem";
import { SelectField, type SelectOption } from "./components/SelectField";
import { TripForecastCard } from "./components/TripForecastCard";
import { saveBudget, setSplitsSettled } from "./api";
// import { debtBreakdown, mySpent } from "./ledger";
import { debtBreakdown, mySpent, relatedExpenses } from "./ledger";
import { useBudget } from "./useBudget";
import type { ExpenseCategory } from "./model";

const CATEGORY_OPTIONS: { key: ExpenseCategory; label: string; emoji: string }[] = [
  { key: "food", label: "Food", emoji: "☕" },
  { key: "transport", label: "Transport", emoji: "🚗" },
  { key: "stay", label: "Stay", emoji: "🏠" },
  { key: "activities", label: "Activities", emoji: "🖼️" },
  { key: "shopping", label: "Shopping", emoji: "🛍️" },
];

const SPLIT_OPTIONS: SelectOption[] = [
  { id: "evenly", label: "Split Evenly" },
  { id: "amount", label: "Exact Amounts" },
  { id: "none", label: "Don't Split" },
];

// Floating button. Render it OUTSIDE the scroll area so it stays fixed.
export function AddExpenseButton({ tripId }: { tripId: string }) {
  return (
    <Pressable
      onPress={() =>
        router.push({ pathname: "/add-expense", params: { tripId } })
      }
      accessibilityRole="button"
      accessibilityLabel="Add Expense"
      style={{ position: "absolute", bottom: 24, right: 20 }}
      className="flex-row items-center gap-2 rounded-full bg-brand px-5 py-3.5"
    >
      <Plus size={20} color="white" />
      <Text className="text-white font-semibold text-sm">Add Expense</Text>
    </Pressable>
  );
}

export function BudgetContent({ tripId }: { tripId: string }) {
  const { user } = useAuth();
  const { data, loading, error, refresh } = useBudget(tripId);

  const [budgetInput, setBudgetInput] = useState("");
  const [budgetError, setBudgetError] = useState<string | null>(null);
  const [setupOpen, setSetupOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [owesOpen, setOwesOpen] = useState(false);
  const [settlingId, setSettlingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  const [defaultSplit, setDefaultSplit] = useState<SelectOption>(
    SPLIT_OPTIONS[0],
  );

  const budget = data?.budget?.budget_amount ?? null;
  const isSolo = !!data && data.members.length <= 1;
  const spent = data && user ? mySpent(data.splits, user.id) : 0;
  const debtList =
    data && user ? debtBreakdown(user.id, data.expenses, data.splits) : [];
      const related =
    data && user ? relatedExpenses(user.id, data.expenses, data.splits) : [];
  const totalOwed =
    Math.round(debtList.reduce((sum, d) => sum + Math.round(d.total * 100), 0)) /
    100;

  function nameOf(userId: string | null): string {
    if (!userId) return "Someone";
    if (userId === user?.id) return "You";
    return (
      data?.members.find((m) => m.user_id === userId)?.display_name ?? "Member"
    );
  }

  function openCategory(category: ExpenseCategory) {
    router.push({
      pathname: "/add-expense",
      params: { tripId, category, splitType: defaultSplit.id },
    });
  }

  function openSetup() {
    setBudgetInput(budget === null ? "" : String(budget));
    setBudgetError(null);
    setSetupOpen(true);
  }

  async function submitBudget() {
    const trimmed = budgetInput.trim();
    const value = Number(trimmed);
    if (!trimmed || Number.isNaN(value) || !/^\d+(\.\d{1,2})?$/.test(trimmed)) {
      setBudgetError("Enter a valid number (e.g. 2800 or 2800.50).");
      return;
    }
    if (value <= 0) {
      setBudgetError("Budget must be greater than zero.");
      return;
    }
    if (!user) return;
    setSaving(true);
    try {
      await saveBudget(tripId, user.id, value);
      setBudgetError(null);
      setSetupOpen(false);
      refresh();
    } catch (cause) {
      setBudgetError(errorMessage(cause));
    } finally {
      setSaving(false);
    }
  }

  async function settleWith(payerId: string) {
    const debt = debtList.find((d) => d.payerId === payerId);
    if (!debt) return;
    setActionError("");
    setSettlingId(payerId);
    try {
      await setSplitsSettled(debt.lines.map((line) => line.splitId));
      refresh();
      if (debtList.length <= 1) setOwesOpen(false);
    } catch (cause) {
      setActionError(errorMessage(cause));
    } finally {
      setSettlingId(null);
    }
  }

  return (
    <View className="gap-4 px-5 pt-4 pb-24">
      {loading && !data && <Message>Loading budget...</Message>}
      <Message error>{error}</Message>
      {!!error && (
        <Button variant="secondary" onPress={refresh}>
          Retry
        </Button>
      )}

      {data && user && (
        <>
          <View className="rounded-xl bg-lavender p-3 gap-3">
            {budget === null ? (
              <Card>
                <Text className="text-sm font-semibold text-ink">
                  No budget set yet
                </Text>
                <Text className="text-xs text-muted">
                  Set your personal budget for this trip to start tracking.
                </Text>
                <Button onPress={openSetup}>Set Budget</Button>
              </Card>
            ) : (
              <>
                <View className="flex-row justify-end">
                  <Pressable
                    onPress={openSetup}
                    className="flex-row items-center gap-1"
                  >
                    <Pencil size={14} color="#7E49C2" />
                    <Text className="text-xs text-brand font-semibold">
                      Edit Budget
                    </Text>
                  </Pressable>
                </View>
                <BudgetSummaryCard budget={budget} spent={spent} currency="RM" />
              </>
            )}
            {!isSolo && (
              <SettlementRow
                owesName={
                  debtList.length > 1
                    ? `${debtList.length} people`
                    : debtList[0]
                      ? nameOf(debtList[0].payerId)
                      : null
                }
                amount={totalOwed}
                currency="RM"
                onPress={
                  debtList.length > 0
                    ? () => {
                        setActionError("");
                        setOwesOpen(true);
                      }
                    : undefined
                }
              />
            )}
          </View>

          <TripForecastCard
            destination={data.trip.destination}
            startDate={data.trip.start_date}
            endDate={data.trip.end_date}
            budget={budget}
          />

          <Card>
            <View className="flex-row items-center justify-between">
              <Text className="text-base font-semibold text-ink">
                Quick Add by Category
              </Text>
              {!isSolo && (
                <SelectField
                  label="Default Split Type"
                  value={defaultSplit}
                  options={SPLIT_OPTIONS}
                  onChange={setDefaultSplit}
                />
              )}
            </View>
            <View className="flex-row justify-between">
              {CATEGORY_OPTIONS.map((c) => (
                <Pressable
                  key={c.key}
                  onPress={() => openCategory(c.key)}
                  className="items-center gap-1"
                >
                  <View className="w-12 h-12 rounded-full items-center justify-center bg-lavender">
                    <Text className="text-lg">{c.emoji}</Text>
                  </View>
                  <Text className="text-xs text-ink">{c.label}</Text>
                </Pressable>
              ))}
            </View>
          </Card>

          <View className="gap-2">
            <Text className="text-lg font-bold text-ink">Recent Expenses</Text>
            {related.length === 0 && (
              <Message>
                No expenses involving you yet. Tap Add Expense to log one.
              </Message>
            )}
            {related.map(({ expense, myShare }) => (
              <ExpenseListItem
                key={expense.id}
                expense={expense}
                paidByName={nameOf(expense.paid_by)}
                myShare={myShare}
              />
            ))}
          </View>
        </>
      )}

      <BottomSheet
        visible={setupOpen}
        title="Set Your Trip Budget"
        onClose={() => {
          if (!saving) setSetupOpen(false);
        }}
        busy={saving}
      >
        <TextInput
          keyboardType="decimal-pad"
          value={budgetInput}
          onChangeText={setBudgetInput}
          placeholder="e.g. 2800"
          placeholderTextColor="#817493"
          className="min-h-12 rounded-lg border border-line bg-white px-4 py-3 text-base text-ink"
        />
        <Message error={!!budgetError}>
          {budgetError ?? "This is your own personal budget, not shared."}
        </Message>
        <Button busy={saving} onPress={submitBudget}>
          Save Budget
        </Button>
      </BottomSheet>

      <BottomSheet
        visible={owesOpen}
        title="What you owe"
        onClose={() => {
          if (!settlingId) setOwesOpen(false);
        }}
        busy={!!settlingId}
      >
        {debtList.length === 0 && <Message>You're all settled up.</Message>}
        {debtList.map((debt) => (
          <View
            key={debt.payerId}
            className="gap-2 rounded-lg border border-line bg-white p-3"
          >
            <View className="flex-row items-center justify-between">
              <Text className="text-base font-semibold text-ink">
                {nameOf(debt.payerId)}
              </Text>
              <Text className="text-base font-semibold text-brand">
                RM {debt.total.toFixed(2)}
              </Text>
            </View>
            {debt.lines.map((line) => (
              <View key={line.splitId} className="flex-row justify-between gap-3">
                <Text numberOfLines={1} className="flex-1 text-xs text-muted">
                  {line.title}
                </Text>
                <Text className="text-xs text-muted">
                  RM {line.amount.toFixed(2)}
                </Text>
              </View>
            ))}
            <Button
              variant="secondary"
              busy={settlingId === debt.payerId}
              onPress={() => void settleWith(debt.payerId)}
            >
              Mark as paid
            </Button>
          </View>
        ))}
        <Message error>{actionError}</Message>
        <Message>
          Marking as paid tells them you've paid. The money itself is settled
          outside the app.
        </Message>
      </BottomSheet>
    </View>
  );
}