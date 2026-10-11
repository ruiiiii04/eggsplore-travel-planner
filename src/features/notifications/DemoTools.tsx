// // DEMO ONLY. To remove after the demo:
// //  1. delete this file,
// //  2. delete the DemoTools import and the <DemoTools /> tag in NotificationSheet.tsx,
// //  3. run in the Supabase SQL Editor:
// //     delete from public.notifications where data->>'simulated' = 'true';
// // Or just set DEMO_TOOLS to false to hide the button.
// import { useState } from "react";
// import { Text, View } from "react-native";
// import { Button, Message } from "@/components/ui";
// import { getRecentTripId } from "@/features/trips/recentTrip";
// import { errorMessage } from "@/lib/errors";
// import { getSupabase } from "@/lib/supabase";

// export const DEMO_TOOLS = true;

// async function simulateRain(tripId: string): Promise<void> {
//   const { error } = await getSupabase().rpc("create_weather_alerts", {
//     target_trip: tripId,
//     alerts: [
//       {
//         key: `weather-sim:${tripId}:${Date.now()}`,
//         item_id: "",
//         title: "Rain likely for your next outdoor activity",
//         body: "Demo alert · 80% chance of rain",
//         simulated: true,
//       },
//     ],
//   });
//   if (error) throw error;
// }

// export function DemoTools({ onDone }: { onDone: () => void }) {
//   const [busy, setBusy] = useState(false);
//   const [message, setMessage] = useState("");
//   if (!DEMO_TOOLS) return null;

//   async function run() {
//     setBusy(true);
//     setMessage("");
//     try {
//       const tripId = await getRecentTripId();
//       if (!tripId) {
//         setMessage("Open a trip first, then try again.");
//         return;
//       }
//       await simulateRain(tripId);
//       setMessage("Demo alert sent to everyone on your most recent trip.");
//       onDone();
//     } catch (cause) {
//       setMessage(errorMessage(cause));
//     } finally {
//       setBusy(false);
//     }
//   }

//   return (
//     <View className="gap-2 border-t border-line pt-3">
//       <Text className="text-xs text-muted">Demo tools</Text>
//       <Button variant="secondary" busy={busy} onPress={run}>
//         Simulate rain alert
//       </Button>
//       <Message>{message}</Message>
//     </View>
//   );
// }