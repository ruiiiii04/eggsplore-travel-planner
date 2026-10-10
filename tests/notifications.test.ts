import { test } from "node:test";
import assert from "node:assert/strict";
import {
  dueNoteReminders,
  mergeNotifications,
  timeAgo,
  unreadCount,
} from "../src/features/notifications/model";

const now = new Date("2026-10-10T12:00:00");
const note = (over: Record<string, unknown>) => ({
  id: "n1",
  title: "Pack charger",
  detail: "",
  done: false,
  reminderDate: "2026-10-10",
  reminderTime: "09:00",
  ...over,
});

test("due, unfinished note reminders become notifications", () => {
  const result = dueNoteReminders([{ trip_id: "t1", items: [note({})] }], now);
  assert.equal(result.length, 1);
  assert.equal(result[0].type, "note_reminder");
  assert.equal(result[0].tripId, "t1");
  assert.equal(result[0].title, "Reminder: Pack charger");
});

test("future, finished, old and malformed reminders are ignored", () => {
  const rows = [
    {
      trip_id: "t1",
      items: [
        note({ id: "future", reminderTime: "18:00" }),
        note({ id: "done", done: true }),
        note({ id: "old", reminderDate: "2026-09-01" }),
        note({ id: "nodate", reminderDate: null }),
        note({ id: "baddate", reminderDate: "tomorrow" }),
        null,
        "text",
        { id: 5 },
      ],
    },
    { trip_id: "t2", items: "not an array" },
  ];
  assert.deepEqual(dueNoteReminders(rows, now), []);
});

test("a missing reminder time defaults to 09:00", () => {
  const rows = [{ trip_id: "t1", items: [note({ reminderTime: null })] }];
  assert.equal(dueNoteReminders(rows, now).length, 1);
  assert.equal(
    dueNoteReminders(rows, new Date("2026-10-10T08:00:00")).length,
    0,
  );
});

test("merging sorts newest first and tracks read state", () => {
  const db = [
    {
      id: "a",
      trip_id: "t1",
      type: "expense_added",
      title: "Alex added Ramen",
      body: "You owe Alex RM 25.00",
      read_at: null,
      created_at: "2026-10-10T10:00:00.000Z",
    },
    {
      id: "b",
      trip_id: "t1",
      type: "debt_paid",
      title: "Mei marked a payment as paid",
      body: null,
      read_at: "2026-10-10T11:00:00.000Z",
      created_at: "2026-10-09T10:00:00.000Z",
    },
  ];
  const notes = dueNoteReminders([{ trip_id: "t1", items: [note({})] }], now);
  const merged = mergeNotifications(db, notes, new Set());
  assert.equal(merged.length, 3);
  assert.ok(merged.every((n, i) => i === 0 || merged[i - 1].createdAt >= n.createdAt));
  assert.equal(merged.filter((n) => n.source === "db")[0].key, "db:a");
  assert.equal(unreadCount(merged), 2);
  const marked = mergeNotifications(db, notes, new Set([notes[0].key]));
  assert.equal(unreadCount(marked), 1);
});

test("relative times read naturally", () => {
  const base = new Date("2026-10-10T12:00:00Z");
  assert.equal(timeAgo("2026-10-10T11:59:40Z", base), "just now");
  assert.equal(timeAgo("2026-10-10T11:30:00Z", base), "30 min ago");
  assert.equal(timeAgo("2026-10-10T07:00:00Z", base), "5 h ago");
  assert.equal(timeAgo("2026-10-07T12:00:00Z", base), "3 d ago");
  assert.equal(timeAgo("garbage", base), "just now");
});