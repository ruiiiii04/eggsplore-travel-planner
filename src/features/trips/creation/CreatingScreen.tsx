import { useCallback, useEffect, useRef, useState } from "react";
import { router } from "expo-router";
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Check, Circle } from "lucide-react-native";
import Svg, { Path } from "react-native-svg";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/features/auth/useAuth";
import { getSupabase } from "@/lib/supabase";
import { errorMessage } from "@/lib/errors";
import { validateTrip } from "@/features/trips/model";
import { CreationHeader, tripColors } from "./CreationUI";
import { useTripCreation } from "./TripCreationContext";

const itineraryTasks = ["Drafting your day-by-day plan", "Saving your trip", "Saving itinerary activities", "Finishing your trip"];
const flexibleTasks = ["Preparing your flexible trip", "Saving your trip", "Finishing your trip"];
type GeneratedItinerary = { days: { date: string; activities: { time: string; title: string; description: string; location: string }[] }[] };

export default function CreatingScreen() {
  const { user } = useAuth();
  const { data, update } = useTripCreation();
  const startDate = data.startDate.trim();
  const endDate = data.endDate.trim();
  const hasDates = !!startDate && !!endDate;
  const tasks = hasDates ? itineraryTasks : flexibleTasks;
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  const [progressStep, setProgressStep] = useState(0);
  const running = useRef(false);
  const completed = useRef(false);
  const itineraryDraft = useRef<GeneratedItinerary | null>(null);
  const createdTripId = useRef<string | null>(null);

  const saveTrip = useCallback(async () => {
    if (running.current || completed.current) return;
    running.current = true;
    setBusy(true); setError("");
    try {
      if (!user) throw new Error("Please sign in again before creating a trip.");
      const title = data.title.trim() || (data.destination ? `Trip to ${data.destination.trim()}` : "");
      if (!!startDate !== !!endDate) throw new Error("Add both travel dates, or leave both blank to decide later.");
      const validation = validateTrip(title, startDate, endDate);
      if (validation) throw new Error(validation);
      if (!data.destination.trim()) throw new Error("Add a destination before creating your trip.");
      const tripDays = hasDates ? Math.floor((Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / 86_400_000) + 1 : 0;
      if (tripDays > 14) throw new Error("AI itinerary generation currently supports trips up to 14 days.");

      const client = getSupabase();
      if (hasDates && !itineraryDraft.current) {
        setProgressStep(0);
        const { data: generated, error: generationError } = await client.functions.invoke("generate-itinerary", {
          body: {
            destination: data.destination.trim(),
            startDate,
            endDate,
            tripType: data.tripType || "solo",
            budget: data.budget,
            preferences: data.preference === "Custom" ? data.customPreferences : [data.preference].filter(Boolean),
          },
        });
        if (generationError) {
          let message = generationError.message;
          if (generationError.context instanceof Response) {
            try {
              const details = await generationError.context.json();
              if (typeof details?.error === "string") message = details.error;
            } catch { /* Keep the Supabase function error. */ }
          }
          throw new Error(message || "Could not generate your itinerary. Please try again.");
        }
        if (!generated?.itinerary?.days?.length) throw new Error("The AI returned an empty itinerary. Please try again.");
        itineraryDraft.current = generated.itinerary as GeneratedItinerary;
      }

      setProgressStep(1);
      if (!createdTripId.current) {
        const { data: created, error: failure } = await client.from("trips").insert({
          owner_id: user.id,
          title,
          destination: data.destination.trim(),
          start_date: hasDates ? startDate : null,
          end_date: hasDates ? endDate : null,
        }).select("id").single();
        if (failure) throw failure;
        createdTripId.current = created.id;
      }

      setProgressStep(2);
      const tripId = createdTripId.current;
      if (!tripId) throw new Error("The trip could not be saved. Please try again.");
      if (hasDates) {
        if (!itineraryDraft.current) throw new Error("The generated itinerary was lost. Please try again.");
        const { error: clearFailure } = await client.from("itinerary_items").delete().eq("trip_id", tripId);
        if (clearFailure) throw clearFailure;
        const activities = itineraryDraft.current.days.flatMap((day) => day.activities.map((activity) => ({
          trip_id: tripId,
          title: activity.title.trim(),
          description: activity.description.trim(),
          location_name: activity.location.trim(),
          // Preserve destination local wall-clock time as UTC fields; the UI reads
          // the date and HH:mm directly instead of shifting it to the phone zone.
          start_time: `${day.date}T${activity.time}:00Z`,
          position: 0,
        }))).map((activity, position) => ({ ...activity, position }));
        const { error: itineraryFailure } = await client.from("itinerary_items").insert(activities);
        if (itineraryFailure) throw itineraryFailure;
      }

      let invitationStatus = "";
      let invitationFailed = false;
      if (data.invitees.length) {
        const { error: memberError } = await client.from("trip_members").upsert(
          data.invitees.map((person) => ({ trip_id: tripId, user_id: person.id, role: "member" })),
          { onConflict: "trip_id,user_id", ignoreDuplicates: true },
        );
        if (memberError) {
          invitationFailed = true;
          invitationStatus = `Trip created, but some members could not be added. You can add them from the trip later. ${errorMessage(memberError)}`;
        } else invitationStatus = `${data.invitees.length} member${data.invitees.length === 1 ? "" : "s"} added to the trip.`;
      }

      completed.current = true;
      setProgressStep(3);
      update({ title, tripId, invitationStatus, invitationFailed });
      router.replace("/trips/create/created");
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      running.current = false;
      setBusy(false);
    }
  }, [user, data, update]);

  useEffect(() => { void saveTrip(); }, [saveTrip]);

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.safe}>
      <CreationHeader onBack={() => { if (router.canGoBack()) router.back(); else router.replace(data.tripType === "group" ? "/trips/create/invite" : "/trips/create/preferences"); }} />
      <View style={styles.content}>
        <View style={styles.art}><Image source={require("../../../../assets/figma-creating-mascot.png")} resizeMode="contain" style={styles.mascot} /></View>
        <Text style={styles.title}>{error ? "We couldn't save your trip" : "Creating Your Trip..."}</Text>
        <Text style={styles.subtitle}>{error || (hasDates ? "Our AI is crafting the perfect itinerary just for you!" : "Your trip is ready. You can collect and vote on places before choosing dates.")}</Text>
        <View style={styles.tasks}>
          {tasks.map((task, index) => <View key={task} style={styles.task}>
            {error ? <Circle size={18} color="#D7C9E3" /> : index < progressStep ? <Check size={18} color="white" fill={tripColors.purple} /> : index === progressStep && busy ? <ActivityIndicator size="small" color={tripColors.purple} /> : <Circle size={18} color="#D7C9E3" fill="#EEE7F6" />}
            <Text style={[styles.taskText, index < progressStep && styles.taskDone, index === progressStep && busy && styles.taskActive, error && styles.taskMuted]}>{task}</Text>
          </View>)}
        </View>
        <View style={styles.noteCard}>
          <View style={styles.noteMascot}><Image source={require("../../../../assets/home-hero-mascot.png")} resizeMode="contain" style={styles.noteMascotImage} /></View>
          <View><Text style={styles.noteText}>This might take a moment...</Text><Text style={styles.noteText}>Good things are worth the wait!</Text></View>
        </View>
        {error ? <Pressable onPress={() => { running.current = false; void saveTrip(); }} style={styles.retry}><Text style={styles.retryText}>Try again</Text></Pressable> : null}
      </View>
      <View pointerEvents="none" style={styles.wave}><Svg width="100%" height="100%" viewBox="0 0 402 100" preserveAspectRatio="none"><Path d="M0 35C64 12 97 5 154 37s85 43 133 17 78-23 115-9v55H0Z" fill="#F3EAFB"/><Path d="M0 64c63-2 103 20 161 17s91-25 139-18 62 20 102 17v20H0Z" fill="#EBDDFA"/></Svg></View>
      {busy && <View style={styles.progress}><ActivityIndicator size="small" color={tripColors.purple} /></View>}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#FBF9FC" },
  content: { flex: 1, alignItems: "center", paddingHorizontal: 30, paddingTop: 5, paddingBottom: 98 },
  art: { width: 280, height: 218, alignItems: "center", justifyContent: "center" },
  mascot: { width: 280, height: 218 },
  title: { color: tripColors.dark, fontFamily: "Fredoka", fontSize: 26, fontWeight: "700", textAlign: "center", marginTop: 2 },
  subtitle: { color: "#817391", fontFamily: "Inter", fontSize: 13, textAlign: "center", marginTop: 7 },
  tasks: { width: "100%", maxWidth: 330, marginTop: 17 },
  task: { minHeight: 39, flexDirection: "row", alignItems: "center", gap: 12 },
  taskText: { color: "#8A7C99", fontFamily: "Inter", fontSize: 13 },
  taskDone: { color: "#71617F" },
  taskActive: { color: tripColors.dark, fontWeight: "700" },
  taskMuted: { color: "#BBAFC8" },
  noteCard: { width: "100%", maxWidth: 330, minHeight: 68, borderRadius: 18, borderWidth: 1, borderColor: "#EADFF3", backgroundColor: "white", marginTop: 17, paddingHorizontal: 15, flexDirection: "row", alignItems: "center", gap: 12 },
  noteMascot: { width: 37, height: 37, borderRadius: 19, borderWidth: 1, borderStyle: "dashed", borderColor: "#CBAAE9", alignItems: "center", justifyContent: "center" },
  noteMascotImage: { width: 29, height: 29 },
  noteText: { color: "#897A98", fontFamily: "Inter", fontSize: 10, lineHeight: 17 },
  retry: { marginTop: 15, paddingVertical: 11, paddingHorizontal: 23, borderRadius: 22, backgroundColor: tripColors.purple },
  retryText: { color: "white", fontFamily: "Inter", fontWeight: "700", fontSize: 13 },
  wave: { position: "absolute", left: 0, right: 0, bottom: 0, height: 100 },
  progress: { position: "absolute", width: 1, height: 1, opacity: 0 },
});
