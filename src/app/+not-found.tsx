import { router } from "expo-router";
import { Screen, Heading, Button } from "@/components/ui";
export default function NotFound() {
  return (
    <Screen>
      <Heading>Page not found</Heading>
      <Button onPress={() => router.replace("/")}>Go back</Button>
    </Screen>
  );
}
