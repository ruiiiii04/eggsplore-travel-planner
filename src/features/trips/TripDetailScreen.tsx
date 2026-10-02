import { useCallback, useState } from "react";
import { Text } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import {
  Screen,
  Heading,
  SectionTitle,
  Message,
  Button,
} from "@/components/ui";
import { getSupabase } from "@/lib/supabase";
import { errorMessage } from "@/lib/errors";
import type { Trip } from "./model";
export default function TripDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      setError("");
      setTrip(null);
      void (async () => {
        try {
          const { data, error: failure } = await getSupabase()
            .from("trips")
            .select("*")
            .eq("id", id)
            .single();
          if (failure) throw failure;
          if (active) setTrip(data as Trip);
        } catch (cause) {
          if (active) setError(errorMessage(cause));
        }
      })();
      return () => {
        active = false;
      };
    }, [id, revision]),
  );
  return (
    <Screen>
      <Heading>{trip?.title ?? "Trip"}</Heading>
      <Message error>{error}</Message>
      {!!error && (
        <Button onPress={() => setRevision((value) => value + 1)}>Retry</Button>
      )}
      {!trip && !error && <Message>Loading trip...</Message>}
      {trip && (
        <>
          <Text className="text-lg text-ink">
            {trip.destination || "Destination to be decided"}
          </Text>
          <Message>
            {trip.start_date
              ? `${trip.start_date}${trip.end_date ? ` to ${trip.end_date}` : ""}`
              : "Dates to be decided"}
          </Message>
          <SectionTitle>Trip workspace</SectionTitle>
          <Message>
            Voting and itinerary generation (B), live assistance (C), and
            budgeting (D) are not connected yet.
          </Message>
        </>
      )}
      <Button variant="secondary" onPress={() => router.dismissTo("/trips")}>
        Back to My Trips
      </Button>
    </Screen>
  );
}
