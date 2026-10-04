import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { Search, UserRoundPlus, X } from "lucide-react-native";
import { getSupabase } from "@/lib/supabase";
import { CreationActionButton, TitleBlock, tripColors, WizardFrame } from "./CreationUI";
import { useTripCreation } from "./TripCreationContext";

type Match = { id: string; username: string; display_name: string | null; avatar_url: string | null };

export default function InvitationScreen() {
  const { data, update } = useTripCreation();
  const [query, setQuery] = useState("");
  const [match, setMatch] = useState<Match | null>(null);
  const [message, setMessage] = useState("");
  const [searching, setSearching] = useState(false);

  async function searchUser() {
    const username = query.trim().replace(/^@/, "").toLowerCase();
    if (!username) { setMessage("Enter a username to search."); return; }
    setSearching(true); setMessage(""); setMatch(null);
    const { data: result, error } = await getSupabase().rpc("find_trip_member_by_username", { search_username: username });
    setSearching(false);
    if (error) { setMessage("Could not search right now. Please try again."); return; }
    const found = Array.isArray(result) ? result[0] as Match | undefined : undefined;
    if (!found) { setMessage("No account found with that username."); return; }
    if (found.id === (await getSupabase().auth.getUser()).data.user?.id) { setMessage("You are already the trip owner."); return; }
    if (data.invitees.some((item) => item.id === found.id)) { setMessage("This person is already on your list."); return; }
    if (data.invitees.length >= 5) { setMessage("You can add up to five members."); return; }
    setMatch(found);
  }

  function addMember() {
    if (!match) return;
    update({ invitees: [...data.invitees, { id: match.id, username: match.username, displayName: match.display_name || match.username }] });
    setMatch(null); setQuery(""); setMessage("");
  }

  return (
    <WizardFrame step={4} tripType={data.tripType} footer={<CreationActionButton onPress={() => router.push("/trips/create/creating")}>Create Trip</CreationActionButton>}>
      <View style={{ marginTop: 14 }}><TitleBlock title="Invite your travel buddies" subtitle="Add people who already have an Eggsplore account by username. You can also invite them later from your trip." /></View>
      <View style={styles.searchCard}>
        <View style={styles.heading}><UserRoundPlus size={18} color={tripColors.purple} /><Text style={styles.title}>Add a member</Text></View>
        <View style={styles.searchRow}>
          <View style={styles.inputWrap}><Text style={styles.at}>@</Text><TextInput value={query} onChangeText={(value) => { setQuery(value); setMatch(null); setMessage(""); }} placeholder="Username" placeholderTextColor="#A398AE" autoCapitalize="none" autoCorrect={false} style={styles.input} onSubmitEditing={() => void searchUser()} /></View>
          <Pressable onPress={() => void searchUser()} disabled={searching} accessibilityRole="button" style={styles.searchButton}><Search size={17} color="white" /><Text style={styles.searchText}>{searching ? "..." : "Find"}</Text></Pressable>
        </View>
        {match && <View style={styles.matchRow}><View style={styles.avatar}><Text style={styles.avatarText}>{(match.display_name || match.username).slice(0, 1).toUpperCase()}</Text></View><View style={{ flex: 1 }}><Text style={styles.name}>{match.display_name || match.username}</Text><Text style={styles.username}>@{match.username}</Text></View><Pressable onPress={addMember} style={styles.addButton}><Text style={styles.addText}>Add</Text></Pressable></View>}
        {!!message && <Text style={styles.message}>{message}</Text>}
      </View>
      <Text style={styles.sectionTitle}>Trip members ({data.invitees.length}/5)</Text>
      <View style={styles.listCard}>
        {data.invitees.length === 0 ? <Text style={styles.empty}>Only you so far. Search by username to add someone.</Text> : data.invitees.map((person, index) => <View key={person.id} style={[styles.memberRow, index > 0 && styles.divider]}><View style={styles.avatar}><Text style={styles.avatarText}>{person.displayName.slice(0, 1).toUpperCase()}</Text></View><View style={{ flex: 1 }}><Text style={styles.name}>{person.displayName}</Text><Text style={styles.username}>@{person.username}</Text></View><Pressable onPress={() => update({ invitees: data.invitees.filter((item) => item.id !== person.id) })} accessibilityRole="button" accessibilityLabel={`Remove @${person.username}`} style={styles.remove}><X size={17} color="#87769A" /></Pressable></View>)}
      </View>
    </WizardFrame>
  );
}

const styles = {
  searchCard: { backgroundColor: "white", borderRadius: 18, borderWidth: 1, borderColor: "#ECE3F3", padding: 15, gap: 12 },
  heading: { flexDirection: "row" as const, alignItems: "center" as const, gap: 8 },
  title: { color: "#321553", fontFamily: "Fredoka", fontSize: 17 },
  searchRow: { flexDirection: "row" as const, gap: 8 },
  inputWrap: { flex: 1, height: 44, borderWidth: 1, borderColor: "#E7DDF0", borderRadius: 12, flexDirection: "row" as const, alignItems: "center" as const, paddingHorizontal: 11 },
  at: { color: "#8A79A0", fontFamily: "Inter", fontSize: 14 },
  input: { flex: 1, color: "#321553", fontFamily: "Inter", fontSize: 13, paddingVertical: 8 },
  searchButton: { minWidth: 75, height: 44, paddingHorizontal: 13, borderRadius: 12, backgroundColor: "#8050C5", flexDirection: "row" as const, justifyContent: "center" as const, alignItems: "center" as const, gap: 6 },
  searchText: { color: "white", fontFamily: "Inter", fontSize: 12, fontWeight: "700" as const },
  matchRow: { flexDirection: "row" as const, alignItems: "center" as const, gap: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#F0EAF5" },
  avatar: { width: 37, height: 37, borderRadius: 20, backgroundColor: "#EEE5F8", alignItems: "center" as const, justifyContent: "center" as const },
  avatarText: { color: "#7850B1", fontFamily: "Inter", fontSize: 14, fontWeight: "700" as const },
  name: { color: "#321553", fontFamily: "Inter", fontSize: 12, fontWeight: "700" as const },
  username: { color: "#88799A", fontFamily: "Inter", fontSize: 10, marginTop: 2 },
  addButton: { backgroundColor: "#F1EAF8", borderRadius: 18, paddingHorizontal: 16, paddingVertical: 9 },
  addText: { color: "#8050C5", fontFamily: "Inter", fontSize: 11, fontWeight: "700" as const },
  message: { color: "#8B789A", fontFamily: "Inter", fontSize: 11 },
  sectionTitle: { color: "#321553", fontFamily: "Inter", fontSize: 13, fontWeight: "700" as const, marginBottom: -6 },
  listCard: { backgroundColor: "white", borderRadius: 18, borderWidth: 1, borderColor: "#ECE3F3", paddingHorizontal: 14 },
  empty: { color: "#89799A", fontFamily: "Inter", fontSize: 11, lineHeight: 18, paddingVertical: 14 },
  memberRow: { minHeight: 60, flexDirection: "row" as const, alignItems: "center" as const, gap: 10 },
  divider: { borderTopWidth: 1, borderTopColor: "#F0EAF5" },
  remove: { padding: 8 },
};
