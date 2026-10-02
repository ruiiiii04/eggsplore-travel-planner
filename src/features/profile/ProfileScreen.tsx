import { useState } from "react";
import { Image, Text, View, Switch } from "react-native";
import { router } from "expo-router";
import {
  Bell,
  ChevronRight,
  UserRound,
  Pencil,
  Plus,
} from "lucide-react-native";
import {
  Screen,
  Heading,
  SectionTitle,
  Button,
  BottomSheet,
  Field,
  Message,
  Card,
} from "@/components/ui";
import { useAuth } from "@/features/auth/useAuth";
import { getSupabase } from "@/lib/supabase";
import { errorMessage } from "@/lib/errors";
import { useProfile } from "./useProfile";
import { updateProfile } from "./service";
type Sheet =
  | "edit"
  | "password"
  | "contacts"
  | "destination"
  | "settings"
  | "notifications"
  | "logout"
  | null;
const titles = {
  edit: "Edit Profile",
  password: "Change Password",
  contacts: "Emergency Contact",
  destination: "Destination Information",
  settings: "App Settings",
  notifications: "Notifications",
  logout: "Log Out",
};
function Row({
  title,
  onPress,
  disabled,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Button
      variant="ghost"
      className="justify-between border-b border-line rounded-none px-0"
      onPress={onPress}
      disabled={disabled}
    >
      <Text className="text-base text-ink flex-1">{title}</Text>
      <ChevronRight size={20} color="#7E49C2" />
    </Button>
  );
}
export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const {
    profile,
    setProfile,
    loading,
    error: loadError,
    retry,
  } = useProfile();
  const [sheet, setSheet] = useState<Sheet>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [notifications, setNotifications] = useState(true);
  const [units, setUnits] = useState<"metric" | "imperial">("metric");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [brokenAvatar, setBrokenAvatar] = useState<string | null>(null);
  function open(next: Sheet) {
    setError("");
    setNotice("");
    setForm({
      name: profile?.display_name ?? "",
      avatar: profile?.avatar_url ?? "",
      current: "",
      password: "",
      confirm: "",
      contact: profile?.emergency_contact.name ?? "",
      phone: profile?.emergency_contact.phone ?? "",
      relationship: profile?.emergency_contact.relationship ?? "",
      notes: profile?.emergency_contact.destinationNotes ?? "",
    });
    setNotifications(profile?.preferences.settings?.notifications ?? true);
    setUnits(profile?.preferences.settings?.units ?? "metric");
    setSheet(next);
  }
  function close() {
    if (!busy) {
      setSheet(null);
      setForm({});
      setError("");
    }
  }
  async function save() {
    if (busy || !user) return;
    setBusy(true);
    setError("");
    try {
      if (sheet === "logout") {
        await signOut();
        return;
      }
      if (sheet === "password") {
        if (
          !form.current ||
          (form.password?.length ?? 0) < 8 ||
          form.password !== form.confirm
        )
          throw new Error(
            "Enter your current password and matching new passwords of at least 8 characters.",
          );
        const client = getSupabase();
        const { error: reauthError } = await client.auth.signInWithPassword({
          email: user.email!,
          password: form.current,
        });
        if (reauthError) throw reauthError;
        const { error: failure } = await client.auth.updateUser({
          password: form.password,
        });
        if (failure) throw failure;
      } else {
        if (sheet === "edit" && !form.name.trim())
          throw new Error("Enter your name.");
        if (
          sheet === "edit" &&
          form.avatar.trim() &&
          !/^https:\/\//i.test(form.avatar.trim())
        )
          throw new Error("Use an HTTPS image URL.");
        const updated = await updateProfile(user.id, (current) => {
          if (sheet === "edit")
            return {
              display_name: form.name.trim(),
              avatar_url: form.avatar.trim() || null,
            };
          if (sheet === "contacts")
            return {
              emergency_contact: {
                ...current.emergency_contact,
                name: form.contact.trim(),
                phone: form.phone.trim(),
                relationship: form.relationship.trim(),
              },
            };
          if (sheet === "destination")
            return {
              emergency_contact: {
                ...current.emergency_contact,
                destinationNotes: form.notes.trim(),
              },
            };
          return {
            preferences: {
              ...current.preferences,
              settings: {
                ...current.preferences.settings,
                notifications,
                units,
              },
            },
          };
        });
        setProfile(updated);
      }
      setForm({});
      setSheet(null);
      setNotice("Saved successfully.");
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }
  const field = (key: string, label: string, secure = false) => (
    <Field
      key={key}
      label={label}
      value={form[key] ?? ""}
      onChangeText={(value) =>
        setForm((previous) => ({ ...previous, [key]: value }))
      }
      editable={!busy}
      secureTextEntry={secure}
      autoCapitalize={secure || key === "avatar" ? "none" : "sentences"}
      autoCorrect={!secure && key !== "avatar"}
      keyboardType={key === "phone" ? "phone-pad" : "default"}
      multiline={key === "notes"}
    />
  );
  const unavailable = !profile || loading || busy;
  return (
    <Screen>
      <View className="flex-row items-center justify-between gap-3">
        <Heading>EGGSPLORE</Heading>
        <Button
          variant="ghost"
          accessibilityLabel="Notifications"
          onPress={() => open("notifications")}
        >
          <Bell color="#7E49C2" size={22} />
        </Button>
      </View>
      <View className="flex-row items-center gap-4">
        {profile?.avatar_url && brokenAvatar !== profile.avatar_url ? (
          <Image
            source={{ uri: profile.avatar_url }}
            accessibilityLabel="Profile photo"
            onError={() => setBrokenAvatar(profile.avatar_url)}
            style={{ width: 64, height: 64, borderRadius: 32 }}
          />
        ) : (
          <UserRound size={54} color="#817493" />
        )}
        <View className="flex-1 gap-1">
          <Text className="text-lg font-bold text-ink">
            {profile?.display_name || user?.email?.split("@")[0] || "Traveller"}
          </Text>
          <Text className="text-sm text-muted">{user?.email}</Text>
          <Text className="text-sm text-brand">Explorer</Text>
        </View>
        <Button
          variant="ghost"
          accessibilityLabel="Edit profile"
          disabled={unavailable}
          onPress={() => open("edit")}
        >
          <Pencil size={20} color="#7E49C2" />
        </Button>
      </View>
      {loading && <Message>Loading profile...</Message>}
      <Message error>{loadError || (!sheet && error)}</Message>
      {!!loadError && (
        <Button variant="secondary" onPress={retry}>
          Retry loading profile
        </Button>
      )}
      <Message>{notice}</Message>
      <View>
        <SectionTitle>Account</SectionTitle>
        <Row
          title="Edit Profile"
          disabled={unavailable}
          onPress={() => open("edit")}
        />
        <Row title="Change Password" onPress={() => open("password")} />
        <Row title="Log Out" onPress={() => open("logout")} />
      </View>
      <SectionTitle>My Preference Profiles</SectionTitle>
      {(profile?.preferences.profiles ?? []).map((item) => (
        <Card key={item.id}>
          <View className="flex-row items-center gap-3">
            <Text className="text-3xl">{item.emoji}</Text>
            <View className="flex-1 gap-1">
              <Text className="text-base font-bold text-ink">{item.name}</Text>
              <Text className="text-sm text-muted">
                {item.tags.join(" / ")}
              </Text>
            </View>
            <Button
              variant="ghost"
              accessibilityLabel={`Edit ${item.name}`}
              onPress={() =>
                router.push({
                  pathname: "/profile/new",
                  params: { id: item.id },
                })
              }
            >
              <Pencil size={20} color="#7E49C2" />
            </Button>
          </View>
        </Card>
      ))}
      {profile && !profile.preferences.profiles?.length && (
        <Message>No saved preference profiles yet.</Message>
      )}
      <Button
        variant="secondary"
        disabled={unavailable}
        onPress={() => router.push("/profile/new")}
      >
        <Plus size={18} color="#7E49C2" />
        <Text className="text-brand font-semibold">Create New Profile</Text>
      </Button>
      <View>
        <SectionTitle>Emergency &amp; Destination Info</SectionTitle>
        <Row
          title="Emergency Contacts"
          disabled={unavailable}
          onPress={() => open("contacts")}
        />
        <Row
          title="Destination Information"
          disabled={unavailable}
          onPress={() => open("destination")}
        />
      </View>
      <View>
        <SectionTitle>Preferences</SectionTitle>
        <Row
          title="App Settings"
          disabled={unavailable}
          onPress={() => open("settings")}
        />
      </View>
      <BottomSheet
        visible={sheet !== null}
        title={sheet ? titles[sheet] : ""}
        onClose={close}
        busy={busy}
      >
        {sheet === "edit" && (
          <>
            {field("name", "Display name")}
            {field("avatar", "Avatar image URL (HTTPS)")}
          </>
        )}
        {sheet === "password" && (
          <>
            {field("current", "Current password", true)}
            {field("password", "New password", true)}
            {field("confirm", "Confirm new password", true)}
          </>
        )}
        {sheet === "contacts" && (
          <>
            {field("contact", "Contact name")}
            {field("phone", "Phone number")}
            {field("relationship", "Relationship")}
          </>
        )}
        {sheet === "destination" && field("notes", "Destination notes")}
        {sheet === "settings" && (
          <>
            <View className="flex-row items-center justify-between gap-3">
              <Text className="flex-1 text-ink">Notification preference</Text>
              <Switch
                accessibilityLabel="Notification preference"
                value={notifications}
                onValueChange={setNotifications}
                disabled={busy}
                trackColor={{ true: "#7E49C2" }}
              />
            </View>
            <Message>
              Saved for future notifications. Push delivery is not connected
              yet.
            </Message>
            <SectionTitle>Distance units</SectionTitle>
            <View className="flex-row gap-2">
              {(["metric", "imperial"] as const).map((value) => (
                <Button
                  key={value}
                  variant={units === value ? "primary" : "secondary"}
                  disabled={busy}
                  onPress={() => setUnits(value)}
                >
                  {value === "metric" ? "Kilometres" : "Miles"}
                </Button>
              ))}
            </View>
          </>
        )}
        {sheet === "notifications" && (
          <Message>
            No notifications yet. Live alerts are planned for Modules C and D.
          </Message>
        )}
        {sheet === "logout" && (
          <Message>Log out of Eggsplore on this device?</Message>
        )}
        <Message error>{error}</Message>
        {sheet !== "notifications" && (
          <Button
            busy={busy}
            variant={sheet === "logout" ? "danger" : "primary"}
            onPress={() => void save()}
          >
            {sheet === "logout" ? "Log out" : "Save changes"}
          </Button>
        )}
      </BottomSheet>
    </Screen>
  );
}
