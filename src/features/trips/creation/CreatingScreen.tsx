import { useCallback, useEffect, useRef, useState } from "react";
import { router } from "expo-router";
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { ArrowLeft, Check, Circle } from "lucide-react-native";
import Svg, { Path } from "react-native-svg";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/features/auth/useAuth";
import { getSupabase } from "@/lib/supabase";
import { errorMessage } from "@/lib/errors";
import { validateTrip } from "@/features/trips/model";
import { tripColors } from "./CreationUI";
import { useTripCreation } from "./TripCreationContext";

const tasks = ["Finding the best destinations", "Checking weather & crowd levels", "Planning your itinerary", "Finalizing your trip"];

export default function CreatingScreen() {
  const { user } = useAuth();
  const { data, update } = useTripCreation();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  const running = useRef(false);
  const completed = useRef(false);

  const saveTrip = useCallback(async () => {
    if (running.current || completed.current) return;
    running.current = true;
    setBusy(true); setError("");
    try {
      if (!user) throw new Error("Please sign in again before creating a trip.");
      const title = data.title.trim() || (data.destination ? `Trip to ${data.destination.trim()}` : "");
      const validation = validateTrip(title, data.startDate.trim(), data.endDate.trim());
      if (validation) throw new Error(validation);
      if (!data.destination.trim()) throw new Error("Add a destination before creating your trip.");
      const { data: created, error: failure } = await getSupabase().from("trips").insert({
        owner_id: user.id,
        title,
        destination: data.destination.trim(),
        start_date: data.startDate.trim() || null,
        end_date: data.endDate.trim() || null,
      }).select("id").single();
      if (failure) throw failure;
      completed.current = true;
      update({ title, tripId: created.id });
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
      <View style={styles.header}><Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back" style={styles.back}><ArrowLeft size={21} color={tripColors.dark} /></Pressable></View>
      <View style={styles.content}>
        <View style={styles.art}><Image source={require("../../../../assets/figma-creating-mascot.png")} resizeMode="contain" style={styles.mascot} /></View>
        <Text style={styles.title}>{error ? "We couldn't save your trip" : "Creating Your Trip..."}</Text>
        <Text style={styles.subtitle}>{error || "Our AI is crafting the perfect itinerary just for you!"}</Text>
        <View style={styles.tasks}>
          {tasks.map((task, index) => <View key={task} style={styles.task}>
            {error ? <Circle size={18} color="#D7C9E3" /> : index === 0 && busy ? <Check size={18} color="white" fill={tripColors.purple} /> : index === 1 && busy ? <Check size={18} color="white" fill={tripColors.purple} /> : index === 2 && busy ? <ActivityIndicator size="small" color={tripColors.purple} /> : <Circle size={18} color="#D7C9E3" fill="#EEE7F6" />}
            <Text style={[styles.taskText, index < 2 && styles.taskDone, index === 2 && busy && styles.taskActive, error && styles.taskMuted]}>{task}</Text>
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
  header: { height: 47, paddingHorizontal: 24, justifyContent: "center" },
  back: { width: 36, height: 36, justifyContent: "center" },
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
