import AsyncStorage from "@react-native-async-storage/async-storage";

const RECENT_TRIP_KEY = "eggsplore:recent-trip";

export async function getRecentTripId() {
  return AsyncStorage.getItem(RECENT_TRIP_KEY);
}

export async function rememberTrip(id: string) {
  if (id) await AsyncStorage.setItem(RECENT_TRIP_KEY, id);
}
