import { useState } from "react";
import { router } from "expo-router";
import { Screen, Heading, Field, Button, Message } from "@/components/ui";
import { useAuth } from "@/features/auth/useAuth";
import { getSupabase } from "@/lib/supabase";
import { errorMessage } from "@/lib/errors";
import { validateTrip } from "./model";
export default function CreateTripScreen() {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [destination, setDestination] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function save() {
    if (busy || !user) return;
    const validation = validateTrip(title, start, end);
    if (validation) {
      setError(validation);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const { data, error: failure } = await getSupabase()
        .from("trips")
        .insert({
          owner_id: user.id,
          title: title.trim(),
          destination: destination.trim() || null,
          start_date: start || null,
          end_date: end || null,
        })
        .select("id")
        .single();
      if (failure) throw failure;
      router.replace({ pathname: "/trips/[id]", params: { id: data.id } });
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen>
      <Heading>Create Trip</Heading>
      <Field
        label="Trip title"
        value={title}
        onChangeText={setTitle}
        editable={!busy}
      />
      <Field
        label="Destination"
        value={destination}
        onChangeText={setDestination}
        editable={!busy}
      />
      <Field
        label="Start date (optional)"
        placeholder="YYYY-MM-DD"
        value={start}
        onChangeText={setStart}
        editable={!busy}
        autoCapitalize="none"
        maxLength={10}
      />
      <Field
        label="End date (optional)"
        placeholder="YYYY-MM-DD"
        value={end}
        onChangeText={setEnd}
        editable={!busy}
        autoCapitalize="none"
        maxLength={10}
      />
      <Message error>{error}</Message>
      <Button busy={busy} onPress={() => void save()}>
        Create Trip
      </Button>
      <Button
        variant="ghost"
        disabled={busy}
        onPress={() => router.dismissTo("/trips")}
      >
        Cancel
      </Button>
    </Screen>
  );
}
