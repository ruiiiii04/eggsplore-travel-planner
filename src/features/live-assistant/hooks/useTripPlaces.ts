import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { invokeAssistantFunction } from "../services/api";
import type { SamplePlace, TripMapPage, UnmappedPlace } from "../types";

type State = {
  tripId: string | null;
  places: SamplePlace[];
  unresolved: UnmappedPlace[];
  loading: boolean;
  error: string;
};
const empty: State = {
  tripId: null,
  places: [],
  unresolved: [],
  loading: false,
  error: "",
};
export function useTripPlaces(tripId: string | null) {
  const [state, setState] = useState<State>(empty);
  const [revision, setRevision] = useState(0);
  useFocusEffect(
    useCallback(() => {
      const controller = new AbortController();
      let active = true;
      setState({ ...empty, tripId, loading: Boolean(tripId) });
      async function load() {
        let places: SamplePlace[] = [],
          unresolved: UnmappedPlace[] = [];
        let offset: number | null = 0;
        try {
          while (offset !== null && active) {
            const timer = setTimeout(() => controller.abort(), 95_000);
            let page: TripMapPage;
            try {
              page = await invokeAssistantFunction<TripMapPage>(
                "trip-map",
                { tripId, offset },
                controller.signal,
              );
            } finally {
              clearTimeout(timer);
            }
            if (!active) return;
            if (
              page.tripId !== tripId ||
              !Array.isArray(page.places) ||
              !Array.isArray(page.unresolved) ||
              (page.nextOffset !== null &&
                (!Number.isInteger(page.nextOffset) ||
                  page.nextOffset <= offset))
            ) {
              throw new Error(
                "Invalid map response. Redeploy trip-map and retry.",
              );
            }
            places = [...places, ...page.places];
            unresolved = [...unresolved, ...page.unresolved];
            offset = page.nextOffset;
            setState({
              tripId,
              places,
              unresolved,
              loading: offset !== null,
              error: "",
            });
          }
        } catch (cause) {
          if (active)
            setState({
              tripId,
              places,
              unresolved,
              loading: false,
              error: controller.signal.aborted
                ? "Location lookup timed out. Retry to load the itinerary."
                : cause instanceof Error
                  ? cause.message
                  : "Could not load itinerary places.",
            });
        }
      }
      if (tripId) void load();
      return () => {
        active = false;
        controller.abort();
      };
    }, [tripId, revision]),
  );
  // Never display a previous trip's late result under the new trip title.
  const current =
    state.tripId === tripId
      ? state
      : { ...empty, tripId, loading: Boolean(tripId) };
  return { ...current, retry: () => setRevision((value) => value + 1) };
}
