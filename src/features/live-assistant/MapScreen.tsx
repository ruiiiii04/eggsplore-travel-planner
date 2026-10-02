import { MapPin } from "lucide-react-native";
import { Screen, Heading, Message } from "@/components/ui";
export default function MapScreen() {
  return (
    <Screen>
      <Heading>Explore Map</Heading>
      <MapPin size={48} color="#7E49C2" />
      <Message>
        The map is not connected yet. Mapbox, place information, Ask AI, and
        disruption handling belong to Module C.
      </Message>
    </Screen>
  );
}
