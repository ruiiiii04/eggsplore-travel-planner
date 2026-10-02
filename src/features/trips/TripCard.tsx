import { View, Text } from "react-native";
import { router } from "expo-router";
import { MapPin, CalendarDays } from "lucide-react-native";
import { Card, Button } from "@/components/ui";
import { tripStatus, type Trip } from "./model";
export function TripCard({ trip }: { trip: Trip }) {
  return (
    <Card>
      <View className="flex-row items-start justify-between gap-3">
        <Text className="text-lg font-bold text-ink flex-1">{trip.title}</Text>
        <Text className="text-xs text-brand bg-lavender px-2 py-1 rounded">
          {tripStatus(trip)}
        </Text>
      </View>
      <View className="flex-row items-center gap-2">
        <MapPin size={17} color="#817493" />
        <Text className="text-muted flex-1">
          {trip.destination || "Destination not set"}
        </Text>
      </View>
      <View className="flex-row items-center gap-2">
        <CalendarDays size={17} color="#817493" />
        <Text className="text-muted flex-1">
          {trip.start_date
            ? `${trip.start_date}${trip.end_date ? ` to ${trip.end_date}` : ""}`
            : "Dates to be decided"}
        </Text>
      </View>
      <Button
        variant="secondary"
        onPress={() =>
          router.push({ pathname: "/trips/[id]", params: { id: trip.id } })
        }
      >
        Open trip
      </Button>
    </Card>
  );
}
