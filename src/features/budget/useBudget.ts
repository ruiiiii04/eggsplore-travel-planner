import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { useAuth } from "@/features/auth/useAuth";
import { errorMessage } from "@/lib/errors";
import { loadBudgetData, type BudgetData } from "./api";

export function useBudget(tripId: string | undefined) {
  const { user } = useAuth();
  const [data, setData] = useState<BudgetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      if (!tripId || !user) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError("");
      void (async () => {
        try {
          const result = await loadBudgetData(tripId, user.id);
          if (active) setData(result);
        } catch (cause) {
          if (active) setError(errorMessage(cause));
        } finally {
          if (active) setLoading(false);
        }
      })();
      return () => {
        active = false;
      };
    }, [tripId, user?.id, revision]),
  );

  return {
    data,
    loading,
    error,
    refresh: () => setRevision((value) => value + 1),
  };
}