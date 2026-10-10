import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { invokeAssistantFunction } from "../../live-assistant/services/api";
import { parseLocation, type ActivityLocation } from "./model";

export default function LocationField({ tripId, text, selection, onTextChange, onSelect }: {
  tripId: string; text: string; selection: ActivityLocation | null;
  onTextChange: (text: string) => void; onSelect: (location: ActivityLocation) => void;
}) {
  const [results, setResults] = useState<ActivityLocation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setResults([]); setError(""); setSearched(false); setLoading(false);
    if (selection || text.trim().length < 2) return;
    const timer = setTimeout(() => {
      setLoading(true);
      void invokeAssistantFunction<{ places: unknown[] }>("location-search", { tripId, query: text.trim() }, controller.signal)
        .then((reply) => {
          if (active) setResults(reply.places.map(parseLocation).filter((value): value is ActivityLocation => value !== null));
        })
        .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "Search could not load."); })
        .finally(() => { if (active) { setLoading(false); setSearched(true); } });
    }, 400);
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, [text, selection, tripId, retry]);
  return <View style={{ gap: 8 }}>
    <TextInput accessibilityLabel="Activity location search" value={text}
      onChangeText={onTextChange}
      placeholder="Search for a place" maxLength={200}
      style={{ minHeight: 46, borderRadius: 13, borderWidth: 1, borderColor: "#EEE7F5", paddingHorizontal: 13, color: "#37134F", backgroundColor: "white" }} />
    {selection && <Text style={{ color: "#486D47", fontSize: 12 }}>
      Location selected: {selection.address || selection.name}
    </Text>}
    {loading && <ActivityIndicator color="#8050C5" />}
    {!!error && <View style={{ gap: 6 }}>
      <Text accessibilityRole="alert" style={{ color: "#B43F60" }}>{error}</Text>
      <Pressable accessibilityRole="button" onPress={() => setRetry((value) => value + 1)}><Text style={{ color: "#8050C5" }}>Retry search</Text></Pressable>
    </View>}
    {searched && !loading && !error && !results.length && <Text style={{ color: "#89789D" }}>No matches found. Try the full street address, the local-language name, or a specific landmark instead of a district.</Text>}
    {results.map((place) => <Pressable key={place.providerId} accessibilityRole="button"
      onPress={() => onSelect(place)} style={{ padding: 12, borderRadius: 12, backgroundColor: "#F5F0FB", gap: 4 }}>
      <Text style={{ color: "#37134F", fontWeight: "700" }}>{place.name}</Text>
      <Text style={{ color: "#89789D", fontSize: 12 }}>{place.address}</Text>
    </Pressable>)}
    {!!results.length && <Text style={{ color: "#89789D", fontSize: 10 }}>{results.some((place) => place.provider === "wikipedia") ? "Place matches from Wikipedia; confirm the correct location." : "Location search powered by Geoapify"}</Text>}
    {!selection && !!text.trim() && <Text style={{ color: "#89789D", fontSize: 12 }}>
      Select a matching result to add a map pin. You can also save this activity without a pin and find its location later.
    </Text>}
  </View>;
}