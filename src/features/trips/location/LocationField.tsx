import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { invokeAssistantFunction } from "../../live-assistant/services/api";
import LocationPinPicker from "./LocationPinPicker";
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
  const [manual, setManual] = useState(false);
  const [center, setCenter] = useState<{ latitude: number; longitude: number } | null>(null);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setResults([]); setError(""); setSearched(false); setLoading(false);
    if (selection || text.trim().length < 2 || manual) return;
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
  }, [text, selection, tripId, retry, manual]);
  return <View style={{ gap: 8 }}>
    <TextInput accessibilityLabel="Activity location search" value={text}
      onChangeText={(value) => { setManual(false); onTextChange(value); }}
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
    {searched && !loading && !error && !results.length && <Text style={{ color: "#89789D" }}>No matches. Try a more specific name or drop a pin.</Text>}
    {results.map((place) => <Pressable key={place.providerId} accessibilityRole="button"
      onPress={() => onSelect(place)} style={{ padding: 12, borderRadius: 12, backgroundColor: "#F5F0FB", gap: 4 }}>
      <Text style={{ color: "#37134F", fontWeight: "700" }}>{place.name}</Text>
      <Text style={{ color: "#89789D", fontSize: 12 }}>{place.address}</Text>
    </Pressable>)}
    {!!results.length && <Text style={{ color: "#89789D", fontSize: 10 }}>Location search powered by Geoapify</Text>}
    <Pressable accessibilityRole="button" onPress={() => {
      setCenter(selection ?? results[0] ?? null); setManual((value) => !value);
    }}><Text style={{ color: "#8050C5", fontWeight: "700", paddingVertical: 8 }}>{manual ? "Close pin picker" : "Drop a pin on the map"}</Text></Pressable>
    {manual && <>
      <Text style={{ color: "#89789D", fontSize: 12 }}>Move and zoom the map, then tap the activity's exact location.</Text>
      <View style={{ height: 260, overflow: "hidden", borderRadius: 12 }}>
        <LocationPinPicker
          places={selection ? [{ id: selection.providerId || "pin", name: selection.name,
            latitude: selection.latitude, longitude: selection.longitude, area: selection.address,
            description: "", tags: [] }] : []}
          selectedPlaceId={selection?.providerId || "pin"} center={center} onSelectPlace={() => {}}
          onSelectCoordinate={(point) => onSelect({
            provider: "manual", providerId: "pin:" + point.latitude.toFixed(6) + "," + point.longitude.toFixed(6),
            name: text.trim() || "Pinned location", address: text.trim() || "Pinned location",
            ...point, categories: [],
          })}
        />
      </View>
    </>}
  </View>;
}
