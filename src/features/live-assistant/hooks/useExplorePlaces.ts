import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { invokeAssistantFunction } from "../services/api";
import type { SamplePlace } from "../types";
type Result = {
  tripId: string | null;
  city: string;
  center: { latitude: number; longitude: number } | null;
  places: SamplePlace[];
};
const empty: Result = { tripId: null, city: "", center: null, places: [] };
export function useExplorePlaces(tripId: string | null) {
  const [state, setState] = useState({ ...empty, loading: false, error: "" });
  const [revision, setRevision] = useState(0);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      const controller = new AbortController();
      setState({ ...empty, tripId, loading: Boolean(tripId), error: "" });
      if (tripId) {
        const timer = setTimeout(() => controller.abort(), 90_000);
        void invokeAssistantFunction<Result>(
          "explore-places",
          { tripId },
          controller.signal,
        )
          .then((data) => {
            if (data.tripId !== tripId || !Array.isArray(data.places))
              throw new Error(
                "Invalid Explore response. Redeploy explore-places.",
              );
            if (active) setState({ ...data, loading: false, error: "" });
          })
          .catch((error) => {
            if (active)
              setState({
                ...empty,
                tripId,
                loading: false,
                error: controller.signal.aborted
                  ? "Explore timed out. Please retry."
                  : error instanceof Error
                    ? error.message
                    : "Could not load nearby places.",
              });
          })
          .finally(() => clearTimeout(timer));
      }
      return () => {
        active = false;
        controller.abort();
      };
    }, [tripId, revision]),
  );
  return {
    ...(state.tripId === tripId
      ? state
      : { ...empty, loading: Boolean(tripId), error: "" }),
    retry: () => setRevision((n) => n + 1),
  };
}
