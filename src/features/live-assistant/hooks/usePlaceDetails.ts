import { useEffect, useState } from "react";
import { loadPlaceDetails } from "../services/api";
import type { OnlinePlaceDetails } from "../types";

// NEW: abort stale requests so an old pin's response cannot replace a new pin's details.
export function usePlaceDetails(placeId: string) {
  const [data, setData] = useState<OnlinePlaceDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 90_000);
    setLoading(true);
    setError(null);
    setData(null);
    void loadPlaceDetails(placeId, controller.signal)
      .then((value) => {
        if (active) setData(value);
      })
      .catch((cause) => {
        if (active)
          setError(
            controller.signal.aborted
              ? "Loading timed out. Please retry."
              : cause instanceof Error
                ? cause.message
                : "Could not load this place.",
          );
      })
      .finally(() => {
        clearTimeout(timer);
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [placeId, attempt]);
  return {
    data: data?.placeId === placeId ? data : null,
    loading,
    error,
    retry: () => setAttempt((x) => x + 1),
  };
}
