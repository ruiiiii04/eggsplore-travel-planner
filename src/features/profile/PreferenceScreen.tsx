import { useEffect, useState } from "react";
import { View, Text } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { randomUUID } from "expo-crypto";
import { ArrowLeft, ArrowUp, ArrowDown } from "lucide-react-native";
import {
  Screen,
  Heading,
  SectionTitle,
  Field,
  Button,
  Message,
  BottomSheet,
} from "@/components/ui";
import { useAuth } from "@/features/auth/useAuth";
import { errorMessage } from "@/lib/errors";
import { categories, companions, interestGroups } from "./options";
import { readProfile, updateProfile } from "./service";
import type { TravelPreference } from "./types";
import {
  memberCategoryWeights,
  preferenceCategories,
} from "../../../supabase/functions/_shared/preference-weights";
export default function PreferenceScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("beach");
  const [pace, setPace] = useState("Moderate");
  const [companion, setCompanion] = useState("solo");
  const [order, setOrder] = useState([
    "Stay",
    "Food",
    "Activities",
    "Transport",
  ]);
  const [interests, setInterests] = useState<string[]>([]);
  const [categoryWeights, setCategoryWeights] = useState<
    Record<string, string>
  >({});
  const [original, setOriginal] = useState<TravelPreference | null>(null);
  const [loading, setLoading] = useState(!!id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!id || !user) return;
    let active = true;
    setLoading(true);
    setError("");
    void readProfile(user.id)
      .then((profile) => {
        if (!active) return;
        const item = profile.preferences.profiles?.find(
          (value) => value.id === id,
        );
        if (!item) throw new Error("This preference profile no longer exists.");
        setOriginal(item);
        setName(item.name);
        setCategory(item.category ?? "beach");
        setPace(item.pace === "Packed" ? "Intense" : (item.pace ?? "Moderate"));
        setCompanion(item.companion ?? "solo");
        setOrder(
          item.spendingOrder ?? ["Stay", "Food", "Activities", "Transport"],
        );
        setInterests(item.interests ?? []);
        setCategoryWeights(
          Object.fromEntries(
            Object.entries(item.categoryWeights ?? {}).map(([k, v]) => [
              k,
              String(v),
            ]),
          ),
        );
      })
      .catch((cause) => {
        if (active) setError(errorMessage(cause));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id, user?.id, retry]);
  const disabled = busy || loading || (!!id && !original);
  function move(index: number, direction: number) {
    setOrder((previous) => {
      const next = [...previous];
      const target = index + direction;
      if (target < 0 || target >= next.length) return previous;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }
  async function save(remove = false) {
    if (disabled || !user) return;
    if (!remove && !name.trim()) {
      setError("Enter a profile name.");
      return;
    }
    const suppliedWeights = Object.fromEntries(
      Object.entries(categoryWeights)
        .filter(([, v]) => v.trim() !== "")
        .map(([k, v]) => [k, Number(v)]),
    );
    if (
      !remove &&
      Object.values(suppliedWeights).some(
        (v) => !Number.isFinite(v) || v < 0 || v > 100,
      )
    ) {
      setError("Category weights must be numbers between 0 and 100.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const selected = categories.find((value) => value.id === category)!;
      const item: TravelPreference = {
        ...original,
        id: id ?? randomUUID(),
        name: name.trim(),
        category,
        emoji: selected.emoji,
        tags: interests.length ? interests.slice(0, 3) : selected.tags,
        pace,
        companion,
        spendingOrder: order,
        interests,
        categoryWeights: Object.keys(suppliedWeights).length
          ? suppliedWeights
          : undefined,
        createdAt: original?.createdAt ?? new Date().toISOString(),
      };
      await updateProfile(user.id, (current) => {
        const profiles = current.preferences.profiles ?? [];
        if (id && !profiles.some((value) => value.id === id))
          throw new Error(
            "This preference profile was deleted. Return to Profile and refresh.",
          );
        return {
          preferences: {
            ...current.preferences,
            profiles: remove
              ? profiles.filter((value) => value.id !== id)
              : id
                ? profiles.map((value) =>
                    value.id === id ? { ...value, ...item } : value,
                  )
                : [...profiles, item],
          },
        };
      });
      router.dismissTo("/profile");
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen>
      <View className="flex-row items-center gap-2">
        <Button
          variant="ghost"
          accessibilityLabel="Back to profile"
          disabled={busy}
          onPress={() => router.dismissTo("/profile")}
        >
          <ArrowLeft size={22} color="#7E49C2" />
        </Button>
        <View className="flex-1">
          <Heading>{id ? "Edit Profile" : "New Profile"}</Heading>
        </View>
      </View>
      <Message error>{error}</Message>
      {loading && <Message>Loading preference profile...</Message>}
      {!!id && !loading && !original && (
        <Button onPress={() => setRetry((value) => value + 1)}>Retry</Button>
      )}
      <SectionTitle>Basic Info</SectionTitle>
      <Field
        label="Profile Name *"
        value={name}
        onChangeText={setName}
        editable={!disabled}
        placeholder="e.g. Beach Lover"
      />
      <SectionTitle>Icon</SectionTitle>
      <Message>Tap to select a category</Message>
      <View className="flex-row flex-wrap gap-2">
        {categories.map((item) => (
          <Button
            key={item.id}
            disabled={disabled}
            variant={category === item.id ? "primary" : "secondary"}
            accessibilityState={{ selected: category === item.id }}
            onPress={() => setCategory(item.id)}
          >{`${item.emoji} ${item.name}`}</Button>
        ))}
      </View>
      <SectionTitle>Category weights (0–100%)</SectionTitle>
      <Message>
        Higher weights give matching places more influence in your votes. Leave
        all fields blank to use your selected interests; zero disables a
        category. We normalize weights so every member has the same maximum vote
        strength.
      </Message>
      <Button
        variant="secondary"
        disabled={disabled}
        onPress={() => {
          const selected = categories.find((c) => c.id === category);
          const defaults = memberCategoryWeights([
            { category, tags: selected?.tags, interests },
          ]);
          setCategoryWeights(
            Object.fromEntries(
              preferenceCategories.map((c) => [
                c,
                String(Math.round((defaults[c] ?? 0) * 100)),
              ]),
            ),
          );
        }}
      >
        Use template weights
      </Button>
      {preferenceCategories.map((c) => (
        <Field
          key={c}
          label={c + " (%)"}
          keyboardType="decimal-pad"
          value={categoryWeights[c] ?? ""}
          editable={!disabled}
          placeholder="Automatic"
          onChangeText={(value) =>
            setCategoryWeights((previous) => ({ ...previous, [c]: value }))
          }
        />
      ))}
      <SectionTitle>Travel Pace</SectionTitle>
      <View className="flex-row flex-wrap gap-2">
        {["Relaxed", "Moderate", "Intense"].map((value) => (
          <Button
            key={value}
            disabled={disabled}
            variant={pace === value ? "primary" : "secondary"}
            onPress={() => setPace(value)}
          >
            {value}
          </Button>
        ))}
      </View>
      <SectionTitle>Companion Type</SectionTitle>
      <Message>Who are you travelling with?</Message>
      <View className="flex-row flex-wrap gap-2">
        {companions.map((item) => (
          <Button
            key={item.id}
            disabled={disabled}
            variant={companion === item.id ? "primary" : "secondary"}
            onPress={() => setCompanion(item.id)}
          >
            {item.name}
          </Button>
        ))}
      </View>
      <SectionTitle>Spending Priority</SectionTitle>
      <Message>Use the arrows to rank where you want to splurge most</Message>
      <View>
        {order.map((item, index) => (
          <View
            key={item}
            className="flex-row items-center border-b border-line py-1 gap-2"
          >
            <Text
              style={{ fontFamily: "Inter" }}
              className="text-base text-ink flex-1"
            >
              {index + 1}. {item}
            </Text>
            <Button
              variant="ghost"
              accessibilityLabel={`Move ${item} up`}
              disabled={disabled || index === 0}
              onPress={() => move(index, -1)}
            >
              <ArrowUp color="#7E49C2" size={20} />
            </Button>
            <Button
              variant="ghost"
              accessibilityLabel={`Move ${item} down`}
              disabled={disabled || index === order.length - 1}
              onPress={() => move(index, 1)}
            >
              <ArrowDown color="#7E49C2" size={20} />
            </Button>
          </View>
        ))}
      </View>
      <SectionTitle>Interests</SectionTitle>
      {interestGroups.map((group) => (
        <View key={group.title} className="gap-3">
          <Text
            style={{ fontFamily: "Inter" }}
            className="text-base font-semibold text-ink"
          >
            {group.title}
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {group.options.map((value) => (
              <Button
                key={value}
                disabled={disabled}
                variant={interests.includes(value) ? "primary" : "secondary"}
                onPress={() =>
                  setInterests((previous) =>
                    previous.includes(value)
                      ? previous.filter((item) => item !== value)
                      : [...previous, value],
                  )
                }
              >
                {value}
              </Button>
            ))}
          </View>
        </View>
      ))}
      <Button
        disabled={disabled || !name.trim()}
        busy={busy}
        onPress={() => void save()}
      >
        {id ? "Save Profile" : "Create Profile"}
      </Button>
      {!!id && (
        <Button
          variant="ghost"
          disabled={disabled}
          onPress={() => setConfirmDelete(true)}
        >
          Delete preference profile
        </Button>
      )}
      <BottomSheet
        visible={confirmDelete}
        title="Delete preference profile?"
        onClose={() => setConfirmDelete(false)}
        busy={busy}
      >
        <Message>
          This removes this travel preference, not your account.
        </Message>
        <Message error>{error}</Message>
        <Button variant="danger" busy={busy} onPress={() => void save(true)}>
          Delete profile
        </Button>
      </BottomSheet>
    </Screen>
  );
}
