import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Plus, Pencil } from "lucide-react-native";
import { Screen, Heading, Button, Card, Message } from "@/components/ui";
import { useAuth } from "@/features/auth/useAuth";
import { useTrips } from "@/features/trips/useTrips";
import { TripTabs } from "@/features/trips/TripTabs";
import { errorMessage } from "@/lib/errors";
import { BudgetSummaryCard } from "./components/BudgetSummaryCard";
import { SettlementRow } from "./components/SettlementRow";
import { ExpenseListItem } from "./components/ExpenseListItem";
import { SelectField, type SelectOption } from "./components/SelectField";
import { TripForecastCard } from "./components/TripForecastCard";
import { saveBudget, setSplitSettled } from "./api";
import { debtsOwedBy, mySpent } from "./ledger";
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

export default function BudgetTestScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { user } = useAuth();
  const { trips, loading: tripsLoading } = useTrips();
  // Use the trip from the link if there is one, otherwise the latest trip.
  const tripId = id ?? trips[0]?.id;
  const { data, loading, error, refresh } = useBudget(tripId);

  const [budgetInput, setBudgetInput] = useState("");
  const [budgetError, setBudgetError] = useState<string | null>(null);
  const [setupOpen, setSetupOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState("");
  const [defaultSplit, setDefaultSplit] = useState<SelectOption>(
    SPLIT_OPTIONS[0],
  );

  const budget = data?.budget?.budget_amount ?? null;
  const spent = data && user ? mySpent(data.splits, user.id) : 0;
  const debts = data && user ? debtsOwedBy(user.id, data.expenses, data.splits) : {};
  const [topDebtorId, topDebtAmount] =
    Object.entries(debts).sort((a, b) => b[1] - a[1])[0] ?? [null, 0];

  function nameOf(userId: string | null): string {
    if (!userId) return "Someone";
    if (userId === user?.id) return "You";
    return (
      data?.members.find((m) => m.user_id === userId)?.display_name ?? "Member"
    );
  }

  function openCategory(category: ExpenseCategory) {
    if (!tripId) return;
    router.push({
      pathname: "/add-expense",
      params: { tripId, category, splitType: defaultSplit.id },
    });
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
    if (!tripId || !user) return;
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

  async function settleUp() {
    if (!data || !user || !topDebtorId) return;
    const payerOf = new Map(data.expenses.map((e) => [e.id, e.paid_by]));
    const ids = data.splits
      .filter(
        (s) =>
          s.user_id === user.id &&
          !s.settled &&
          payerOf.get(s.expense_id) === topDebtorId,
      )
      .map((s) => s.id);
    setActionError("");
    try {
      await Promise.all(ids.map((splitId) => setSplitSettled(splitId, true)));
      refresh();
    } catch (cause) {
      setActionError(errorMessage(cause));
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <Screen>
        <Heading>{data?.trip.title ?? "Budget"}</Heading>
        <TripTabs active="budget" />

        {!tripId && !tripsLoading && (
          <Card>
            <Text className="text-sm font-semibold text-ink">No trip yet</Text>
            <Text className="text-xs text-muted">
              Create a trip first, then come back to track its budget.
            </Text>
            <Button onPress={() => router.push("/trips/create")}>
              Create Trip
            </Button>
          </Card>
        )}

        {loading && !data && <Message>Loading budget...</Message>}
        <Message error>{error}</Message>
        {!!error && <Button variant="secondary" onPress={refresh}>Retry</Button>}

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
                  <Button
                    onPress={() => {
                      setBudgetInput("");
                      setBudgetError(null);
                      setSetupOpen(true);
                    }}
                  >
                    Set Budget
                  </Button>
                </Card>
              ) : (
                <>
                  <View className="flex-row justify-end">
                    <Pressable
                      onPress={() => {
                        setBudgetInput(String(budget));
                        setBudgetError(null);
                        setSetupOpen(true);
                      }}
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
              <SettlementRow
                owesName={topDebtorId ? nameOf(topDebtorId) : null}
                amount={topDebtAmount}
                currency="RM"
              />
              {topDebtorId && (
                <Button variant="secondary" onPress={settleUp}>
                  Mark as paid to {nameOf(topDebtorId)}
                </Button>
              )}
              <Message error>{actionError}</Message>
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
                <SelectField
                  label="Default Split Type"
                  value={defaultSplit}
                  options={SPLIT_OPTIONS}
                  onChange={setDefaultSplit}
                />
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
              {data.expenses.length === 0 && (
                <Message>No expenses yet. Tap Add Expense to log one.</Message>
              )}
              {data.expenses.map((expense) => (
                <ExpenseListItem
                  key={expense.id}
                  expense={expense}
                  paidByName={nameOf(expense.paid_by)}
                />
              ))}
            </View>
          </>
        )}
      </Screen>

      {data && tripId && (
        <Pressable
          onPress={() =>
            router.push({ pathname: "/add-expense", params: { tripId } })
          }
          accessibilityLabel="Add Expense"
          style={{ position: "absolute", bottom: 24, right: 20 }}
          className="flex-row items-center gap-2 rounded-full bg-brand px-5 py-3.5"
        >
          <Plus size={20} color="white" />
          <Text className="text-white font-semibold text-sm">Add Expense</Text>
        </Pressable>
      )}

      {setupOpen && (
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.3)",
            justifyContent: "flex-end",
          }}
        >
          <View className="bg-white rounded-t-2xl p-5 gap-3">
            <Text className="text-lg font-bold text-ink">
              Set Your Trip Budget
            </Text>
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
            <Button variant="ghost" onPress={() => setSetupOpen(false)}>
              Cancel
            </Button>
          </View>
        </View>
      )}
    </View>
  );
}