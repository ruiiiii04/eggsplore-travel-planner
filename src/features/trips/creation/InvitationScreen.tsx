import { useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { Copy, Link2, QrCode, Search, Share2, UserRoundPlus, X } from "lucide-react-native";
import { Button } from "@/components/ui";
import { TitleBlock, tripColors, WizardFrame } from "./CreationUI";
import { useTripCreation } from "./TripCreationContext";

export default function InvitationScreen() {
  const { data, update } = useTripCreation();
  const [email, setEmail] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [error, setError] = useState("");

  function addInvitee() {
    const clean = email.trim();
    if (!clean) return;
    if (!/^\S+@\S+\.\S+$/.test(clean)) { setError("Enter a valid email address."); return; }
    if (data.invitees.includes(clean)) { setError("This email is already on your list."); return; }
    if (data.invitees.length >= 5) { setError("You can add up to 5 people."); return; }
    update({ invitees: [...data.invitees, clean] });
    setEmail(""); setError(""); setShowAdd(false);
  }

  return (
    <WizardFrame step={4} footer={<Button className="min-h-[54px] rounded-full" onPress={() => router.push("/trips/create/creating")}>Create Trip</Button>}>
      <View style={{ marginTop: 14 }}><TitleBlock title="Invite your travel buddies" subtitle="Add members to your trip. You can invite via link, QR code or username." /></View>
      <View style={styles.linkCard}>
        <View style={styles.cardHeading}><View style={styles.roundIcon}><Link2 size={15} color={tripColors.purple} /></View><Text style={styles.cardTitle}>Invite Link</Text></View>
        <View style={styles.linkBox}><Text numberOfLines={1} style={styles.linkText}>Create your trip to get an invite link</Text><Copy size={17} color="#8050C5" /></View>
        <Pressable onPress={() => Alert.alert("Invite link", "A shareable link will be available after trip invitations are connected.")} style={styles.shareButton} accessibilityRole="button"><Share2 size={16} color="white" /><Text style={styles.shareText}>Share Link</Text></Pressable>
      </View>

      <View style={styles.quickActions}>
        <Pressable onPress={() => Alert.alert("QR Code", "A QR code will be available after trip invitations are connected.")} style={styles.actionCard}>
          <View style={styles.actionIcon}><QrCode size={19} color={tripColors.purple} /></View><View style={styles.actionCopy}><Text style={styles.actionTitle}>QR Code</Text><Text style={styles.actionSubtitle}>Tap to show QR code</Text></View>
        </Pressable>
        <Pressable onPress={() => { setShowAdd(true); setError(""); }} style={styles.actionCard}>
          <View style={styles.actionIcon}><UserRoundPlus size={18} color={tripColors.purple} /></View><View style={styles.actionCopy}><Text style={styles.actionTitle}>Add by Username</Text><Text style={styles.actionSubtitle}>Search friends</Text></View>
        </Pressable>
      </View>

      <Text style={styles.memberHeading}>Invited Members ({data.invitees.length}/5)</Text>
      <View style={styles.memberCard}>
        {data.invitees.length === 0 && !showAdd && <Text style={styles.emptyText}>Your trip members will show up here.</Text>}
        {data.invitees.map((address, index) => <View key={address} style={[styles.memberRow, index > 0 && styles.memberDivider]}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{address.slice(0, 1).toUpperCase()}</Text></View>
          <View style={styles.memberCopy}><Text numberOfLines={1} style={styles.memberName}>{address.split("@")[0]}</Text><Text numberOfLines={1} style={styles.memberEmail}>{address}</Text></View>
          <Pressable onPress={() => update({ invitees: data.invitees.filter((item) => item !== address) })} accessibilityRole="button" accessibilityLabel={`Remove ${address}`} style={styles.remove}><X size={16} color="#9485A3" /></Pressable>
        </View>)}
        {showAdd && <View style={styles.addRow}><View style={styles.emailInputWrap}><Search size={15} color="#89779B" /><TextInput value={email} onChangeText={(value) => { setEmail(value); setError(""); }} placeholder="Email address" placeholderTextColor="#A398AE" autoCapitalize="none" keyboardType="email-address" style={styles.emailInput} onSubmitEditing={addInvitee} /></View><Pressable onPress={addInvitee} accessibilityRole="button" style={styles.addButton}><Text style={styles.addButtonText}>Add</Text></Pressable></View>}
        {!!error && <Text style={styles.error}>{error}</Text>}
        <Pressable onPress={() => { setShowAdd((value) => !value); setError(""); }} style={styles.addMore}><UserRoundPlus size={16} color="#8C79A0" /><Text style={styles.addMoreText}>Add More Members</Text></Pressable>
      </View>
    </WizardFrame>
  );
}

const styles = {
  linkCard: { backgroundColor: "white", borderRadius: 19, borderWidth: 1, borderColor: "#ECE3F3", padding: 15, gap: 10 },
  cardHeading: { flexDirection: "row" as const, alignItems: "center" as const, gap: 9 },
  roundIcon: { width: 29, height: 29, borderRadius: 15, backgroundColor: "#F1EAF8", alignItems: "center" as const, justifyContent: "center" as const },
  cardTitle: { color: "#321553", fontFamily: "Fredoka", fontSize: 17 },
  linkBox: { minHeight: 42, borderRadius: 12, backgroundColor: "#F7F2FB", borderWidth: 1, borderColor: "#E8DDF3", paddingHorizontal: 11, flexDirection: "row" as const, alignItems: "center" as const, gap: 8 },
  linkText: { flex: 1, color: "#4E3A62", fontFamily: "Inter", fontSize: 11, fontWeight: "600" as const },
  shareButton: { minHeight: 43, borderRadius: 24, backgroundColor: "#8050C5", flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "center" as const, gap: 8 },
  shareText: { color: "white", fontFamily: "Inter", fontSize: 14, fontWeight: "700" as const },
  quickActions: { flexDirection: "row" as const, gap: 11 },
  actionCard: { flex: 1, minHeight: 75, borderRadius: 16, borderWidth: 1, borderColor: "#ECE3F3", backgroundColor: "white", flexDirection: "row" as const, alignItems: "center" as const, paddingHorizontal: 10, gap: 8 },
  actionIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: "#F1EAF8", alignItems: "center" as const, justifyContent: "center" as const },
  actionCopy: { flex: 1 },
  actionTitle: { color: "#321553", fontFamily: "Inter", fontSize: 11, fontWeight: "700" as const },
  actionSubtitle: { color: "#8A7A9B", fontFamily: "Inter", fontSize: 9, marginTop: 2 },
  memberHeading: { color: "#321553", fontFamily: "Inter", fontSize: 13, fontWeight: "700" as const, marginBottom: -6 },
  memberCard: { backgroundColor: "white", borderRadius: 19, borderWidth: 1, borderColor: "#ECE3F3", paddingHorizontal: 15, paddingVertical: 8 },
  emptyText: { color: "#89799A", fontFamily: "Inter", fontSize: 11, paddingVertical: 12 },
  memberRow: { minHeight: 58, flexDirection: "row" as const, alignItems: "center" as const, gap: 9 },
  memberDivider: { borderTopWidth: 1, borderTopColor: "#F0EAF5" },
  avatar: { width: 34, height: 34, borderRadius: 18, backgroundColor: "#EEE5F8", alignItems: "center" as const, justifyContent: "center" as const },
  avatarText: { color: "#7850B1", fontFamily: "Inter", fontSize: 13, fontWeight: "700" as const },
  memberCopy: { flex: 1, gap: 2 },
  memberName: { color: "#321553", fontFamily: "Inter", fontSize: 12, fontWeight: "700" as const },
  memberEmail: { color: "#88799A", fontFamily: "Inter", fontSize: 10 },
  remove: { padding: 7 },
  addRow: { flexDirection: "row" as const, alignItems: "center" as const, gap: 8, paddingTop: 8 },
  emailInputWrap: { flex: 1, minHeight: 40, borderWidth: 1, borderColor: "#E7DDF0", borderRadius: 12, flexDirection: "row" as const, alignItems: "center" as const, paddingHorizontal: 10, gap: 7 },
  emailInput: { flex: 1, paddingVertical: 8, color: "#321553", fontFamily: "Inter", fontSize: 11 },
  addButton: { backgroundColor: "#8050C5", paddingHorizontal: 15, height: 39, borderRadius: 11, alignItems: "center" as const, justifyContent: "center" as const },
  addButtonText: { color: "white", fontFamily: "Inter", fontWeight: "700" as const, fontSize: 11 },
  error: { color: "#B42318", fontFamily: "Inter", fontSize: 10, marginTop: 5 },
  addMore: { height: 43, borderRadius: 12, borderWidth: 1, borderStyle: "dashed" as const, borderColor: "#DDCDED", flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "center" as const, gap: 8, marginTop: 5 },
  addMoreText: { color: "#87769A", fontFamily: "Inter", fontSize: 12 },
};
