import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { useAuth } from "@/features/auth/useAuth";
import { getSupabase } from "@/lib/supabase";
import { errorMessage } from "@/lib/errors";
import type { Trip } from "./model";
export function useTrips() {
  const { user } = useAuth();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      setError("");
      setTrips([]);
      async function load() {
        try {
          // RLS includes both owned trips and trips the current user belongs to.
          const { data, error: failure } = await getSupabase()
            .from("trips")
            .select("*")
            .order("created_at", { ascending: false });
          if (failure) throw failure;
          if (active) setTrips(data as Trip[]);
        } catch (cause) {
          if (active) setError(errorMessage(cause));
        } finally {
          if (active) setLoading(false);
        }
      }
      if (user) void load();
      else setLoading(false);
      return () => {
        active = false;
      };
    }, [user?.id, revision]),
  );
  return {
    trips,
    loading,
    error,
    refresh: () => setRevision((value) => value + 1),
  };
}
