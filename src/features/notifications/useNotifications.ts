import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@/features/auth/useAuth";
import { getSupabase } from "@/lib/supabase";
import { errorMessage } from "@/lib/errors";
import {
  dueNoteReminders,
  mergeNotifications,
  unreadCount,
  type AppNotification,
  type DbNotification,
  type NoteRow,
} from "./model";

const readKey = (userId: string) => `eggsplore:notif-read-notes:${userId}`;

async function loadReadNotes(userId: string): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(readKey(userId));
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((v): v is string => typeof v === "string")
      : [];
  } catch {
    return [];
  }
}

async function saveReadNotes(userId: string, keys: string[]) {
  await AsyncStorage.setItem(
    readKey(userId),
    JSON.stringify(Array.from(new Set(keys)).slice(-200)),
  );
}

export function useNotifications() {
  const { user } = useAuth();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);

  useFocusEffect(
    useCallback(() => {
      if (!user) {
        setItems([]);
        return;
      }
      let active = true;
      setLoading(true);
      void (async () => {
        try {
          const db = getSupabase();
          const [alerts, notes, readNotes] = await Promise.all([
            db
              .from("notifications")
              .select("id,trip_id,type,title,body,read_at,created_at")
              .order("created_at", { ascending: false })
              .limit(50),
            db
              .from("trip_private_notes")
              .select("trip_id,items")
              .eq("user_id", user.id),
            loadReadNotes(user.id),
          ]);
          if (alerts.error) throw alerts.error;
          // Note reminders are a bonus: if they fail, the other alerts still show.
          const noteRows = notes.error ? [] : ((notes.data ?? []) as NoteRow[]);
          const merged = mergeNotifications(
            (alerts.data ?? []) as DbNotification[],
            dueNoteReminders(noteRows, new Date()),
            new Set(readNotes),
          );
          if (active) {
            setItems(merged);
            setError("");
          }
        } catch (cause) {
          if (active) setError(errorMessage(cause));
        } finally {
          if (active) setLoading(false);
        }
      })();
      return () => {
        active = false;
      };
    }, [user?.id, revision]),
  );

  async function markRead(item: AppNotification) {
    if (item.read || !user) return;
    setItems((prev) =>
      prev.map((n) => (n.key === item.key ? { ...n, read: true } : n)),
    );
    try {
      if (item.source === "db") {
        const { error: failure } = await getSupabase()
          .from("notifications")
          .update({ read_at: new Date().toISOString() })
          .eq("id", item.id)
          .is("read_at", null);
        if (failure) throw failure;
      } else {
        await saveReadNotes(user.id, [...(await loadReadNotes(user.id)), item.key]);
      }
    } catch {
      // The next refresh shows the true state.
    }
  }

  async function markAllRead() {
    if (!user) return;
    const noteKeys = items
      .filter((n) => !n.read && n.source === "note")
      .map((n) => n.key);
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      await getSupabase()
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("user_id", user.id)
        .is("read_at", null);
      if (noteKeys.length) {
        await saveReadNotes(user.id, [...(await loadReadNotes(user.id)), ...noteKeys]);
      }
    } catch {
      // The next refresh shows the true state.
    }
  }

  return {
    items,
    unread: unreadCount(items),
    loading,
    error,
    refresh: () => setRevision((value) => value + 1),
    markRead,
    markAllRead,
  };
}