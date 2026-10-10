export type DbNotification = {
  id: string;
  trip_id: string | null;
  type: string;
  title: string;
  body: string | null;
  read_at: string | null;
  created_at: string;
};

export type NoteRow = { trip_id: string; items: unknown };

export type AppNotification = {
  key: string;
  id: string;
  source: "db" | "note";
  type: string;
  title: string;
  body: string | null;
  tripId: string | null;
  createdAt: string;
  read: boolean;
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

// A note reminder counts as a notification once its time has passed, if the
// note isn't done yet. Times are the device's local time, like B's reminders.
export function dueNoteReminders(
  rows: NoteRow[],
  now: Date,
  windowDays = 14,
): Omit<AppNotification, "read">[] {
  const out: Omit<AppNotification, "read">[] = [];
  const oldest = now.getTime() - windowDays * 86_400_000;
  for (const row of rows) {
    if (!Array.isArray(row.items)) continue;
    for (const item of row.items) {
      if (!item || typeof item !== "object") continue;
      const { id, title, done, reminderDate, reminderTime } = item as Record<
        string,
        unknown
      >;
      if (typeof id !== "string" || typeof title !== "string" || done) continue;
      if (typeof reminderDate !== "string" || !DATE.test(reminderDate)) continue;
      const time =
        typeof reminderTime === "string" && TIME.test(reminderTime)
          ? reminderTime
          : "09:00";
      const due = new Date(`${reminderDate}T${time}:00`);
      const at = due.getTime();
      if (Number.isNaN(at) || at > now.getTime() || at < oldest) continue;
      const key = `note:${row.trip_id}:${id}:${reminderDate}T${time}`;
      out.push({
        key,
        id: key,
        source: "note",
        type: "note_reminder",
        title: `Reminder: ${title}`,
        body: "From your trip notes",
        tripId: row.trip_id,
        createdAt: due.toISOString(),
      });
    }
  }
  return out;
}

export function mergeNotifications(
  db: DbNotification[],
  notes: Omit<AppNotification, "read">[],
  readNoteKeys: Set<string>,
): AppNotification[] {
  const fromDb: AppNotification[] = db.map((n) => ({
    key: `db:${n.id}`,
    id: n.id,
    source: "db",
    type: n.type,
    title: n.title,
    body: n.body,
    tripId: n.trip_id,
    createdAt: n.created_at,
    read: n.read_at !== null,
  }));
  const fromNotes: AppNotification[] = notes.map((n) => ({
    ...n,
    read: readNoteKeys.has(n.key),
  }));
  return [...fromDb, ...fromNotes].sort((a, b) =>
    a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0,
  );
}

export function unreadCount(items: Pick<AppNotification, "read">[]): number {
  return items.filter((n) => !n.read).length;
}

export function timeAgo(iso: string, now: Date = new Date()): string {
  const ms = now.getTime() - new Date(iso).getTime();
  if (Number.isNaN(ms) || ms < 60_000) return "just now";
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.floor(hours / 24)} d ago`;
}