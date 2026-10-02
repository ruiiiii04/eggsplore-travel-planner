import { Stack } from "expo-router";
import { TripCreationProvider } from "./TripCreationContext";

export default function TripCreationLayout() {
  return (
    <TripCreationProvider>
      <Stack screenOptions={{ headerShown: false, animation: "slide_from_right" }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="type" />
        <Stack.Screen name="details" />
        <Stack.Screen name="preferences" />
        <Stack.Screen name="invite" />
        <Stack.Screen name="creating" />
        <Stack.Screen name="created" />
      </Stack>
    </TripCreationProvider>
  );
}
