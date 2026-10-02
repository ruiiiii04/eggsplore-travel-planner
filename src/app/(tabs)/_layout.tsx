import { Tabs } from "expo-router";
import {
  Home,
  BriefcaseBusiness,
  MapPin,
  UserRound,
} from "lucide-react-native";
export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#7C4DBE",
        tabBarInactiveTintColor: "#222222",
        tabBarStyle: {
          height: 90,
          paddingTop: 12,
          paddingBottom: 8,
          width: "100%",
          maxWidth: 402,
          alignSelf: "center",
          backgroundColor: "#FFFFFF",
          borderTopColor: "#EEE7F5",
          borderTopWidth: 1,
          elevation: 8,
        },
        tabBarLabelStyle: {
          fontFamily: "Inter",
          fontSize: 11,
          fontWeight: "600",
          marginTop: 5,
        },
        tabBarIconStyle: { marginTop: 0 },
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="trips"
        options={{
          title: "Trip",
          tabBarIcon: ({ color, size }) => (
            <BriefcaseBusiness color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: "Map",
          tabBarIcon: ({ color, size }) => <MapPin color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => (
            <UserRound color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
