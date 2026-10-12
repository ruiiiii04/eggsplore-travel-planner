import { useState } from "react";
import { Image, Text, View, Switch } from "react-native";
import { router } from "expo-router";
import {
  Bell,
  ChevronRight,
  UserRound,
  Pencil,
  Plus,
  LockKeyhole,
  LogOut,
  Phone,
  Globe,
  Ruler,
  Sparkles,
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
import { NotificationBell } from "@/features/notifications/NotificationBell";
import { TravelStyleIcon } from "./TravelStyleIcon";

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
  subtitle,
  icon,
  onPress,
  disabled,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Button
      variant="ghost"
      className="min-h-[68px] justify-start gap-3 border-b border-[#F0EAF5] rounded-none px-1 py-2"
      onPress={onPress}
      disabled={disabled}
    >
      {icon && (
        <View className="h-10 w-10 items-center justify-center rounded-xl bg-lavender">
          {icon}
        </View>
      )}
      <View className="flex-1 gap-1">
        <Text
          style={{ fontFamily: "Inter" }}
          className="text-sm font-semibold text-ink"
        >
          {title}
        </Text>
        {!!subtitle && (
          <Text
            style={{ fontFamily: "Inter", fontSize: 11, color: "#89789D" }}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        )}
      </View>
      <ChevronRight size={20} color="#7E49C2" />
    </Button>
  );
}

function SectionHeader({
  title,
  subtitle,
  icon,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
}) {
  return (
    <View className="mb-1 flex-row items-center gap-3">
      <View className="h-10 w-10 items-center justify-center rounded-xl bg-lavender">
        {icon}
      </View>
      <View className="flex-1 gap-0.5">
        <SectionTitle>{title}</SectionTitle>
        <Text className="text-xs leading-5 text-muted">{subtitle}</Text>
      </View>
    </View>
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
        {/* <Button
          variant="ghost"
          accessibilityLabel="Notifications"
          onPress={() => open("notifications")}
        >
          <Bell color="#7E49C2" size={22} />
        </Button> */}
        <NotificationBell />
      </View>
      <View className="flex-row items-center gap-3 rounded-2xl border border-[#E8D9F5] bg-[#F5F0FB] p-4">
        <View className="h-[68px] w-[68px] items-center justify-center overflow-hidden rounded-2xl border border-white bg-white">
          {profile?.avatar_url && brokenAvatar !== profile.avatar_url ? (
            <Image
              source={{ uri: profile.avatar_url }}
              accessibilityLabel="Profile photo"
              onError={() => setBrokenAvatar(profile.avatar_url)}
              style={{ width: 68, height: 68 }}
            />
          ) : (
            <UserRound size={32} color="#8050C5" />
          )}
        </View>
        <View className="flex-1 gap-1">
          <Text
            style={{ fontFamily: "Inter" }}
            className="text-lg font-bold text-ink"
            numberOfLines={1}
          >
            {profile?.display_name || user?.email?.split("@")[0] || "Traveller"}
          </Text>
          <Text
            style={{ fontFamily: "Inter" }}
            className="text-xs text-muted"
            numberOfLines={1}
          >
            {user?.email}
          </Text>
          {!!profile?.username && (
            <Text
              style={{ fontFamily: "Inter" }}
              className="text-xs font-semibold text-brand"
              numberOfLines={1}
            >
              @{profile.username}
            </Text>
          )}
        </View>
        <Button
          variant="secondary"
          accessibilityLabel="Edit profile"
          disabled={unavailable}
          onPress={() => open("edit")}
          className="min-h-10 rounded-xl px-3 py-2"
        >
          <Pencil size={16} color="#7E49C2" />
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
      <View className="gap-1 rounded-2xl border border-[#EEE7F5] bg-white p-4">
        <SectionHeader
          title="Security & account"
          subtitle="Manage your sign-in details"
          icon={<UserRound size={19} color="#8050C5" />}
        />
        <Row
          title="Change Password"
          subtitle="Keep your account secure"
          icon={<LockKeyhole size={18} color="#7C4DBE" />}
          onPress={() => open("password")}
        />
        <Row
          title="Log Out"
          subtitle="Sign out from this device"
          icon={<LogOut size={18} color="#7C4DBE" />}
          onPress={() => open("logout")}
        />
      </View>
      <View className="gap-1 rounded-2xl border border-[#EEE7F5] bg-white p-4">
        <SectionHeader
          title="Travel preferences"
          subtitle="Save your travel styles for faster planning"
          icon={<Sparkles size={19} color="#8050C5" />}
        />
        {(profile?.preferences.profiles ?? []).map((item) => (
          <Card
            key={item.id}
            className="rounded-2xl border-[#EEE7F5] shadow-sm"
          >
            <View className="flex-row items-center gap-3">
              <View className="h-12 w-12 items-center justify-center rounded-2xl bg-lavender">
                <TravelStyleIcon category={item.category} size={23} />
              </View>
              <View className="flex-1 gap-1">
                <Text
                  style={{ fontFamily: "Inter" }}
                  className="text-base font-bold text-ink"
                >
                  {item.name}
                </Text>
                <Text
                  style={{ fontFamily: "Inter" }}
                  className="text-sm text-muted"
                  numberOfLines={2}
                >
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
          <View className="rounded-xl bg-[#FAF7FC] px-3 py-3">
            <Text className="text-sm text-muted">
              No saved travel style yet. Create one to personalize trip
              suggestions.
            </Text>
          </View>
        )}
        <Button
          variant="primary"
          disabled={unavailable}
          onPress={() => router.push("/profile/new")}
          className="rounded-xl"
        >
          <Plus size={18} color="white" />
          <Text
            style={{ fontFamily: "Inter" }}
            className="font-semibold text-white"
          >
            Create New Profile
          </Text>
        </Button>
      </View>
      <View className="gap-1 rounded-2xl border border-[#EEE7F5] bg-white p-4">
        <SectionHeader
          title="Emergency & destination"
          subtitle="Keep important contacts and travel notes handy"
          icon={<Globe size={19} color="#8050C5" />}
        />
        <Row
          title="Emergency Contacts"
          subtitle="Family, friends, emergency hotline"
          icon={<Phone size={18} color="#7C4DBE" />}
          disabled={unavailable}
          onPress={() => open("contacts")}
        />
        <Row
          title="Destination Information"
          subtitle="Embassy, local emergency numbers, health info"
          icon={<Globe size={18} color="#7C4DBE" />}
          disabled={unavailable}
          onPress={() => open("destination")}
        />
      </View>
      <View className="gap-1 rounded-2xl border border-[#EEE7F5] bg-white p-4">
        <SectionHeader
          title="App settings"
          subtitle="Personalize your Eggsplore experience"
          icon={<Ruler size={19} color="#8050C5" />}
        />
        <Row
          title="Notifications"
          subtitle="Trip updates, reminders, alerts"
          icon={<Bell size={18} color="#7C4DBE" />}
          disabled={unavailable}
          onPress={() => open("settings")}
        />
        <Row
          title="Units"
          subtitle="Metric / Imperial"
          icon={<Ruler size={18} color="#7C4DBE" />}
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
              <Text style={{ fontFamily: "Inter" }} className="flex-1 text-ink">
                Notification preference
              </Text>
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
            No notifications yet. Your trip updates and reminders will appear
            here.
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
