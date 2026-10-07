import { useMemo, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Camera, ChevronLeft, Save } from "lucide-react-native";
import { Screen, Button, Card, Message } from "@/components/ui";
import { CategoryPicker } from "./components/CategoryPicker";
import { SplitWithPicker, type Member } from "./components/SplitWithPicker";
import { SelectField, type SelectOption } from "./components/SelectField";
import {
  buildSplits,
  convertToRM,
  validateExpense,
  type ExpenseCategory,
  type SplitType,
} from "./model";

const SPLIT_OPTIONS: SelectOption[] = [
  { id: "evenly", label: "Split Evenly" },
  { id: "amount", label: "Exact Amounts" },
  { id: "none", label: "Don't Split" },
];

const CURRENCY_OPTIONS: SelectOption[] = [
  { id: "RM", label: "RM — Ringgit" },
  { id: "USD", label: "USD — US Dollar" },
  { id: "SGD", label: "SGD — Singapore Dollar" },
  { id: "EUR", label: "EUR — Euro" },
  { id: "JPY", label: "JPY — Japanese Yen" },
];

const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  food: "Food",
  transport: "Transport",
  stay: "Stay",
  activities: "Activities",
  shopping: "Shopping",
  other: "Other",
};

const MOCK_MEMBERS: Member[] = [
  { id: "you", name: "You", initials: "YO" },
  { id: "alex", name: "Alex", initials: "AL" },
  { id: "brenna", name: "Brenna", initials: "BR" },
  { id: "kavi", name: "Kavi", initials: "KV" },
];

const MEMBER_OPTIONS: SelectOption[] = MOCK_MEMBERS.map((m) => ({
  id: m.id,
  label: m.id === "you" ? "You" : m.name,
}));

const CURRENT_USER_ID = "you";

export default function AddExpenseScreen() {
  const params = useLocalSearchParams<{
    category?: string;
    splitType?: string;
  }>();

  const [description, setDescription] = useState("");
  const [amountText, setAmountText] = useState("");
  const [currency, setCurrency] = useState<SelectOption>(CURRENCY_OPTIONS[0]);
  const [category, setCategory] = useState<ExpenseCategory | null>(
    (params.category as ExpenseCategory) ?? null,
  );
  const [customCategoryLabel, setCustomCategoryLabel] = useState("");
  const [paidBy, setPaidBy] = useState<SelectOption>(MEMBER_OPTIONS[0]);
  const [splitType, setSplitType] = useState<SelectOption>(
    SPLIT_OPTIONS.find((o) => o.id === params.splitType) ?? SPLIT_OPTIONS[0],
  );
  const [selectedIds, setSelectedIds] = useState<string[]>(
    MOCK_MEMBERS.map((m) => m.id),
  );
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>(
    {},
  );
  const [error, setError] = useState<string | null>(null);

  const now = useMemo(
    () =>
      new Date().toLocaleString("en-MY", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
    [],
  );

  function handleAmountChange(text: string) {
    // Numbers only, single decimal point, max 2 decimal places
    let cleaned = text.replace(/[^0-9.]/g, "");
    const parts = cleaned.split(".");
    if (parts.length > 2) cleaned = parts[0] + "." + parts.slice(1).join("");
    const [intPart, decPart] = cleaned.split(".");
    if (decPart !== undefined && decPart.length > 2) {
      cleaned = `${intPart}.${decPart.slice(0, 2)}`;
    }
    setAmountText(cleaned);
  }

  function toggleMember(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id],
    );
  }

  function clearForm() {
    setDescription("");
    setAmountText("");
    setCategory(null);
    setCustomCategoryLabel("");
    setSplitType(SPLIT_OPTIONS[0]);
    setSelectedIds(MOCK_MEMBERS.map((m) => m.id));
    setCustomAmounts({});
    setError(null);
  }

    function handleSave() {
    const effectiveDescription =
      category === "other" && customCategoryLabel.trim()
        ? customCategoryLabel
        : description;

    const validationError = validateExpense(effectiveDescription, amountText);
    if (validationError) {
      setError(validationError);
      return;
    }
    if (Number(amountText) <= 0) {
      setError("Enter an amount greater than zero.");
      return;
    }

    // Everything downstream (totals, history) is always stored/shown in RM,
    // regardless of what currency the user typed the amount in.
    const amountRM = convertToRM(Number(amountText), currency.id);

    if (splitType.id === "amount") {
      const sum = Object.values(customAmounts).reduce(
        (s, v) => s + (Number(v) || 0),
        0,
      );
      if (Math.round(sum * 100) !== Math.round(amountRM * 100)) {
        setError(
          `Split amounts (RM ${sum.toFixed(2)}) must add up to the total (RM ${amountRM.toFixed(2)}).`,
        );
        return;
      }
    }

    const splits =
      splitType.id === "amount"
        ? Object.fromEntries(
            Object.entries(customAmounts).map(([id, v]) => [id, Number(v) || 0]),
          )
        : buildSplits(
            splitType.id as SplitType,
            amountRM,
            paidBy.id,
            selectedIds,
          );

    // TODO: once Supabase access is available, insert into expenses +
    // expense_splits here instead of logging.
    console.log("Expense to save:", {
      description: effectiveDescription,
      amount: amountRM,
      original_amount: Number(amountText),
      original_currency: currency.id,
      category,
      paid_by: paidBy.id,
      created_by: CURRENT_USER_ID,
      splits,
    });

    router.back();
  }

  return (
    <Screen>
      <View className="flex-row items-center justify-between">
        <Pressable onPress={() => router.back()} accessibilityLabel="Back">
          <ChevronLeft size={24} color="#3D174F" />
        </Pressable>
        <Text className="text-lg font-bold text-brand">Add Expense</Text>
        <Pressable onPress={clearForm}>
          <Text className="text-sm text-brand">Clear</Text>
        </Pressable>
      </View>

      <View className="gap-1">
        <Text className="text-xs text-muted">Total Amount</Text>
      <View className="flex-row items-center justify-center gap-1">
          <SelectField
            label="Currency"
            value={currency}
            options={CURRENCY_OPTIONS}
            onChange={setCurrency}
          />
          <TextInput
            keyboardType="decimal-pad"
            value={amountText}
            onChangeText={handleAmountChange}
            placeholder="0.00"
            placeholderTextColor="#D8C1F0"
            className="text-4xl font-bold text-ink text-center"
            style={{ minWidth: 60, paddingHorizontal: 0 }}
          />
        </View>
      </View>

      <Card>
        <Text className="text-xs font-semibold text-muted">DESCRIPTION</Text>
        <View className="flex-row items-center gap-2">
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="What was this for?"
            placeholderTextColor="#817493"
            className="flex-1 min-h-12 rounded-lg border border-line bg-white px-4 py-3 text-base text-ink"
          />
          <Pressable
            accessibilityLabel="Scan receipt (not available yet)"
            className="w-11 h-11 rounded-full bg-lavender items-center justify-center"
          >
            <Camera size={20} color="#7E49C2" />
          </Pressable>
        </View>

        <Text className="text-xs font-semibold text-muted">DATE & TIME</Text>
        <Text className="text-sm text-ink">{now}</Text>

        <View className="flex-row items-center justify-between">
          <Text className="text-xs font-semibold text-muted">CATEGORY</Text>
          <Text className="text-xs font-semibold text-brand">
            {category ? CATEGORY_LABELS[category] : "None selected"}
          </Text>
        </View>
        <CategoryPicker value={category} onChange={setCategory} />

        {category === "other" && (
          <TextInput
            value={customCategoryLabel}
            onChangeText={setCustomCategoryLabel}
            placeholder="Tell us what this expense is for"
            placeholderTextColor="#817493"
            className="min-h-12 rounded-lg border border-line bg-white px-4 py-3 text-base text-ink"
          />
        )}
      </Card>

      <Card>
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-xs font-semibold text-muted">PAID BY</Text>
            <Text className="text-sm font-semibold text-brand">
              {paidBy.id === CURRENT_USER_ID ? "You" : paidBy.label}
            </Text>
          </View>
          <SelectField
            label="Paid By"
            value={paidBy}
            options={MEMBER_OPTIONS}
            onChange={setPaidBy}
          />
        </View>

        <View className="flex-row items-center justify-between">
          <Text className="text-xs font-semibold text-muted">SPLIT WITH</Text>
          <SelectField
            label="Split Type"
            value={splitType}
            options={SPLIT_OPTIONS}
            onChange={setSplitType}
          />
        </View>

        <SplitWithPicker
          members={MOCK_MEMBERS.filter((m) => m.id !== paidBy.id)}
          splitType={splitType.id as SplitType}
          selectedIds={selectedIds}
          onToggleMember={toggleMember}
          customAmounts={customAmounts}
          onChangeAmount={(id, v) =>
            setCustomAmounts((prev) => ({ ...prev, [id]: v }))
          }
        />
      </Card>

      <Message error>{error}</Message>

      <Button onPress={handleSave}>
        <Save size={18} color="white" />
        <Text className="text-white font-semibold">Save Expense</Text>
      </Button>
    </Screen>
  );
}