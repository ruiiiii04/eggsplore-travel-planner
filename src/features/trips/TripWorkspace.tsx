import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Image, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ArrowLeft, Bell, CalendarDays, Check, ChevronDown, ChevronRight, Circle, Cloud, Luggage, Map, MapPin, MoreHorizontal, Pencil, Plane, Plus, SquareCheckBig, ThumbsDown, ThumbsUp, TrainFront, Umbrella, Utensils, UsersRound, Wallet } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getSupabase } from "@/lib/supabase";
import { errorMessage } from "@/lib/errors";
import type { Trip } from "./model";
import { useTrips } from "./useTrips";
import { rememberTrip } from "./recentTrip";

type ScreenMode = "trip" | "itinerary" | "notes" | "candidates";
type ItineraryItem = { id: string; title: string; description: string | null; location_name: string | null; start_time: string | null; position: number };
type Candidate = { id: string; name: string; location: string; tags: string[]; votes: number; crowd: string; image: any; confirmed?: boolean; ai?: boolean };
const ink = "#37134F", purple = "#8050C5", muted = "#89789D", line = "#EEE7F5", pale = "#F5F0FB";
const seededCandidates: Candidate[] = [
  { id: "uluwatu", name: "Uluwatu Temple", location: "Bali, Indonesia", tags: ["Culture", "Nature", "Sightseeing"], votes: 8, crowd: "Low Crowd", image: require("../../../assets/trip-bali-cover.png"), confirmed: true },
  { id: "nusa-dua", name: "Nusa Dua Beach", location: "Bali, Indonesia", tags: ["Beach", "Relax", "Water Sports"], votes: 6, crowd: "Medium Crowd", image: require("../../../assets/trip-bali-cover.png") },
  { id: "batur", name: "Mount Batur Sunrise Trek", location: "Bali, Indonesia", tags: ["Adventure", "Nature", "Hiking"], votes: 5, crowd: "High Crowd", image: require("../../../assets/trip-japan-cover.png") },
  { id: "tegenungan", name: "Tegenungan Waterfall", location: "Bali, Indonesia", tags: ["Nature", "Photo Spot", "Relax"], votes: 4, crowd: "Low Crowd", image: require("../../../assets/trip-bali-cover.png"), ai: true },
  { id: "seminyak", name: "Seminyak Beach Club", location: "Bali, Indonesia", tags: ["Food", "Nightlife", "Beach"], votes: 3, crowd: "Medium Crowd", image: require("../../../assets/trip-japan-cover.png") },
  { id: "ulun-danu", name: "Ulun Danu Beratan Temple", location: "Bali, Indonesia", tags: ["Culture", "Nature", "Photography"], votes: 2, crowd: "Low Crowd", image: require("../../../assets/trip-bali-cover.png") },
];

export default function TripWorkspace({ mode }: { mode: ScreenMode }) {
  const { id = "" } = useLocalSearchParams<{ id: string }>();
  const [activeMode, setActiveMode] = useState<ScreenMode>(mode);
  const scrollRef = useRef<ScrollView>(null);
  const { trips: allTrips } = useTrips();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [items, setItems] = useState<ItineraryItem[]>([]);
  const [notes, setNotes] = useState("");
  const [noteItems, setNoteItems] = useState<{id:string; title:string; detail:string; done?:boolean}[]>([]);
  const [candidates, setCandidates] = useState(seededCandidates);
  const [votes, setVotes] = useState<Record<string, "up" | "down">>({});
  const [filter, setFilter] = useState("All");
  const [error, setError] = useState("");
  const [newCandidate, setNewCandidate] = useState("");
  const [adding, setAdding] = useState(false);
  const [expandedDays, setExpandedDays] = useState(true);
  const notesKey = `eggsplore:trip-notes:${id}`;
  const votesKey = `eggsplore:trip-votes:${id}`;
  const candidatesKey = `eggsplore:trip-candidates:${id}`;

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const { data, error: failure } = await getSupabase().from("trips").select("*").eq("id", id).single();
        if (failure) throw failure;
        if (active) setTrip(data as Trip);
        const { data: rows, error: itemFailure } = await getSupabase().from("itinerary_items").select("id,title,description,location_name,start_time,position").eq("trip_id", id).order("position", { ascending: true });
        if (itemFailure) throw itemFailure;
        if (active) setItems((rows ?? []) as ItineraryItem[]);
      } catch (cause) { if (active) setError(errorMessage(cause)); }
      const [savedNotes, savedVotes, savedCandidates, savedNoteText] = await Promise.all([AsyncStorage.getItem(notesKey), AsyncStorage.getItem(votesKey), AsyncStorage.getItem(candidatesKey), AsyncStorage.getItem(`${notesKey}:text`)]);
      if (!active) return;
      if (savedNotes !== null) {
        try { const parsed = JSON.parse(savedNotes); if (Array.isArray(parsed)) setNoteItems(parsed); else setNotes(savedNotes); }
        catch { setNotes(savedNotes); }
      }
      if (savedNoteText !== null) setNotes(savedNoteText);
      if (savedVotes) setVotes(JSON.parse(savedVotes));
      if (savedCandidates) setCandidates(JSON.parse(savedCandidates));
    })();
    return () => { active = false; };
  }, [id]);

  useEffect(() => { void rememberTrip(id); }, [id]);
  useEffect(() => {
    setActiveMode(mode);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [id, mode]);

  const dateRange = useMemo(() => formatRange(trip?.start_date, trip?.end_date), [trip?.start_date, trip?.end_date]);
  const destination = trip?.destination || "Destination to be decided";
  const title = trip?.title || destination;
  const go = (next: ScreenMode) => {
    setActiveMode(next);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  };
  const saveNotes = (value: string) => { setNotes(value); void AsyncStorage.setItem(`${notesKey}:text`, value); };
  const saveNoteItems = (value: typeof noteItems) => { setNoteItems(value); void AsyncStorage.setItem(notesKey, JSON.stringify(value)); };
  const vote = (candidateId: string, value: "up" | "down") => {
    const next = { ...votes, [candidateId]: votes[candidateId] === value ? undefined : value } as Record<string, "up" | "down">;
    setVotes(next); void AsyncStorage.setItem(votesKey, JSON.stringify(next));
  };
  const addCandidate = () => {
    const name = newCandidate.trim(); if (!name) return;
    const next = [{ id: `${Date.now()}`, name, location: destination, tags: ["New"], votes: 0, crowd: "Crowd unknown", image: seededCandidates[0].image }, ...candidates];
    setCandidates(next); setNewCandidate(""); setAdding(false); void AsyncStorage.setItem(candidatesKey, JSON.stringify(next));
  };

  return <SafeAreaView edges={["top", "left", "right"]} style={{ flex: 1, width: "100%", maxWidth: 402, alignSelf: "center", backgroundColor: "#FBF9FD" }}>
    <ScrollView ref={scrollRef} contentContainerStyle={{ paddingBottom: 18 }} showsVerticalScrollIndicator={false}>
      <WorkspaceHeader title={title} destination={destination} dateRange={dateRange} id={id} trips={allTrips} active={activeMode === "candidates" ? "candidates" : "itinerary"} go={go} />
      {activeMode === "trip" && <TripOverview destination={destination} dateRange={dateRange} itemsCount={items.length} openItinerary={() => go("itinerary")} openCandidates={() => go("candidates")} />}
      {activeMode === "itinerary" && <ItineraryContent items={items} destination={destination} expanded={expandedDays} toggle={() => setExpandedDays((v) => !v)} notes={() => go("notes")} />}
      {activeMode === "notes" && <NotesContent items={noteItems} value={notes} onChange={saveNotes} onItemsChange={saveNoteItems} destination={destination} openItinerary={() => go("itinerary")} />}
      {activeMode === "candidates" && <CandidateContent candidates={candidates} votes={votes} filter={filter} setFilter={setFilter} vote={vote} adding={adding} setAdding={setAdding} newCandidate={newCandidate} setNewCandidate={setNewCandidate} addCandidate={addCandidate} onViewResults={() => go("itinerary")} />}
      {!!error && <Text style={{ color: "#B43F60", paddingHorizontal: 20, marginTop: 8 }}>{error}</Text>}
    </ScrollView>
  </SafeAreaView>;
}

function WorkspaceHeader({ title, destination, dateRange, id, trips, active, go }: { title: string; destination: string; dateRange: string; id: string; trips: Trip[]; active: "itinerary" | "candidates"; go: (mode: ScreenMode) => void }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const cover = /japan|tokyo|kyoto|osaka|hokkaido/i.test(`${destination} ${title}`) ? require("../../../assets/trip-japan-cover.png") : require("../../../assets/trip-bali-cover.png");
  const selectTrip = (tripId: string) => {
    void rememberTrip(tripId);
    setPickerOpen(false);
    router.replace({ pathname: "/trips/[id]/itinerary", params: { id: tripId } });
  };
  return <View style={{ paddingHorizontal: 20, paddingTop: 4 }}>
    <View style={{ height: 54, flexDirection: "row", alignItems: "center" }}><Pressable onPress={() => router.canGoBack() ? router.back() : router.replace("/(tabs)/home")} style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}><ArrowLeft size={23} color={ink} /></Pressable><Text style={{ marginLeft: 8, fontFamily: "Fredoka", fontSize: 21, color: "#3B1454", fontWeight: "700" }}>EGGSPLORE</Text><View style={{ flex: 1 }} /><View style={{ flexDirection: "row", gap: 8 }}><Pressable accessibilityRole="button" accessibilityLabel="Notifications" style={iconButton}><Bell size={24} color={purple} /><View style={notificationDot} /></Pressable><Pressable accessibilityRole="button" accessibilityLabel="More options" style={iconButton}><MoreHorizontal size={24} color={purple} /></Pressable></View></View>
    <Pressable accessibilityRole="button" accessibilityLabel="Switch trip" onPress={() => setPickerOpen((v) => !v)} style={{ flexDirection: "row", alignItems: "center", backgroundColor: pale, borderRadius: 22, borderWidth: 1, borderColor: line, padding: 10, gap: 11, marginTop: 4 }}><Image source={cover} style={{ width: 66, height: 62, borderRadius: 14 }} /><View style={{ flex: 1, gap: 4 }}><View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}><Text numberOfLines={1} style={{ color: ink, fontFamily: "Fredoka", fontSize: 17, fontWeight: "700", flexShrink: 1 }}>{title}</Text><Text style={{ color: purple, backgroundColor: "#E9DFFA", paddingHorizontal: 7, paddingVertical: 3, borderRadius: 12, fontSize: 9 }}>✓ Planning</Text></View><View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}><UsersRound size={13} color={muted} /><Text style={{ color: muted, fontSize: 10 }}>Travel group</Text></View><View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}><CalendarDays size={13} color={muted} /><Text numberOfLines={1} style={{ color: muted, fontSize: 10, flexShrink: 1 }}>{dateRange}</Text><MapPin size={13} color={muted} /><Text numberOfLines={1} style={{ color: muted, fontSize: 10, flex: 1 }}>{destination}</Text></View></View><ChevronDown size={19} color={purple} style={{ transform: [{ rotate: pickerOpen ? "180deg" : "0deg" }] }} /></Pressable>
    {pickerOpen && <View style={{ backgroundColor: "white", borderWidth: 1, borderColor: line, borderRadius: 16, padding: 5, marginTop: 6 }}>{trips.filter((trip) => trip.id !== id).map((trip) => <Pressable key={trip.id} onPress={() => selectTrip(trip.id)} style={{ padding: 11, borderRadius: 12, flexDirection: "row", alignItems: "center", gap: 8 }}><View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: pale, alignItems: "center", justifyContent: "center" }}><MapPin size={16} color={purple} /></View><View style={{ flex: 1 }}><Text numberOfLines={1} style={{ color: ink, fontWeight: "700", fontSize: 12 }}>{trip.title}</Text><Text numberOfLines={1} style={{ color: muted, fontSize: 10, marginTop: 2 }}>{trip.destination || "Destination to be decided"}</Text></View><ChevronRight size={16} color={muted} /></Pressable>)}{!trips.length && <Text style={{ color: muted, padding: 12, fontSize: 11 }}>Loading your trips…</Text>}</View>}
    <MainTabs active={active} go={go} />
  </View>;
}
function MainTabs({ active, go }: { active: "itinerary" | "candidates"; go: (mode: ScreenMode) => void }) {
  return <View style={{ flexDirection: "row", marginTop: 20, padding: 4, borderRadius: 28, backgroundColor: pale, borderWidth: 1, borderColor: line }}>{([["itinerary", "Itinerary", Plane], ["candidates", "Vote", UsersRound], ["budget", "Budget", Wallet]] as const).map(([key, label, Icon]) => <Pressable key={key} onPress={() => key !== "budget" && go(key)} style={{ flex: 1, minHeight: 44, borderRadius: 24, backgroundColor: active === key ? purple : "transparent", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }}><Icon size={17} color={active === key ? "white" : muted} /><Text numberOfLines={1} style={{ color: active === key ? "white" : muted, fontSize: 11, fontWeight: "600" }}>{label}</Text></Pressable>)}</View>;
}
function TripOverview({ destination, dateRange, itemsCount, openItinerary, openCandidates }: { destination: string; dateRange: string; itemsCount: number; openItinerary: () => void; openCandidates: () => void }) {
  return <View style={{ paddingHorizontal: 20, paddingTop: 20 }}>
    <View style={{ borderRadius: 22, backgroundColor: pale, padding: 18, borderWidth: 1, borderColor: line }}><Text style={{ fontFamily: "Fredoka", fontSize: 22, color: ink, fontWeight: "700" }}>Your trip at a glance</Text><Text style={{ color: muted, marginTop: 3 }}>{destination} · {dateRange}</Text><View style={{ flexDirection: "row", gap: 10, marginTop: 17 }}><Stat icon={<CalendarDays size={18} color={purple} />} label="Dates" value={dateRange} /><Stat icon={<MapPin size={18} color={purple} />} label="Destination" value={destination} /></View></View>
    <Text style={sectionTitle}>Your trip workspace</Text>
    <WorkspaceCard icon={<Plane size={20} color={purple} />} title="Itinerary" subtitle={itemsCount ? `${itemsCount} planned activities` : "Plan the places you want to visit"} action="Open itinerary" onPress={openItinerary} />
    <WorkspaceCard icon={<UsersRound size={20} color={purple} />} title="Candidates & Vote" subtitle="Collect ideas and decide together" action="Explore places" onPress={openCandidates} />
    <View style={{ marginTop: 16, backgroundColor: "white", borderRadius: 20, borderWidth: 1, borderColor: line, padding: 18 }}><Text style={{ fontFamily: "Fredoka", color: ink, fontSize: 18 }}>A little note for your group</Text><Text style={{ color: muted, lineHeight: 20, marginTop: 6 }}>Save the plan as you go. Your itinerary and notes will be ready whenever you open this trip.</Text></View>
  </View>;
}
function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) { return <View style={{ flex: 1, backgroundColor: "white", borderRadius: 15, padding: 12 }}><View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>{icon}<Text style={{ color: muted, fontSize: 11 }}>{label}</Text></View><Text numberOfLines={1} style={{ color: ink, fontWeight: "700", fontSize: 12, marginTop: 8 }}>{value}</Text></View>; }
function WorkspaceCard({ icon, title, subtitle, action, onPress }: { icon: React.ReactNode; title: string; subtitle: string; action: string; onPress: () => void }) { return <Pressable onPress={onPress} style={{ padding: 16, backgroundColor: "white", borderWidth: 1, borderColor: line, borderRadius: 18, marginTop: 10, flexDirection: "row", alignItems: "center", gap: 12 }}><View style={{ width: 44, height: 44, borderRadius: 15, backgroundColor: pale, alignItems: "center", justifyContent: "center" }}>{icon}</View><View style={{ flex: 1 }}><Text style={{ color: ink, fontSize: 16, fontWeight: "700" }}>{title}</Text><Text style={{ color: muted, fontSize: 12, marginTop: 3 }}>{subtitle}</Text></View><View style={{ alignItems: "flex-end" }}><ChevronRight size={18} color={purple} /><Text style={{ color: purple, fontSize: 10, marginTop: 5 }}>{action}</Text></View></Pressable>; }
function ItineraryContent({ items, destination, expanded, toggle, notes }: { items: ItineraryItem[]; destination: string; expanded: boolean; toggle: () => void; notes: () => void }) {
  return <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
    <View style={{ borderRadius: 20, backgroundColor: pale, padding: 15, flexDirection: "row", alignItems: "center", marginBottom: 14 }}><View style={{ flex: 1 }}><Text style={{ color: purple, fontSize: 11, fontWeight: "700" }}>✈  Planning</Text><Text style={{ color: ink, fontFamily: "Fredoka", fontSize: 16, fontWeight: "700", marginTop: 6 }}>{items.length ? "Your itinerary is ready" : "Start planning your itinerary"}</Text><Text style={{ color: muted, fontSize: 11, marginTop: 4 }}>Reorder, edit or add your own stops.</Text></View><Image source={require("../../../assets/figma-welcome-mascot.png")} resizeMode="contain" style={{ width: 74, height: 72 }} /><Pressable onPress={notes} style={{ borderWidth: 1, borderColor: "#DCCCEC", borderRadius: 22, paddingHorizontal: 12, paddingVertical: 9, flexDirection: "row", gap: 5 }}><Pencil size={14} color={purple} /><Text style={{ color: purple, fontWeight: "700", fontSize: 11 }}>Edit</Text></Pressable></View>
    <View style={{ flexDirection: "row", backgroundColor: pale, borderRadius: 25, padding: 4, marginBottom: 15 }}><View style={{ flex: 1, borderRadius: 22, backgroundColor: purple, alignItems: "center", justifyContent: "center", minHeight: 42 }}><Text style={{ color: "white", fontWeight: "700", fontSize: 12 }}>Full Itinerary</Text></View><Pressable onPress={notes} style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><Text style={{ color: muted, fontWeight: "600", fontSize: 12 }}>My Notes</Text></Pressable></View>
    <Pressable onPress={toggle} style={{ backgroundColor: "white", borderRadius: 22, borderWidth: 1, borderColor: line, padding: 16 }}><View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}><View style={{ width: 58, height: 58, borderRadius: 30, backgroundColor: "#A879D6", alignItems: "center", justifyContent: "center" }}><Text style={{ color: "white", fontSize: 11 }}>Day</Text><Text style={{ color: "white", fontFamily: "Fredoka", fontWeight: "700", fontSize: 22 }}>1</Text></View><View style={{ flex: 1 }}><Text style={{ color: muted, fontSize: 11 }}>{items[0]?.start_time ? prettyDay(items[0].start_time) : "Add your travel dates"}  ·  Day one</Text><Text numberOfLines={1} style={{ color: ink, fontFamily: "Fredoka", fontWeight: "700", fontSize: 17, marginTop: 5 }}>{items[0]?.location_name || destination}</Text></View><ChevronDown size={17} color={purple} /></View>
      {expanded && <View style={{ marginTop: 15, borderTopWidth: 1, borderTopColor: line, paddingTop: 6 }}>{items.length ? items.map((item, index) => <ActivityRow key={item.id} item={item} index={index} />) : <View style={{ alignItems: "center", paddingVertical: 28 }}><View style={{ width: 58, height: 58, borderRadius: 30, backgroundColor: pale, alignItems: "center", justifyContent: "center" }}><Map size={25} color={purple} /></View><Text style={{ color: ink, fontWeight: "700", marginTop: 12 }}>No activities yet</Text><Text style={{ color: muted, fontSize: 12, textAlign: "center", marginTop: 5 }}>Add itinerary stops to see your day plan here.</Text></View>}</View>}
      <Pressable onPress={notes} style={{ borderRadius: 15, borderWidth: 1, borderStyle: "dashed", borderColor: "#D9C9E9", padding: 12, flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12 }}><Plus size={17} color={purple} /><Text style={{ color: purple, fontWeight: "700" }}>Add activity</Text></Pressable>
    </Pressable>
  </View>;
}
function ActivityRow({ item, index }: { item: ItineraryItem; index: number }) { const Icon = index % 3 === 0 ? Plane : index % 3 === 1 ? TrainFront : Utensils; return <View style={{ flexDirection: "row", alignItems: "center", minHeight: 72, borderBottomWidth: 1, borderBottomColor: line, gap: 10 }}><View style={{ width: 50, alignItems: "center" }}><View style={{ width: 12, height: 12, borderRadius: 7, backgroundColor: purple }} /></View><Text style={{ width: 52, color: muted, fontSize: 12 }}>{item.start_time ? new Date(item.start_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--:--"}</Text><View style={{ width: 42, height: 42, borderRadius: 24, backgroundColor: pale, alignItems: "center", justifyContent: "center" }}><Icon size={19} color={purple} /></View><View style={{ flex: 1 }}><Text numberOfLines={1} style={{ color: ink, fontWeight: "700", fontSize: 13 }}>{item.title}</Text><Text numberOfLines={1} style={{ color: muted, fontSize: 11, marginTop: 4 }}>{item.location_name || item.description || "Activity"}</Text></View><ChevronRight size={17} color="#B7A6CA" /></View>; }
function NotesContent({ items, value, onChange, onItemsChange, destination, openItinerary }: { items: {id:string;title:string;detail:string;done?:boolean}[]; value: string; onChange: (value: string) => void; onItemsChange: (items: {id:string;title:string;detail:string;done?:boolean}[]) => void; destination: string; openItinerary: () => void }) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const defaults = [{id:"rain",title:"Bring a raincoat for Day 3",detail:"Day 3  ·  Kawaguchiko",done:false,icon:"umbrella"},{id:"car",title:"Return the rental car with a full tank",detail:"Day 5  ·  Tokyo",done:false,icon:"bag"},{id:"matcha",title:"Try the matcha latte at % Arabica",detail:"General note",done:false,icon:"thought"},{id:"souvenir",title:"Buy souvenirs near Nakamise Street",detail:"Day 2  ·  Tokyo",done:false,icon:"bag"},{id:"view",title:"Can’t wait for the view at Kawaguchiko!",detail:"Personal thought",icon:"thought"}];
  const list = items.length ? items : defaults;
  const add = () => { if (!draft.trim()) return; onItemsChange([...list,{id:String(Date.now()),title:draft.trim(),detail:"General note"}]); setDraft(""); setAdding(false); };
  return <View style={{ paddingHorizontal: 20, paddingTop: 16 }}><View style={{ backgroundColor: "#F3ECFC", borderColor: line, borderWidth: 1, borderRadius: 20, padding: 14, flexDirection: "row", alignItems: "center", marginBottom: 14 }}><Pencil size={21} color={purple}/><View style={{ flex: 1, marginLeft: 10 }}><Text style={{ color: purple, fontWeight: "700", fontSize: 12 }}>Your private notes</Text><Text style={{ color: ink, fontWeight: "700", marginTop: 4 }}>Keep personal reminders in one place</Text><Text style={{ color: muted, fontSize: 11, marginTop: 4 }}>Only you can see these notes.</Text></View><Image source={require("../../../assets/figma-welcome-mascot.png")} resizeMode="contain" style={{ width: 54, height: 62 }}/></View>
  <View style={{ flexDirection: "row", backgroundColor: pale, borderRadius: 25, padding: 4, marginBottom: 14 }}><Pressable onPress={openItinerary} style={{ flex: 1, alignItems: "center", justifyContent: "center", minHeight: 42 }}><Text style={{ color: muted, fontWeight: "600", fontSize: 12 }}>Full Itinerary</Text></Pressable><View style={{ flex: 1, borderRadius: 22, backgroundColor: purple, alignItems: "center", justifyContent: "center" }}><Text style={{ color: "white", fontWeight: "700", fontSize: 12 }}>My Notes</Text></View></View>
  <Text style={{ color: muted, fontWeight: "600", fontSize: 12, marginBottom: 12 }}>Only visible to you — not shared with the group</Text>
  {list.map((note:any) => { const Icon = note.icon === "umbrella" ? Umbrella : note.icon === "bag" ? Luggage : Cloud; return <Pressable key={note.id} onPress={() => onItemsChange(list.map((n:any) => n.id === note.id ? {...n,done:!n.done} : n))} style={{ minHeight: 82, backgroundColor: "white", borderRadius: 17, borderWidth: 1, borderColor: line, padding: 12, marginBottom: 10, flexDirection: "row", alignItems: "center", gap: 12 }}><View style={{ width: 32, alignItems: "center" }}>{note.detail !== "Personal thought" ? (note.done ? <SquareCheckBig size={22} color={purple}/> : <Circle size={22} color="#D9C9E9"/>) : null}</View><View style={{ width: 52, height: 52, borderRadius: 28, backgroundColor: "#F1E8FC", alignItems: "center", justifyContent: "center" }}><Icon size={24} color={ink}/></View><View style={{ flex: 1 }}><Text style={{ color: ink, fontWeight: "700", fontSize: 14 }}>{note.title}</Text><Text style={{ color: muted, fontSize: 11, marginTop: 6 }}>{note.detail}</Text></View><ChevronRight size={19} color="#A58AC5"/></Pressable>; })}
  {adding && <View style={{ flexDirection:"row", gap:8, marginBottom:10 }}><TextInput value={draft} onChangeText={setDraft} placeholder="Write a personal note" style={{flex:1,backgroundColor:"white",borderRadius:14,borderWidth:1,borderColor:line,padding:12,color:ink}}/><Pressable onPress={add} style={{backgroundColor:purple,borderRadius:14,justifyContent:"center",paddingHorizontal:16}}><Text style={{color:"white",fontWeight:"700"}}>Add</Text></Pressable></View>}
  <Pressable onPress={() => setAdding(true)} style={{ borderRadius: 15, borderWidth: 1, borderStyle: "dashed", borderColor: "#D9C9E9", padding: 16, flexDirection: "row", alignItems: "center", justifyContent:"center", gap: 8, marginTop: 4 }}><Plus size={19} color={purple} /><Text style={{ color: purple, fontWeight: "700" }}>Add Note</Text></Pressable>
  {!!value && <TextInput value={value} onChangeText={onChange} placeholder="Additional private note" style={{marginTop:12,backgroundColor:"white",borderColor:line,borderWidth:1,borderRadius:14,padding:12,color:ink}}/>}</View>;
}
function CandidateContent({ candidates, votes, filter, setFilter, vote, adding, setAdding, newCandidate, setNewCandidate, addCandidate, onViewResults }: { candidates: Candidate[]; votes: Record<string, "up" | "down">; filter: string; setFilter: (value: string) => void; vote: (id: string, value: "up" | "down") => void; adding: boolean; setAdding: (value: boolean) => void; newCandidate: string; setNewCandidate: (value: string) => void; addCandidate: () => void; onViewResults: () => void }) {
  const visible = candidates.filter((item) => filter === "All" || (filter === "Shortlist" ? votes[item.id] === "up" : !!votes[item.id]));
  return <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 14 }}>{["All", "Shortlist", "Voted"].map((name) => <Pressable key={name} onPress={() => setFilter(name)} style={{ paddingHorizontal: 10, paddingVertical: 9, borderRadius: 23, backgroundColor: filter === name ? purple : "#FBF9FD", borderWidth: 1, borderColor: filter === name ? purple : line }}><Text style={{ color: filter === name ? "white" : muted, fontSize: 10, fontWeight: "600" }}>{name} ({name === "All" ? candidates.length : name === "Shortlist" ? Object.values(votes).filter((v) => v === "up").length : Object.keys(votes).length})</Text></Pressable>)}<Pressable onPress={() => setAdding(!adding)} style={{ marginLeft: "auto", flexDirection: "row", alignItems: "center", borderRadius: 22, backgroundColor: "#F0E8FA", paddingHorizontal: 9, paddingVertical: 9, gap: 4 }}><Plus size={15} color={purple} /><Text style={{ color: purple, fontSize: 10, fontWeight: "700" }}>Add</Text></Pressable></View>
    {adding && <View style={{ flexDirection: "row", backgroundColor: "white", borderRadius: 16, borderWidth: 1, borderColor: line, padding: 8, marginBottom: 14, gap: 8 }}><TextInput value={newCandidate} onChangeText={setNewCandidate} placeholder="Place or activity name" style={{ flex: 1, color: ink, paddingHorizontal: 8 }} /><Pressable onPress={addCandidate} style={{ backgroundColor: purple, borderRadius: 12, paddingHorizontal: 14, justifyContent: "center" }}><Text style={{ color: "white", fontWeight: "700" }}>Add</Text></Pressable></View>}
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}><View><Text style={sectionTitle}>Candidate Pool</Text><Text style={{ color: muted, fontSize: 11, marginTop: 2 }}>Explore, vote and decide together!</Text></View><Pressable style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "white", borderRadius: 18, paddingHorizontal: 10, paddingVertical: 9, borderWidth: 1, borderColor: line }}><ChevronDown size={14} color={purple} /><Text style={{ color: purple, fontSize: 10, fontWeight: "600" }}>Popularity</Text></Pressable></View>
    <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 11 }}>{visible.map((item) => <CandidateCard key={item.id} candidate={item} vote={votes[item.id]} onVote={vote} />)}</View>
    <View style={{ backgroundColor: pale, borderRadius: 20, padding: 15, marginTop: 16, flexDirection: "row", alignItems: "center", gap: 10 }}><Image source={require("../../../assets/figma-welcome-mascot.png")} resizeMode="contain" style={{ width: 50, height: 62 }} /><View style={{ flex: 1 }}><Text style={{ color: ink, fontWeight: "700", fontSize: 13 }}>Almost there!</Text><Text style={{ color: muted, fontSize: 10, lineHeight: 15, marginTop: 3 }}>Vote for your favorite spots to help shape the itinerary.</Text></View><Pressable onPress={onViewResults} style={{ backgroundColor: purple, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 10 }}><Text style={{ color: "white", fontSize: 10, fontWeight: "700" }}>View Results  →</Text></Pressable></View>
    <Text style={{ color: muted, fontSize: 10, textAlign: "center", marginTop: 10 }}>Demo places and votes are saved on this device.</Text>
  </View>;
}
function CandidateCard({ candidate, vote, onVote }: { candidate: Candidate; vote?: "up" | "down"; onVote: (id: string, value: "up" | "down") => void }) {
  const total = candidate.votes + (vote ? 1 : 0);
  return <View style={{ width: "48.7%", overflow: "hidden", borderRadius: 15, backgroundColor: "white", borderWidth: 1, borderColor: line }}>
    <View style={{ height: 72 }}><Image source={candidate.image} resizeMode="cover" style={{ width: "100%", height: "100%" }} />{(candidate.confirmed || candidate.ai) && <View style={{ position: "absolute", top: 5, left: 5, backgroundColor: "#F5FFF9", borderRadius: 10, paddingHorizontal: 6, paddingVertical: 3, flexDirection: "row", alignItems: "center", gap: 2 }}><Check size={9} color="#34B69D" /><Text style={{ color: purple, fontSize: 7, fontWeight: "700" }}>{candidate.confirmed ? "Auto-confirmed" : "AI pick"}</Text></View>}<Pressable style={{ position: "absolute", top: 5, right: 5, borderRadius: 12, backgroundColor: "white", padding: 3 }}><MoreHorizontal size={13} color={purple} /></Pressable></View>
    <View style={{ padding: 7 }}><Text numberOfLines={1} style={{ color: ink, fontSize: 11, fontWeight: "700" }}>{candidate.name}</Text><View style={{ flexDirection: "row", alignItems: "center", marginTop: 3, gap: 3 }}><MapPin size={9} color={muted} /><Text numberOfLines={1} style={{ color: muted, fontSize: 8, flex: 1 }}>{candidate.location}</Text></View><View style={{ flexDirection: "row", gap: 3, marginTop: 5 }}>{candidate.tags.slice(0, 3).map((tag) => <Text key={tag} numberOfLines={1} style={{ flexShrink: 1, backgroundColor: pale, color: muted, borderRadius: 8, paddingHorizontal: 5, paddingVertical: 2, fontSize: 7 }}>{tag}</Text>)}</View><View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 5 }}><Text style={{ color: muted, fontSize: 8 }}>{total} votes</Text><Text style={{ color: candidate.crowd.includes("Low") ? "#41BCA2" : candidate.crowd.includes("High") ? "#EF7474" : "#D8A834", fontSize: 8 }}>{candidate.crowd}</Text></View><View style={{ flexDirection: "row", marginTop: 5, borderRadius: 9, overflow: "hidden", backgroundColor: pale }}><Pressable onPress={() => onVote(candidate.id, "up")} style={{ flex: 1, minHeight: 25, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 3, backgroundColor: vote === "up" ? "#E9DFFA" : "transparent" }}><ThumbsUp size={11} color={purple} /><Text style={{ color: purple, fontSize: 8, fontWeight: "700" }}>{vote === "up" ? "Voted" : `${Math.round((candidate.votes / Math.max(total, 1)) * 100)}%`}</Text></Pressable><Pressable onPress={() => onVote(candidate.id, "down")} style={{ flex: 1, minHeight: 25, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 3, backgroundColor: vote === "down" ? "#E9DFFA" : "transparent" }}><ThumbsDown size={11} color={muted} /><Text style={{ color: muted, fontSize: 8 }}>{Math.round(((total - candidate.votes) / Math.max(total, 1)) * 100)}%</Text></Pressable></View></View>
  </View>;
}
const iconButton = { width: 40, height: 40, alignItems: "center" as const, justifyContent: "center" as const, position: "relative" as const };
const notificationDot = { position: "absolute" as const, width: 8, height: 8, borderRadius: 4, top: 8, right: 8, backgroundColor: "#BD4C42", borderWidth: 1, borderColor: "#FBF9FD" };
const sectionTitle = { color: ink, fontFamily: "Fredoka", fontWeight: "700" as const, fontSize: 20 };
function formatRange(start?: string | null, end?: string | null) { if (!start && !end) return "Dates to be decided"; const f = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }); return `${start ? f(start) : "Flexible"}${end ? ` – ${f(end)}` : ""}`; }
function prettyDay(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? "Day one" : date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }); }
