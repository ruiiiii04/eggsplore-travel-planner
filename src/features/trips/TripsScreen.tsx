import { RefreshControl } from "react-native";
import { router } from "expo-router";
import { Screen, Heading, Button, Message } from "@/components/ui";
import { useTrips } from "./useTrips";
import { TripCard } from "./TripCard";
export default function TripsScreen() {
  const { trips, loading, error, refresh } = useTrips();
  return (
    <Screen
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={refresh} />
      }
    >
      <Heading>My Trips</Heading>
      <Button onPress={() => router.push("/trips/create")}>Create Trip</Button>
      <Message error>{error}</Message>
      {!!error && (
        <Button variant="secondary" onPress={refresh}>
          Retry
        </Button>
      )}
      {trips.map((trip) => (
        <TripCard key={trip.id} trip={trip} />
      ))}
      {!loading && !error && !trips.length && (
        <Message>Your trips will appear here.</Message>
      )}
    </Screen>
  );
}
