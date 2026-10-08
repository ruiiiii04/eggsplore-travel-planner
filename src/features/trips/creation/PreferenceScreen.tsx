import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";
import Svg, { Circle, Ellipse, Path, Rect } from "react-native-svg";
import { CreationActionButton, TitleBlock, tripColors, WizardFrame } from "./CreationUI";
import { useTripCreation } from "./TripCreationContext";

const templates = [
  { name: "Beach Trip", line: "Sun • Sea • Relax", art: "beach" },
  { name: "Backpacking Mode", line: "Adventure • Nature • Budget", art: "mountain" },
  { name: "City Explorer", line: "Culture • Food • Sightseeing", art: "city" },
  { name: "Foodie Adventure", line: "Local Food • Street Food", art: "food" },
  { name: "Nature Retreat", line: "Hiking • Nature • Wellness", art: "nature" },
  { name: "Luxury Getaway", line: "Comfort • Premium • Relax", art: "boat" },
];

export default function PreferenceScreen() {
  const { data, update } = useTripCreation();
  const nextPath = data.tripType === "group" ? "/trips/create/invite" : "/trips/create/creating";
  const custom = data.preference === "Custom";
  return (
    <WizardFrame step={3} tripType={data.tripType} footer={<CreationActionButton onPress={() => router.push(nextPath)}>Next</CreationActionButton>}>
      <View style={{ marginTop: 30, marginBottom: -9 }}><TitleBlock title="Choose a preference template" subtitle="Pick a style that matches your travel vibe\n(or skip and set it up later)" /></View>
      <View style={{ marginBottom: -3 }}><View style={styles.segment}>
        {["Templates", "Custom"].map((tab) => <Pressable key={tab} onPress={() => update({ preference: tab === "Custom" ? "Custom" : "Beach Trip" })} style={[styles.segmentButton, custom === (tab === "Custom") && styles.segmentActive]}><Text style={[styles.segmentText, custom !== (tab === "Custom") && styles.segmentInactive]}>{tab}</Text></Pressable>)}
      </View></View>
      {custom ? (
        <View style={styles.customPanel}>
          <Text style={styles.customTitle}>Make it your own</Text>
          {templates.map(({ name }) => {
            const selected = data.customPreferences.includes(name);
            return <Pressable key={name} onPress={() => update({ customPreferences: selected ? data.customPreferences.filter((item) => item !== name) : [...data.customPreferences, name] })} style={styles.customRow}><Text style={styles.customName}>{name}</Text><View style={[styles.checkbox, selected && styles.checkboxSelected]}>{selected && <Text style={styles.checkboxCheck}>✓</Text>}</View></Pressable>;
          })}
        </View>
      ) : (
        <View style={styles.grid}>
          {templates.map(({ name, line, art }) => {
            const selected = data.preference === name;
            return <Pressable key={name} onPress={() => update({ preference: selected ? "" : name })} accessibilityRole="button" accessibilityState={{ selected }} style={[styles.template, selected && styles.templateSelected]}>
              <View style={styles.artSlot}><PreferenceArtwork kind={art} /></View>
              <Text style={styles.templateTitle}>{name}</Text><Text numberOfLines={1} style={styles.templateLine}>{line}</Text>
              {selected && <View style={styles.selectedMark}><Text style={styles.selectedCheck}>✓</Text></View>}
            </Pressable>;
          })}
        </View>
      )}
      <Pressable onPress={() => { update({ preference: "" }); router.push(nextPath); }} style={styles.skip}><Text style={styles.skipText}>Skip preferences</Text></Pressable>
    </WizardFrame>
  );
}

function PreferenceArtwork({ kind }: { kind: string }) {
  return <Svg width={76} height={58} viewBox="0 0 76 58">
    <Ellipse cx="38" cy="36" rx="34" ry="17" fill={kind === "food" ? "#FFE5AE" : "#F0E8FB"} />
    {kind === "beach" && <><Circle cx="52" cy="15" r="9" fill="#FBC349" /><Path d="M31 41V24M31 26C20 18 18 16 18 12c8 1 13 4 15 10M31 25c1-8 7-12 14-14-1 7-6 12-14 15M31 27c-7-4-12-3-17 1 4 5 10 5 17 3" stroke="#31A56D" strokeWidth="3" strokeLinecap="round" /><Path d="M8 45c13-5 24 5 39 0 8-3 13-2 20 0" stroke="#57B9DC" strokeWidth="3" strokeLinecap="round" /></>}
    {kind === "mountain" && <><Path d="M11 44 32 13l15 21 8-11 15 21H11Z" fill="#9165D1" /><Path d="m25 23 7-10 9 13-6-3-4 4Z" fill="#D9C6F5" /><Path d="m47 29 8-6 10 15H48Z" fill="#C5A8EB" /></>}
    {kind === "city" && <><Rect x="13" y="27" width="14" height="20" rx="2" fill="#A47BDE" /><Rect x="29" y="18" width="17" height="29" rx="2" fill="#8656CB" /><Rect x="48" y="26" width="15" height="21" rx="2" fill="#B895E8" /><Path d="M37 18V8" stroke="#8656CB" strokeWidth="2" /><Path d="M19 32v3m0 4v3m15-18v3m7-3v3m-7 5v3m7-3v3m11-3v3m7-3v3" stroke="white" strokeWidth="1.5" /></>}
    {kind === "food" && <><Path d="M18 31c0 10 9 17 20 17s20-7 20-17H18Z" fill="#F8C344" /><Path d="M18 31c4 5 11 4 15 1s10-5 14-1 8 4 11 0" stroke="#EF8A37" strokeWidth="3" strokeLinecap="round" /><Circle cx="28" cy="28" r="4" fill="#56A96A" /><Path d="M47 12 61 26M42 16l15 15" stroke="#B84E58" strokeWidth="2.5" strokeLinecap="round" /></>}
    {kind === "nature" && <><Path d="m7 45 18-28 16 28H7ZM34 45l18-31 19 31H34Z" fill="#54AB77" /><Path d="m18 28 7-11 8 14-7-4-4 4Z" fill="white" /><Path d="m44 28 8-14 9 15-7-4-4 4Z" fill="#BEE7CB" /><Rect x="22" y="36" width="3" height="10" fill="#8A674B" /><Rect x="49" y="36" width="3" height="10" fill="#8A674B" /></>}
    {kind === "boat" && <><Circle cx="38" cy="14" r="8" fill="#FFB84C" /><Path d="M17 35h44l-8 10H26l-9-10Z" fill="#55B5D9" /><Path d="M38 18v16M36 20 25 32h11V20Zm4 0 12 12H40V20Z" fill="#F17C78" /><Path d="M10 48c8-4 14 4 22 0s14 4 22 0 9 1 12 1" stroke="#58B6DA" strokeWidth="2.5" fill="none" /></>}
  </Svg>;
}

const styles = {
  segment: { flexDirection: "row" as const, backgroundColor: "#F1EAF8", padding: 3, borderRadius: 22 },
  segmentButton: { flex: 1, height: 36, alignItems: "center" as const, justifyContent: "center" as const, borderRadius: 20 },
  segmentActive: { backgroundColor: "#8050C5", boxShadow: "0 2px 4px rgba(60, 25, 80, 0.18)", elevation: 2 },
  segmentText: { color: "white", fontFamily: "Inter", fontSize: 12, fontWeight: "700" as const },
  segmentInactive: { color: "#857695" },
  grid: { flexDirection: "row" as const, flexWrap: "wrap" as const, justifyContent: "space-between" as const, rowGap: 11 },
  template: { width: "48%" as const, height: 145, borderRadius: 18, borderWidth: 1, borderColor: "#EAE1F2", backgroundColor: "white", paddingHorizontal: 11, paddingTop: 7, paddingBottom: 12, justifyContent: "flex-end" as const, position: "relative" as const },
  templateSelected: { backgroundColor: "#F7F1FC", borderColor: "#C9A9EC" },
  artSlot: { height: 74, alignItems: "center" as const, justifyContent: "center" as const, marginBottom: 5 },
  templateTitle: { color: "#321553", fontFamily: "Fredoka", fontSize: 14, fontWeight: "700" as const, marginBottom: 3 },
  templateLine: { color: "#8B7C9A", fontFamily: "Inter", fontSize: 10 },
  selectedMark: { position: "absolute" as const, right: 9, top: 9, width: 20, height: 20, borderRadius: 11, backgroundColor: "#8050C5", alignItems: "center" as const, justifyContent: "center" as const },
  selectedCheck: { color: "white", fontFamily: "Inter", fontSize: 12, fontWeight: "700" as const },
  skip: { alignSelf: "center" as const, paddingVertical: 6 },
  skipText: { color: tripColors.muted, fontFamily: "Inter", fontSize: 11 },
  customPanel: { backgroundColor: "white", borderRadius: 18, borderWidth: 1, borderColor: "#EAE1F2", padding: 14 },
  customTitle: { color: "#321553", fontFamily: "Fredoka", fontSize: 17, marginBottom: 9 },
  customRow: { minHeight: 42, flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const, borderTopWidth: 1, borderTopColor: "#F2EDF6" },
  customName: { color: "#5D4B70", fontFamily: "Inter", fontSize: 12 },
  checkbox: { width: 19, height: 19, borderRadius: 6, borderWidth: 1, borderColor: "#C9B8D9", alignItems: "center" as const, justifyContent: "center" as const },
  checkboxSelected: { backgroundColor: "#8050C5", borderColor: "#8050C5" },
  checkboxCheck: { color: "white", fontFamily: "Inter", fontSize: 12, fontWeight: "700" as const },
};
