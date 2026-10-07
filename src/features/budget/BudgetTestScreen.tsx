import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { Plus, Pencil } from "lucide-react-native";
import { Screen, Heading, Button, Card, Message } from "@/components/ui";
import { BudgetSummaryCard } from "./components/BudgetSummaryCard";
import { SettlementRow } from "./components/SettlementRow";
import { ExpenseListItem } from "./components/ExpenseListItem";
import { SelectField, type SelectOption } from "./components/SelectField";
import type { Expense, ExpenseCategory, SplitType } from "./model";
import { needsBudgetSetup } from "./model";

const mockExpenses: Expense[] = [
  {
    id: "1",
    trip_id: "trip-1",
    paid_by: "user-alex",
    created_by: "user-alex",
    title: "Hotel Deposit",
    amount: 420,
    category: "stay",
    created_at: new Date().toISOString(),
  },
  {
    id: "2",
    trip_id: "trip-1",
    paid_by: "user-you",
    created_by: "user-you",
    title: "Ramen Dinner",
    amount: 85,
    category: "food",
    created_at: new Date().toISOString(),
  },
];

const CATEGORY_OPTIONS: { key: ExpenseCategory; label: string; emoji: string }[] = [
  { key: "food", label: "Food", emoji: "☕" },
  { key: "transport", label: "Transport", emoji: "🚗" },
  { key: "stay", label: "Stay", emoji: "🏠" },
  { key: "activities", label: "Activities", emoji: "🖼️" },
  { key: "shopping", label: "Shopping", emoji: "🛍️" },
  { key: "other", label: "Other", emoji: "⋯" },
];

const SPLIT_OPTIONS: SelectOption[] = [
  { id: "evenly", label: "Split Evenly" },
  { id: "amount", label: "Exact Amounts" },
  { id: "none", label: "Don't Split" },
];

export default function BudgetTestScreen() {
  // Mock: null means "no budget set yet" so the setup prompt can trigger.
  const [budget, setBudget] = useState<number | null>(null);
  const [budgetInput, setBudgetInput] = useState("");
  const [setupOpen, setSetupOpen] = useState(false);
  const [defaultSplit, setDefaultSplit] = useState<SelectOption>(
    SPLIT_OPTIONS[0],
  );

  const spent = 1820;
  const showSetupPrompt = needsBudgetSetup(
    budget !== null,
    mockExpenses.length === 0 ? 0 : 0, // mock: pretend trip has 0 real expenses logged by this user
  );

  function openCategory(category: ExpenseCategory) {
    router.push({
      pathname: "/add-expense",
      params: { category, splitType: defaultSplit.id },
    });
  }

  const [budgetError, setBudgetError] = useState<string | null>(null);

  function saveBudget() {
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
    setBudgetError(null);
    setBudget(value);
    setSetupOpen(false);
  }

  return (
    <View style={{ flex: 1 }}>
      <Screen>
        <Heading>Budget Test Page</Heading>
        <Text className="text-xs text-muted">
          Standalone preview — mock data only, not connected to Supabase yet.
        </Text>

        {/* Budget summary + settlement grouped in one light-purple section */}
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
          <SettlementRow owesName="Alex" amount={50} currency="RM" />
        </View>

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
            {CATEGORY_OPTIONS.filter((c) => c.key !== "other").map((c) => (
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
          {mockExpenses.map((expense) => (
            <ExpenseListItem
              key={expense.id}
              expense={expense}
              paidByName={expense.paid_by === "user-alex" ? "Alex" : "You"}
            />
          ))}
        </View>
      </Screen>

      {/* Floating Add Expense button, bottom-right, fixed over the screen */}
      <Pressable
        onPress={() => router.push("/add-expense")}
        accessibilityLabel="Add Expense"
        style={{ position: "absolute", bottom: 24, right: 20 }}
        className="flex-row items-center gap-2 rounded-full bg-brand px-5 py-3.5"
      >
        <Plus size={20} color="white" />
        <Text className="text-white font-semibold text-sm">Add Expense</Text>
      </Pressable>

      {/* First-time / edit budget setup, shown via BottomSheet pattern inline */}
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
            <Button onPress={saveBudget}>Save Budget</Button>
            <Button variant="ghost" onPress={() => setSetupOpen(false)}>
              Cancel
            </Button>
          </View>
        </View>
      )}
    </View>
  );
}