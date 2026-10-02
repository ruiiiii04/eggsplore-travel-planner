import { useState } from "react";
import {
  View,
  Text,
  Image,
  ImageBackground,
  RefreshControl,
} from "react-native";
import { router } from "expo-router";
import { Bell, Plus, MapPin, Compass, Star } from "lucide-react-native";
import {
  Screen,
  Heading,
  SectionTitle,
  Button,
  BottomSheet,
  Message,
} from "@/components/ui";
import { useTrips } from "@/features/trips/useTrips";
import { TripCard } from "@/features/trips/TripCard";
import { tripStatus, type TripStatus } from "@/features/trips/model";
export default function HomeScreen() {
  const [filter, setFilter] = useState<TripStatus>("Live");
  const [sheet, setSheet] = useState<string | null>(null);
  const { trips, loading, error, refresh } = useTrips();
  const visible = trips.filter((trip) => tripStatus(trip) === filter);
  return (
    <Screen
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={refresh}
          tintColor="#7E49C2"
        />
      }
    >
      <View className="flex-row items-center gap-2">
        <Image
          source={require("../../../assets/eggsplore-logo.png")}
          style={{ width: 46, height: 46 }}
          resizeMode="contain"
        />
        <View className="flex-1">
          <Heading>EGGSPLORE</Heading>
          <Text className="text-xs text-muted">Smarter Trips, Happier You</Text>
        </View>
        <Button
          variant="ghost"
          accessibilityLabel="Notifications"
          onPress={() => setSheet("Notifications")}
        >
          <Bell size={22} color="#7E49C2" />
        </Button>
      </View>
      <ImageBackground
        source={require("../../../assets/home-background.png")}
        resizeMode="cover"
        style={{ minHeight: 190, marginHorizontal: -20 }}
      >
        <Image
          source={require("../../../assets/home-mascot.png")}
          resizeMode="contain"
          style={{
            position: "absolute",
            bottom: 0,
            right: 0,
            width: 110,
            height: 130,
          }}
        />
        <View style={{ padding: 20, paddingRight: 108, gap: 12 }}>
          <Text className="text-3xl font-bold text-ink">Hi there!</Text>
          <Text className="text-sm text-ink">
            Where would you like to go next?
          </Text>
          <Button
            className="self-start"
            onPress={() => router.push("/trips/create")}
          >
            <Plus size={18} color="white" />
            <Text className="text-white font-semibold">Create Trip</Text>
          </Button>
        </View>
      </ImageBackground>
      <View className="flex-row gap-1">
        {(["Live", "Upcoming", "Past"] as const).map((value) => (
          <Button
            className="flex-1 px-2"
            key={value}
            variant={value === filter ? "primary" : "secondary"}
            onPress={() => setFilter(value)}
          >
            {value}
          </Button>
        ))}
      </View>
      <Message error>{error}</Message>
      {!!error && (
        <Button variant="secondary" onPress={refresh}>
          Retry
        </Button>
      )}
      {visible.map((trip) => (
        <TripCard key={trip.id} trip={trip} />
      ))}
      {!loading && !error && visible.length === 0 && (
        <Message>No {filter.toLowerCase()} trips yet.</Message>
      )}
      <SectionTitle>Explore Eggsplore</SectionTitle>
      <View className="gap-2">
        <Button variant="secondary" onPress={() => router.push("/map")}>
          <MapPin size={20} color="#7E49C2" />
          <Text className="text-brand font-semibold">Explore Map</Text>
        </Button>
        <Button variant="secondary" onPress={() => router.push("/trips")}>
          <Compass size={20} color="#7E49C2" />
          <Text className="text-brand font-semibold">My Trips</Text>
        </Button>
        <Button variant="secondary" onPress={() => router.push("/profile")}>
          <Star size={20} color="#7E49C2" />
          <Text className="text-brand font-semibold">
            My Preference Profiles
          </Text>
        </Button>
        <Button variant="ghost" onPress={() => setSheet("AI Travel Assistant")}>
          Ask AI
        </Button>
      </View>
      <BottomSheet
        visible={!!sheet}
        title={sheet ?? ""}
        onClose={() => setSheet(null)}
      >
        <Message>
          {sheet === "Notifications"
            ? "No notifications yet. Live alerts are not connected in this foundation release."
            : "The AI assistant is planned for Module C. No AI request has been sent."}
        </Message>
      </BottomSheet>
    </Screen>
  );
}
