import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getSupabase } from "@/lib/supabase";
import {
  DEFAULT_PROFILE,
  destinationKey,
  knownProfile,
  parseProfile,
  type CostProfile,
} from "./estimates";

export type CostSource = "table" | "ai" | "default";

type Fetched = { key: string; profile: CostProfile | null; done: boolean };

const memory = new Map<string, CostProfile>();
const failed = new Set<string>();
const storageKey = (key: string) => `eggsplore:cost-profile:${key}`;

export function useCostProfile(destination: string | null): {
  profile: CostProfile;
  source: CostSource;
  loading: boolean;
} {
  const key = destinationKey(destination);
  const known = knownProfile(destination);
  const lookup = !known && key.length >= 3;
  const [fetched, setFetched] = useState<Fetched>({
    key: "",
    profile: null,
    done: true,
  });

  useEffect(() => {
    if (!lookup) return;
    const cached = memory.get(key);
    if (cached) {
      setFetched({ key, profile: cached, done: true });
      return;
    }
    if (failed.has(key)) {
      setFetched({ key, profile: null, done: true });
      return;
    }
    let active = true;
    setFetched({ key, profile: null, done: false });
    // Wait while the user is still typing before spending an AI call.
    const timer = setTimeout(async () => {
      try {
        const stored = await AsyncStorage.getItem(storageKey(key));
        const fromStorage = stored ? parseProfile(JSON.parse(stored)) : null;
        if (fromStorage) {
          memory.set(key, fromStorage);
          if (active) setFetched({ key, profile: fromStorage, done: true });
          return;
        }
        const { data, error } = await getSupabase().functions.invoke(
          "estimate-costs",
          { body: { destination: (destination ?? "").trim() } },
        );
        if (error) throw error;
        const profile = parseProfile(data?.profile);
        if (!profile) throw new Error("Unusable estimate.");
        memory.set(key, profile);
        await AsyncStorage.setItem(
          storageKey(key),
          JSON.stringify(profile),
        ).catch(() => undefined);
        if (active) setFetched({ key, profile, done: true });
      } catch {
        failed.add(key);
        if (active) setFetched({ key, profile: null, done: true });
      }

    }, 700);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [key, lookup]);

  if (known) return { profile: known, source: "table", loading: false };
  if (!lookup) {
    return { profile: DEFAULT_PROFILE, source: "default", loading: false };
  }
  if (fetched.key !== key) {
    return { profile: DEFAULT_PROFILE, source: "default", loading: true };
  }
  if (fetched.profile) {
    return { profile: fetched.profile, source: "ai", loading: false };
  }
  return {
    profile: DEFAULT_PROFILE,
    source: "default",
    loading: !fetched.done,
  };
}