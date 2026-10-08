import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

type ReminderNote = {
  id: string;
  title: string;
  detail?: string;
  done?: boolean;
  reminderDate?: string | null;
  reminderTime?: string | null;
};

type ReminderResult = "scheduled" | "cancelled" | "permission-denied" | "unsupported" | "past";

let notificationHandlerInstalled = false;

async function getNotifications() {
  const notifications = await import("expo-notifications");
  if (!notificationHandlerInstalled) {
    notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
    notificationHandlerInstalled = true;
  }
  return notifications;
}

export async function syncNoteReminder(options: {
  storageKey: string;
  note: ReminderNote;
  tripTitle: string;
  requestPermission?: boolean;
}): Promise<ReminderResult> {
  const { storageKey, note, tripTitle, requestPermission = false } = options;
  if (Platform.OS === "web") return "unsupported";
  const Notifications = await getNotifications();

  const ids = await readIds(storageKey);
  const oldId = ids[note.id];
  if (oldId) await Notifications.cancelScheduledNotificationAsync(oldId);
  delete ids[note.id];

  if (note.done || !note.reminderDate || !note.reminderTime) {
    await AsyncStorage.setItem(storageKey, JSON.stringify(ids));
    return "cancelled";
  }

  const triggerDate = makeLocalDateTime(note.reminderDate, note.reminderTime);
  if (!triggerDate || triggerDate.getTime() <= Date.now() + 5000) {
    await AsyncStorage.setItem(storageKey, JSON.stringify(ids));
    return "past";
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("trip-reminders", {
      name: "Trip reminders",
      importance: Notifications.AndroidImportance.HIGH,
      sound: "default",
    });
  }
  let permission = await Notifications.getPermissionsAsync();
  if (!permission.granted && permission.ios?.status !== Notifications.IosAuthorizationStatus.PROVISIONAL && requestPermission) {
    permission = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: false, allowSound: true },
    });
  }
  if (!permission.granted && permission.ios?.status !== Notifications.IosAuthorizationStatus.PROVISIONAL) {
    await AsyncStorage.setItem(storageKey, JSON.stringify(ids));
    return requestPermission ? "permission-denied" : "cancelled";
  }

  const identifier = await Notifications.scheduleNotificationAsync({
    content: {
      title: tripTitle ? `Reminder · ${tripTitle}` : "Trip reminder",
      body: note.detail && note.detail !== "Personal note" ? `${note.title} — ${note.detail}` : note.title,
      sound: "default",
      data: { tripReminder: true, noteId: note.id },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: triggerDate,
      ...(Platform.OS === "android" ? { channelId: "trip-reminders" } : {}),
    },
  });
  ids[note.id] = identifier;
  await AsyncStorage.setItem(storageKey, JSON.stringify(ids));
  return "scheduled";
}

export async function cancelNoteReminder(storageKey: string, noteId: string): Promise<void> {
  if (Platform.OS === "web") return;
  const Notifications = await getNotifications();
  const ids = await readIds(storageKey);
  const identifier = ids[noteId];
  if (identifier) await Notifications.cancelScheduledNotificationAsync(identifier);
  delete ids[noteId];
  await AsyncStorage.setItem(storageKey, JSON.stringify(ids));
}

async function readIds(key: string): Promise<Record<string, string>> {
  try {
    const raw = await AsyncStorage.getItem(key);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, string> : {};
  } catch {
    return {};
  }
}

function makeLocalDateTime(date: string, time: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return null;
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const value = new Date(year, month - 1, day, hour, minute, 0, 0);
  return value.getFullYear() === year && value.getMonth() === month - 1 && value.getDate() === day ? value : null;
}
