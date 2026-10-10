import { useMemo, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
// import { Camera, ChevronLeft, Save } from "lucide-react-native";
import { ChevronLeft, Save } from "lucide-react-native";
import { Screen, Button, Card, Message } from "@/components/ui";
import { useAuth } from "@/features/auth/useAuth";
import { errorMessage } from "@/lib/errors";
import { CategoryPicker } from "./components/CategoryPicker";
import { CurrencyField } from "./components/CurrencyField";
import { SplitWithPicker, type Member } from "./components/SplitWithPicker";
import { SelectField, type SelectOption } from "./components/SelectField";
import { addExpense } from "./api";
import {
  DEFAULT_CURRENCY,
  convertShares,
  formatMoney,
  sanitizeAmount,
  toRM,
  type CurrencySelection,
} from "./currencies";
import { formatRange } from "./estimates";
import { initialsOf, toSplitRows } from "./ledger";
import { useBudget } from "./useBudget";
import { useCostProfile } from "./useCostProfile";
import {
  buildSplits,
  validateExpense,
  type ExpenseCategory,
  type SplitType,
} from "./model";

const SPLIT_OPTIONS: SelectOption[] = [
  { id: "evenly", label: "Split Evenly" },
  { id: "amount", label: "Exact Amounts" },
  { id: "none", label: "Don't Split" },
];

const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  food: "Food",
  transport: "Transport",
  stay: "Stay",
  activities: "Activities",
  shopping: "Shopping",
  other: "Other",
};

export default function AddExpenseScreen() {
  const params = useLocalSearchParams<{
    tripId?: string;
    category?: string;
    splitType?: string;
  }>();
  const { user } = useAuth();
  const { data } = useBudget(params.tripId);
  const { profile: costProfile } = useCostProfile(
    data?.trip.destination ?? null,
  );

  const [description, setDescription] = useState("");
  const [amountText, setAmountText] = useState("");
  const [currency, setCurrency] = useState<CurrencySelection>(DEFAULT_CURRENCY);
  const [category, setCategory] = useState<ExpenseCategory | null>(
    (params.category as ExpenseCategory) ?? null,
  );
  const [customCategoryLabel, setCustomCategoryLabel] = useState("");
  const [paidByChoice, setPaidByChoice] = useState<string | null>(null);
  const [splitType, setSplitType] = useState<SelectOption>(
    SPLIT_OPTIONS.find((o) => o.id === params.splitType) ?? SPLIT_OPTIONS[0],
  );
  const [selectedChoice, setSelectedChoice] = useState<string[] | null>(null);
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>(
    {},
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const members: Member[] = (data?.members ?? []).map((m) => ({
    id: m.user_id,
    name: m.user_id === user?.id ? "You" : (m.display_name ?? "Member"),
    initials: initialsOf(m.display_name),
  }));
  const memberOptions: SelectOption[] = members.map((m) => ({
    id: m.id,
    label: m.name,
  }));
  const paidById = paidByChoice ?? user?.id ?? "";
  const paidBy = memberOptions.find((o) => o.id === paidById) ?? null;
  const selectedIds = selectedChoice ?? members.map((m) => m.id);
  const loaded = !!data;
  const isSolo = loaded && members.length <= 1;

  const typedAmount = Number(amountText);
  const total = Number.isFinite(typedAmount) ? typedAmount : 0;
  const previewRM = total > 0 ? toRM(total, currency.rate) : 0;

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

  function changeCurrency(next: CurrencySelection) {
    setCurrency(next);
    setAmountText((current) => sanitizeAmount(current, next.decimals));
    // Shares typed in the old currency would be meaningless in the new one.
    setCustomAmounts({});
    setError(null);
  }

  function toggleMember(memberId: string) {
    setSelectedChoice(
      selectedIds.includes(memberId)
        ? selectedIds.filter((m) => m !== memberId)
        : [...selectedIds, memberId],
    );
  }

  function clearForm() {
    setDescription("");
    setAmountText("");
    setCurrency(DEFAULT_CURRENCY);
    setCategory(null);
    setCustomCategoryLabel("");
    setPaidByChoice(null);
    setSplitType(SPLIT_OPTIONS[0]);
    setSelectedChoice(null);
    setCustomAmounts({});
    setError(null);
  }

  async function handleSave() {
    if (!user || !params.tripId) {
      setError("No trip selected. Go back and open the Budget page again.");
      return;
    }

    const effectiveDescription =
      category === "other" && customCategoryLabel.trim()
        ? customCategoryLabel
        : description;

    const validationError = validateExpense(effectiveDescription, amountText);
    if (validationError) {
      setError(validationError);
      return;
    }
    if (total <= 0) {
      setError("Enter an amount greater than zero.");
      return;
    }

    // Totals and history are always stored in RM, whatever currency was typed.
    const amountRM = toRM(total, currency.rate);
    if (amountRM <= 0) {
      setError("That converts to less than RM 0.01.");
      return;
    }

    const effectiveSplit = isSolo ? "none" : splitType.id;
    let shares: Record<string, number>;
    if (effectiveSplit === "amount") {
      const entered = Object.fromEntries(
        Object.entries(customAmounts).map(([id, v]) => [id, Number(v) || 0]),
      );
      const unit = 10 ** currency.decimals;
      const sumMinor = Object.values(entered).reduce(
        (s, v) => s + Math.round(v * unit),
        0,
      );
      if (sumMinor !== Math.round(total * unit)) {
        setError(
          `Split amounts (${formatMoney(sumMinor / unit, currency.code, currency.decimals)}) must add up to the total (${formatMoney(total, currency.code, currency.decimals)}).`,
        );
        return;
      }
      shares = convertShares(entered, currency.rate, amountRM);
    } else {
      // The payer always shares the cost when splitting evenly.
      const ids = Array.from(new Set([...selectedIds, paidById]));
      shares = buildSplits(effectiveSplit as SplitType, amountRM, paidById, ids);
    }

    setSaving(true);
    setError(null);
    try {
      await addExpense({
        trip_id: params.tripId,
        paid_by: paidById,
        created_by: user.id,
        title: effectiveDescription.trim(),
        amount: amountRM,
        category,
        original_amount: total,
        original_currency: currency.code,
        splits: toSplitRows(shares, paidById),
      });
      router.back();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setSaving(false);
    }
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

      {data?.trip && (
        <View className="self-center rounded-full bg-lavender px-3 py-1.5">
          <Text numberOfLines={1} className="text-xs font-semibold text-brand">
            Adding to: {data.trip.title}
          </Text>
        </View>
      )}

      <View className="gap-1">
        <Text className="text-xs text-muted">Total Amount</Text>
        <View className="flex-row items-center justify-center gap-1">
          <CurrencyField value={currency} onChange={changeCurrency} />
          <TextInput
            keyboardType={currency.decimals > 0 ? "decimal-pad" : "number-pad"}
            value={amountText}
            onChangeText={(text) =>
              setAmountText(sanitizeAmount(text, currency.decimals))
            }
            placeholder={currency.decimals > 0 ? "0.00" : "0"}
            placeholderTextColor="#D8C1F0"
            className="text-4xl font-bold text-ink text-center"
            style={{ minWidth: 60, paddingHorizontal: 0 }}
          />
        </View>
        {currency.code !== "RM" && (
          <Text className="text-xs text-muted text-center">
            {previewRM > 0 ? `≈ RM ${previewRM.toFixed(2)} · ` : ""}1{" "}
            {currency.code} = RM {currency.rate}
            {currency.custom ? " (your rate)" : " (estimated rate)"}
          </Text>
        )}
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
          {/* <Pressable
            accessibilityLabel="Scan receipt (not available yet)"
            className="w-11 h-11 rounded-full bg-lavender items-center justify-center"
          >
            <Camera size={20} color="#7E49C2" />
          </Pressable> */}
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

        {category && category !== "other" && (
          <Text className="text-xs text-muted">
            Typical for {data?.trip.destination || "this trip"}:{" "}
            {formatRange(costProfile[category])} per person per day (estimate)
          </Text>
        )}

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

      {loaded && !isSolo && (
        <Card>
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-xs font-semibold text-muted">PAID BY</Text>
              <Text className="text-sm font-semibold text-brand">
                {paidBy?.label ?? "..."}
              </Text>
            </View>
            <SelectField
              label="Paid By"
              value={paidBy}
              options={memberOptions}
              onChange={(option) => setPaidByChoice(option.id)}
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
            members={
              splitType.id === "amount"
                ? members
                : members.filter((m) => m.id !== paidById)
            }
            splitType={splitType.id as SplitType}
            selectedIds={selectedIds}
            onToggleMember={toggleMember}
            customAmounts={customAmounts}
            onChangeAmount={(memberId, v) =>
              setCustomAmounts((prev) => ({ ...prev, [memberId]: v }))
            }
            currencyCode={currency.code}
            decimals={currency.decimals}
            total={total}
          />
        </Card>
      )}

      {isSolo && (
        <Card>
          <Text className="text-sm font-semibold text-ink">Solo trip</Text>
          <Text className="text-xs text-muted">
            This expense comes out of your own budget.
          </Text>
        </Card>
      )}

      <Message error>{error}</Message>

      <Button busy={saving} onPress={handleSave}>
        <Save size={18} color="white" />
        <Text className="text-white font-semibold">Save Expense</Text>
      </Button>
    </Screen>
  );
}