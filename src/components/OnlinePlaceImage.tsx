import { useEffect, useState } from "react";
import { Image, Linking, Pressable, Text, View, type ImageSourcePropType, type StyleProp, type ViewStyle } from "react-native";
import { MapPin } from "lucide-react-native";
type Photo = { url: string; source: string; credit: string };
const cache = new Map<string, Promise<Photo | null>>();
export function loadOnlinePhoto(title: string): Promise<Photo | null> {
 const key = title.trim(); if (!key) return Promise.resolve(null);
 const cached = cache.get(key); if (cached) return cached;
 const pending = (async () => {
  const query = new URLSearchParams({ action: "query", format: "json", origin: "*", redirects: "1", prop: "pageimages", piprop: "name", titles: key });
  const response = await fetch("https://en.wikipedia.org/w/api.php?" + query, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error("Photo unavailable");
  const data = await response.json();
  const page = Object.values(data.query?.pages ?? {})[0] as { pageimage?: string } | undefined;
  if (!page?.pageimage) return null;
  const imageQuery = new URLSearchParams({ action: "query", format: "json", origin: "*", prop: "imageinfo", iiprop: "url|extmetadata", iiurlwidth: "640", titles: "File:" + page.pageimage });
  const result = await fetch("https://commons.wikimedia.org/w/api.php?" + imageQuery, { signal: AbortSignal.timeout(8000) });
  if (!result.ok) throw new Error("Photo unavailable");
  const images = await result.json();
  const file = Object.values(images.query?.pages ?? {})[0] as { imageinfo?: Array<{ thumburl?: string; url?: string; descriptionurl?: string; extmetadata?: Record<string, { value: string }> }> } | undefined;
  const info = file?.imageinfo?.[0], url = info?.thumburl ?? info?.url, license = info?.extmetadata?.LicenseShortName?.value;
  if (!url?.startsWith("https://upload.wikimedia.org/") || !info?.descriptionurl?.startsWith("https://commons.wikimedia.org/") || !license) return null;
  const artist = (info.extmetadata?.Artist?.value ?? "Wikimedia Commons").replace(/<[^>]*>/g, "");
  return { url, source: info.descriptionurl, credit: artist + " ? " + license };
 })().catch(() => { cache.delete(key); return null; });
 cache.set(key, pending); return pending;
}
export default function OnlinePlaceImage({ title, source, fallback, style }: { title: string; source?: ImageSourcePropType; fallback?: ImageSourcePropType; style: StyleProp<ViewStyle> }) {
 const [photo, setPhoto] = useState<Photo | null>(null), [failed, setFailed] = useState(false);
 useEffect(() => { let active = true; setPhoto(null); setFailed(false); if (!source) void loadOnlinePhoto(title).then((result) => { if (active) setPhoto(result); }); return () => { active = false; }; }, [title, source]);
 const image = failed ? fallback : source ?? (photo ? { uri: photo.url } : fallback);
 return <View style={[{ backgroundColor: "#F1E8FC", overflow: "hidden" }, style]}>
 {image ? <Image source={image} resizeMode="cover" onError={() => setFailed(true)} style={{ width: "100%", height: "100%" }} /> : <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><MapPin size={28} color="#8050C5" /></View>}
 {photo && !source && !failed && <Pressable accessibilityRole="link" accessibilityLabel={"Photo credits: " + photo.credit} onPress={() => { void Linking.openURL(photo.source).catch(() => {}); }} style={{ position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "#0009", padding: 3 }}><Text numberOfLines={1} style={{ color: "white", fontSize: 8 }}>{photo.credit}</Text></Pressable>}
 </View>;
}
