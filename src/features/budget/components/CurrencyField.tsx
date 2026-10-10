import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { BottomSheet, Button, Message } from "@/components/ui";
import {
  DEFAULT_CURRENCY,
  parseRate,
  searchCurrencies,
  selectionFor,
  type CurrencySelection,
} from "../currencies";

type Props = {
  value: CurrencySelection;
  onChange: (next: CurrencySelection) => void;
};

export function CurrencyField({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [manual, setManual] = useState(false);
  const [query, setQuery] = useState("");
  const [codeInput, setCodeInput] = useState("");
  const [rateInput, setRateInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  function close() {
    setOpen(false);
    setManual(false);
    setQuery("");
    setError(null);
  }

  function pick(next: CurrencySelection) {
    onChange(next);
    close();
  }

  function submitManual() {
    const code = codeInput.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(code)) {
      setError("Enter a 3-letter currency code, for example CHF.");
      return;
    }
    if (code === "MYR") {
      pick(DEFAULT_CURRENCY);
      return;
    }
    const rate = parseRate(rateInput);
    if (rate === null) {
      setError("Enter how many RM one unit is worth, for example 5.10.");
      return;
    }
    pick({ code, rate, decimals: 2, custom: true });
  }

  const results = searchCurrencies(query);

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`Currency ${value.code}`}
        className="flex-row items-center rounded-full border border-line bg-lavender px-3 py-1.5"
      >
        <Text className="text-xs font-semibold text-brand">{value.code}</Text>
        <Text className="text-xs text-brand ml-1">▾</Text>
      </Pressable>

      <BottomSheet
        visible={open}
        title={manual ? "Other currency" : "Choose currency"}
        onClose={close}
      >
        {manual ? (
          <View className="gap-3">
            <Text className="text-xs text-muted">
              Type the currency code and what one unit is worth in RM. Use this
              for a currency that isn't listed, or to use your own rate for a
              listed one.
            </Text>
            <TextInput
              value={codeInput}
              onChangeText={(t) =>
                setCodeInput(t.replace(/[^a-zA-Z]/g, "").slice(0, 3))
              }
              autoCapitalize="characters"
              placeholder="Code, e.g. CHF"
              placeholderTextColor="#817493"
              className="min-h-12 rounded-lg border border-line bg-white px-4 py-3 text-base text-ink"
            />
            <TextInput
              value={rateInput}
              onChangeText={(t) => setRateInput(t.replace(/[^0-9.]/g, ""))}
              keyboardType="decimal-pad"
              placeholder="1 unit = RM ... e.g. 5.10"
              placeholderTextColor="#817493"
              className="min-h-12 rounded-lg border border-line bg-white px-4 py-3 text-base text-ink"
            />
            <Message error>{error}</Message>
            <Button onPress={submitManual}>Use this currency</Button>
            <Button
              variant="ghost"
              onPress={() => {
                setManual(false);
                setError(null);
              }}
            >
              Back to list
            </Button>
          </View>
        ) : (
          <View className="gap-3">
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search by code or name"
              placeholderTextColor="#817493"
              autoCapitalize="none"
              className="min-h-12 rounded-lg border border-line bg-white px-4 py-3 text-base text-ink"
            />
            <ScrollView
              style={{ maxHeight: 320 }}
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
            >
              {results.length === 0 && (
                <Message>
                  No match. Use "Other currency" to enter it yourself.
                </Message>
              )}
              {results.map((c) => {
                const selected = !value.custom && value.code === c.code;
                return (
                  <Pressable
                    key={c.code}
                    onPress={() => pick(selectionFor(c))}
                    className={`flex-row items-center justify-between rounded-lg px-4 py-3 ${
                      selected ? "bg-lavender" : ""
                    }`}
                  >
                    <Text
                      className={`text-base ${
                        selected ? "text-brand font-semibold" : "text-ink"
                      }`}
                    >
                      {c.code}
                    </Text>
                    <Text className="text-xs text-muted">{c.name}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <Button
              variant="secondary"
              onPress={() => {
                setManual(true);
                setError(null);
              }}
            >
              Other currency (enter rate)
            </Button>
          </View>
        )}
      </BottomSheet>
    </>
  );
}