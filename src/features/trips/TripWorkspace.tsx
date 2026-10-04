import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Image, Modal, Platform, Pressable, ScrollView, Switch, Text, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ArrowDown, ArrowLeft, ArrowUp, Bell, CalendarDays, Check, ChevronDown, ChevronRight, Circle, Cloud, Luggage, MapPin, MoreHorizontal, Pencil, Plane, Plus, SquareCheckBig, ThumbsDown, ThumbsUp, TrainFront, Umbrella, Utensils, UsersRound, Wallet, Lightbulb, BedDouble, Camera, Trash2, GripVertical, X, UserRoundPlus, LogOut } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getSupabase } from "@/lib/supabase";
import { errorMessage } from "@/lib/errors";
import { useAuth } from "@/features/auth/useAuth";
import type { Trip } from "./model";
import { useTrips } from "./useTrips";
import { rememberTrip } from "./recentTrip";
import CandidatePool from "../decision-engine/CandidatePool";
import { BottomSheet, Button } from "@/components/ui";
import { cancelNoteReminder, syncNoteReminder } from "./noteReminders";

type ScreenMode = "trip" | "itinerary" | "notes" | "candidates";
type ItineraryItem = { id: string; title: string; description: string | null; activity_category: string | null; location_name: string | null; start_time: string | null; position: number };
type NoteItem = { id: string; title: string; detail: string; done?: boolean; icon?: string; reminderDay?: number | null; reminderDate?: string | null; reminderTime?: string | null };
type AddKind = "activity" | "note" | null;
type DeleteRequest = { kind: "activity"; item: ItineraryItem } | { kind: "note"; item: NoteItem } | { kind: "day"; date: string; dayNumber: number; activityCount: number };
type TripMember = { user_id: string; username: string; display_name: string | null; avatar_url: string | null; role: "owner" | "member" };
type TripAction = { kind: "delete-trip" } | { kind: "leave-trip" } | { kind: "remove-member"; member: TripMember };
const activityCategories = [["sightseeing", "Attraction", Camera], ["food", "Food", Utensils], ["transport", "Transport", TrainFront], ["stay", "Stay", BedDouble]] as const;
const noteCategories = [["reminder", "Reminder", Check], ["packing", "Packing", Luggage], ["idea", "Idea", Lightbulb], ["general", "General", Pencil]] as const;
const ink = "#37134F", purple = "#8050C5", muted = "#89789D", line = "#EEE7F5", pale = "#F5F0FB";
const formLabel = { color: ink, fontSize: 12, fontWeight: "700" as const, marginBottom: -9 };
const formInput = { minHeight: 46, borderRadius: 13, borderWidth: 1, borderColor: line, backgroundColor: "white", paddingHorizontal: 13, color: ink, fontSize: 14 };

export default function TripWorkspace({ mode }: { mode: ScreenMode }) {
  const { id = "", from = "" } = useLocalSearchParams<{ id: string; from?: string }>();
  const { user } = useAuth();
  const [activeMode, setActiveMode] = useState<ScreenMode>(mode);
  const scrollRef = useRef<ScrollView>(null);
  const { trips: allTrips, refresh: refreshTrips } = useTrips();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [items, setItems] = useState<ItineraryItem[]>([]);
  const [notes, setNotes] = useState("");
  const [noteItems, setNoteItems] = useState<NoteItem[]>([]);
  const [addKind, setAddKind] = useState<AddKind>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftDetail, setDraftDetail] = useState("");
  const [draftDate, setDraftDate] = useState("");
  const [draftDayNumber, setDraftDayNumber] = useState<number | null>(null);
  const [draftTime, setDraftTime] = useState("");
  const [draftCategory, setDraftCategory] = useState("sightseeing");
  const [draftReminderDate, setDraftReminderDate] = useState<string | null>(null);
  const [draftReminderTime, setDraftReminderTime] = useState("09:00");
  const [editingActivity, setEditingActivity] = useState<ItineraryItem | null>(null);
  const [editingNote, setEditingNote] = useState<NoteItem | null>(null);
  const [deleteRequest, setDeleteRequest] = useState<DeleteRequest | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [error, setError] = useState("");
  const [notesError, setNotesError] = useState("");
  const [reminderNotice, setReminderNotice] = useState("");
  const [notesLoading, setNotesLoading] = useState(true);
  const [notesLoadedScope, setNotesLoadedScope] = useState("");
  const [collapsedDays, setCollapsedDays] = useState<Record<string, boolean>>({});
  const notesScope = `${user?.id ?? "signed-out"}:${id}`;
  const notesKey = `eggsplore:user-trip-notes:${user?.id ?? "signed-out"}:${id}`;
  const notesPendingKey = `${notesKey}:pending`;
  const reminderNotificationKey = `${notesKey}:scheduled-notifications`;
  const legacyNotesKey = `eggsplore:trip-notes:${id}`;
  const notesSaveQueue = useRef<Promise<void>>(Promise.resolve());
  const notesCacheQueue = useRef<Promise<void>>(Promise.resolve());
  const notesSyncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [manageOpen, setManageOpen] = useState(false);
  const [tripMembers, setTripMembers] = useState<TripMember[]>([]);
  const [memberQuery, setMemberQuery] = useState("");
  const [memberMatch, setMemberMatch] = useState<{ id: string; username: string; display_name: string | null; avatar_url: string | null } | null>(null);
  const [managementBusy, setManagementBusy] = useState(false);
  const [managementError, setManagementError] = useState("");
  const [tripAction, setTripAction] = useState<TripAction | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const { data, error: failure } = await getSupabase().from("trips").select("*").eq("id", id).single();
        if (failure) throw failure;
        if (active) setTrip(data as Trip);
        const { data: rows, error: itemFailure } = await getSupabase().from("itinerary_items").select("id,title,description,activity_category,location_name,start_time,position").eq("trip_id", id).order("position", { ascending: true });
        if (itemFailure) throw itemFailure;
        if (active) setItems((rows ?? []) as ItineraryItem[]);
      } catch (cause) { if (active) setError(errorMessage(cause)); }
    })();
    return () => { active = false; };
  }, [id]);

  useEffect(() => {
    let active = true;
    setNotesLoading(true);
    setNotesLoadedScope("");
    setNotesError("");
    setNoteItems([]);
    setNotes("");
    void (async () => {
      const [accountCache, accountText, accountPending, legacyCache, legacyText] = await Promise.all([
        AsyncStorage.getItem(notesKey), AsyncStorage.getItem(`${notesKey}:text`),
        AsyncStorage.getItem(notesPendingKey), AsyncStorage.getItem(legacyNotesKey), AsyncStorage.getItem(`${legacyNotesKey}:text`),
      ]);
      const cached = parseCachedNotes(accountCache, accountText);
      const legacy = parseCachedNotes(legacyCache, legacyText);
      if (!user) {
        if (active) { setNoteItems(cached.items); setNotes(cached.text); setNotesLoading(false); setNotesLoadedScope(notesScope); }
        return;
      }
      try {
        const { data, error: failure } = await getSupabase().from("trip_private_notes").select("items,additional_text").eq("trip_id", id).eq("user_id", user.id).maybeSingle();
        if (failure) throw failure;
        const initial = data && !accountPending ? { items: normalizeNoteItems(data.items), text: data.additional_text ?? "" } : cached.hasData ? cached : data ? { items: normalizeNoteItems(data.items), text: data.additional_text ?? "" } : legacy;
        if (!data || accountPending) {
          const { error: saveFailure } = await getSupabase().from("trip_private_notes").upsert({ trip_id: id, user_id: user.id, items: initial.items, additional_text: initial.text }, { onConflict: "trip_id,user_id" });
          if (saveFailure) throw saveFailure;
          if (accountPending && await AsyncStorage.getItem(notesPendingKey) === accountPending) await AsyncStorage.removeItem(notesPendingKey);
        }
        if (!active) return;
        setNoteItems(initial.items);
        setNotes(initial.text);
        await Promise.all([
          AsyncStorage.setItem(notesKey, JSON.stringify(initial.items)),
          AsyncStorage.setItem(`${notesKey}:text`, initial.text),
          AsyncStorage.removeItem(legacyNotesKey),
          AsyncStorage.removeItem(`${legacyNotesKey}:text`),
        ]);
        setNotesLoading(false);
        setNotesLoadedScope(notesScope);
      } catch (cause) {
        if (!active) return;
        setNoteItems(cached.hasData ? cached.items : legacy.items);
        setNotes(cached.hasData ? cached.text : legacy.text);
        setNotesError(`Could not sync your private notes. ${errorMessage(cause)}`);
        setNotesLoading(false);
        setNotesLoadedScope(notesScope);
      }
    })();
    return () => { active = false; };
  }, [id, user?.id]);

  useEffect(() => { void rememberTrip(id); }, [id]);
  useEffect(() => () => { if (notesSyncTimer.current) clearTimeout(notesSyncTimer.current); }, [id]);
  useEffect(() => {
    setActiveMode(mode);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [id, mode]);

  useEffect(() => {
    if (notesLoading || notesLoadedScope !== notesScope || Platform.OS === "web") return;
    void Promise.all(noteItems.map((note) => syncNoteReminder({ storageKey: reminderNotificationKey, note, tripTitle: trip?.title || trip?.destination || "Trip" })))
      .catch((cause) => setReminderNotice(`Could not refresh reminders on this device: ${errorMessage(cause)}`));
  }, [notesLoadedScope, notesScope]);

  const dateRange = useMemo(() => formatRange(trip?.start_date, trip?.end_date), [trip?.start_date, trip?.end_date]);
  const tripDays = useMemo(() => {
    if (!trip?.start_date || !trip.end_date) return [] as string[];
    const dates: string[] = [];
    const cursor = new Date(`${trip.start_date}T00:00:00Z`);
    const last = new Date(`${trip.end_date}T00:00:00Z`);
    while (cursor <= last) { dates.push(cursor.toISOString().slice(0, 10)); cursor.setUTCDate(cursor.getUTCDate() + 1); }
    return dates;
  }, [trip?.start_date, trip?.end_date]);
  const destination = trip?.destination || "Destination to be decided";
  const title = trip?.title || destination;
  const go = (next: ScreenMode) => {
    setActiveMode(next);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  };
  const cachePendingNotes = (nextItems: NoteItem[], nextText: string, revision: string) => {
    notesCacheQueue.current = notesCacheQueue.current.catch(() => undefined).then(async () => {
      await AsyncStorage.setItem(notesPendingKey, revision);
      await Promise.all([
        AsyncStorage.setItem(notesKey, JSON.stringify(nextItems)),
        AsyncStorage.setItem(`${notesKey}:text`, nextText),
      ]);
    });
    return notesCacheQueue.current;
  };
  const persistNotes = (nextItems: NoteItem[], nextText: string, revision: string, localSave: Promise<void>) => {
    if (notesLoading || notesLoadedScope !== notesScope) return;
    notesSaveQueue.current = notesSaveQueue.current.catch(() => undefined).then(async () => {
      await localSave;
      if (!user) return;
      const { error: failure } = await getSupabase().from("trip_private_notes").upsert({ trip_id: id, user_id: user.id, items: nextItems, additional_text: nextText }, { onConflict: "trip_id,user_id" });
      if (failure) throw failure;
      if (await AsyncStorage.getItem(notesPendingKey) === revision) await AsyncStorage.removeItem(notesPendingKey);
      setNotesError("");
    }).catch((cause) => setNotesError(`Could not sync your private notes. ${errorMessage(cause)}`));
  };
  const saveNotes = (value: string) => {
    setNotes(value);
    const revision = `${Date.now()}-${Math.random()}`;
    const localSave = cachePendingNotes(noteItems, value, revision);
    if (notesSyncTimer.current) clearTimeout(notesSyncTimer.current);
    notesSyncTimer.current = setTimeout(() => persistNotes(noteItems, value, revision, localSave), 500);
  };
  const saveNoteItems = (value: NoteItem[]) => {
    setNoteItems(value);
    if (notesSyncTimer.current) clearTimeout(notesSyncTimer.current);
    const revision = `${Date.now()}-${Math.random()}`;
    persistNotes(value, notes, revision, cachePendingNotes(value, notes, revision));
  };
  const openAdd = (kind: Exclude<AddKind, null>, day?: string, dayNumber?: number) => {
    const initialDate = day ?? trip?.start_date ?? "";
    const initialDayIndex = tripDays.indexOf(initialDate);
    setEditingActivity(null); setEditingNote(null); setDraftTitle(""); setDraftDetail(""); setDraftDate(initialDate); setDraftDayNumber(dayNumber ?? (initialDayIndex >= 0 ? initialDayIndex + 1 : null)); setDraftTime("");
    setDraftCategory(kind === "activity" ? "sightseeing" : "reminder"); setDraftReminderDate(null); setDraftReminderTime("09:00"); setFormError(""); setReminderNotice(""); setAddKind(kind);
  };
  const openEditNote = (note: NoteItem) => {
    setEditingActivity(null); setEditingNote(note); setDraftTitle(note.title); setDraftDetail(note.detail);
    const category = note.icon === "umbrella" ? "reminder" : note.icon === "bag" ? "packing" : note.icon === "thought" ? "idea" : note.icon;
    setDraftCategory(noteCategories.some(([key]) => key === category) ? category! : "general");
    setDraftReminderTime(note.reminderTime ?? "09:00");
    const legacyReminderDate = note.reminderDay === -1 && trip?.start_date
      ? addDays(trip.start_date, -1)
      : note.reminderDay && note.reminderDay > 0 ? tripDays[note.reminderDay - 1] : null;
    setDraftReminderDate(note.reminderDate ?? legacyReminderDate);
    setFormError(""); setAddKind("note");
  };
  const openEditActivity = (item: ItineraryItem) => {
    setEditingActivity(item); setDraftTitle(item.title); setDraftDetail(item.location_name ?? "");
    const legacyDay = parseLegacyDayDescription(item.description);
    const itemDate = item.start_time?.slice(0, 10) ?? "";
    const itemDayIndex = tripDays.indexOf(itemDate);
    setDraftDate(itemDate); setDraftDayNumber(itemDayIndex >= 0 ? itemDayIndex + 1 : legacyDay?.day ?? null); setDraftTime(item.start_time?.slice(11, 16) ?? legacyDay?.time ?? "");
    const legacyCategory = item.description?.startsWith("category:") ? item.description.slice(9) : null;
    const category = item.activity_category || legacyCategory || "sightseeing";
    setDraftCategory(activityCategories.some(([key]) => key === category) ? category : "sightseeing");
    setFormError(""); setAddKind("activity");
  };
  const saveNewItem = async () => {
    if (!draftTitle.trim()) { setFormError(addKind === "activity" ? "Enter an activity name." : "Enter a note title."); return; }
    if (addKind === "note" && draftReminderDate && !isValidDate(draftReminderDate)) { setFormError("Enter a valid reminder date as YYYY-MM-DD."); return; }
    if (addKind === "note" && draftReminderDate && !/^([01]\d|2[0-3]):[0-5]\d$/.test(draftReminderTime)) { setFormError("Enter a reminder time in 24-hour format, such as 09:00."); return; }
    if (addKind === "note" && draftReminderDate && new Date(`${draftReminderDate}T${draftReminderTime}:00`).getTime() <= Date.now()) { setFormError("Choose a reminder time in the future."); return; }
    if (addKind === "activity" && draftDate && !/^\d{4}-\d{2}-\d{2}$/.test(draftDate)) { setFormError("Use a date in YYYY-MM-DD format."); return; }
    if (addKind === "activity" && draftTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(draftTime)) { setFormError("Use a time in 24-hour format, such as 09:30."); return; }
    setSaving(true); setFormError("");
    try {
      if (addKind === "activity") {
        const date = draftDate;
        const startTime = date ? `${date}T${draftTime || "09:00"}:00Z` : null;
        const legacyDay = parseLegacyDayDescription(editingActivity?.description);
        const description = date
          ? editingActivity?.description?.startsWith("category:") ? null : editingActivity?.description ?? null
          : draftDayNumber
            ? `Day ${draftDayNumber} · ${draftTime || legacyDay?.time || "09:00"}`
            : legacyDay ? null : editingActivity?.description ?? null;
        const destinationDayKey = date || (draftDayNumber ? `ordinal:${draftDayNumber}` : "flexible");
        const movingToDifferentDay = !!editingActivity && getItineraryDayKey(editingActivity) !== destinationDayKey;
        const targetDayItems = items.filter((entry) => entry.id !== editingActivity?.id && getItineraryDayKey(entry) === destinationDayKey);
        const nextPosition = movingToDifferentDay ? Math.max(-1, ...targetDayItems.map((entry) => entry.position)) + 1 : undefined;
        const values = { title: draftTitle.trim(), location_name: draftDetail.trim() || null, description, activity_category: draftCategory, start_time: startTime, ...(nextPosition === undefined ? {} : { position: nextPosition }) };
        if (editingActivity) {
          const { data, error: failure } = await getSupabase().from("itinerary_items").update(values).eq("id", editingActivity.id).eq("trip_id", id).select("id,title,description,activity_category,location_name,start_time,position").single();
          if (failure) throw failure;
          setItems((previous) => previous.map((item) => item.id === editingActivity.id ? data as ItineraryItem : item).sort((a, b) => a.position - b.position));
        } else {
          const position = Math.max(-1, ...items.filter((entry) => getItineraryDayKey(entry) === destinationDayKey).map((entry) => entry.position)) + 1;
          const { data, error: failure } = await getSupabase().from("itinerary_items").insert({ trip_id: id, ...values, position }).select("id,title,description,activity_category,location_name,start_time,position").single();
          if (failure) throw failure;
          setItems((previous) => [...previous, data as ItineraryItem].sort((a, b) => a.position - b.position));
        }
      } else {
        const noteId = editingNote?.id ?? `${Date.now()}`;
        const updatedNote = { id: noteId, title: draftTitle.trim(), detail: draftDetail.trim() || "Personal note", icon: draftCategory, done: editingNote?.done, reminderDay: draftReminderDate ? getReminderDay(draftReminderDate, tripDays, trip?.start_date) : null, reminderDate: draftReminderDate, reminderTime: draftReminderDate ? draftReminderTime : null };
        const next = editingNote ? noteItems.map((note) => note.id === editingNote.id ? updatedNote : note) : [...noteItems, updatedNote];
        saveNoteItems(next);
        try {
          const reminderResult = await syncNoteReminder({ storageKey: reminderNotificationKey, note: updatedNote, tripTitle: title, requestPermission: !!updatedNote.reminderDate });
          if (reminderResult === "permission-denied") setReminderNotice("Note saved. Allow notifications in your device settings to receive this reminder.");
          else if (reminderResult === "unsupported") setReminderNotice("Device notifications are available in the installed app, not in the web preview.");
          else if (reminderResult === "past") setReminderNotice("Note saved. Choose a future date and time to receive its reminder.");
          else if (updatedNote.reminderDate) setReminderNotice("Reminder scheduled on this device.");
          else if (editingNote?.reminderDate) setReminderNotice("Reminder turned off.");
        } catch (cause) {
          setReminderNotice(`Note saved, but the reminder could not be scheduled: ${errorMessage(cause)}`);
        }
      }
      setAddKind(null);
      setEditingActivity(null);
      setEditingNote(null);
    } catch (cause) { setFormError(errorMessage(cause)); }
    finally { setSaving(false); }
  };
  const addDay = async () => {
    if (!trip) return;
    if (trip.start_date && trip.end_date) {
      const endDate = addDays(trip.end_date, 1);
      const { data, error: failure } = await getSupabase().from("trips").update({ end_date: endDate }).eq("id", id).select("*").single();
      if (failure) { setError(errorMessage(failure)); return; }
      setTrip(data as Trip); refreshTrips(); setCollapsedDays((previous) => ({ ...previous, [endDate]: false })); setError("");
      return;
    }
    const ordinal = Math.max(trip.flexible_day_count ?? 1, ...items.map((item) => getOrdinalDayNumber(getItineraryDayKey(item)) ?? 1)) + 1;
    const { data, error: failure } = await getSupabase().from("trips").update({ flexible_day_count: ordinal }).eq("id", id).select("*").single();
    if (failure) {
      const message = failure.message.toLowerCase();
      setError(failure.code === "42703" || failure.code === "PGRST204" || message.includes("flexible_day_count")
        ? "The trip database needs migration 011 before flexible days can be added. Apply the pending Supabase migration, then retry."
        : errorMessage(failure));
      return;
    }
    setTrip(data as Trip); setCollapsedDays((previous) => ({ ...previous, [`ordinal:${ordinal}`]: false })); setError("");
  };
  const moveActivity = async (day: string, item: ItineraryItem, targetIndex: number) => {
    const dayItems = items.filter((entry) => getItineraryDayKey(entry) === day).sort(compareItineraryItems);
    const from = dayItems.findIndex((entry) => entry.id === item.id);
    const to = Math.max(0, Math.min(targetIndex, dayItems.length - 1));
    if (from < 0 || to === from || !dayItems.length) return;
    const firstUnscheduled = dayItems.findIndex((entry) => getActivityTime(entry) === null);
    if ((firstUnscheduled < 0 || from < firstUnscheduled) !== (firstUnscheduled < 0 || to < firstUnscheduled)) {
      setError("Activities with times can only be moved among other scheduled activities.");
      return;
    }
    const reordered = [...dayItems];
    const [moving] = reordered.splice(from, 1);
    reordered.splice(to, 0, moving);
    const { error: failure } = await getSupabase().rpc("reorder_itinerary_day", { target_trip: id, ordered_items: reordered.map((entry) => entry.id) });
    if (failure) { setError(errorMessage(failure)); return; }
    setItems((previous) => {
      const slots = dayItems;
      const updates = new Map(reordered.map((entry, index) => [entry.id, {
        position: slots[index].position,
        start_time: slots[index].start_time,
        description: !entry.start_time && !slots[index].start_time
          ? swapLegacyActivityTime(entry.description, slots[index].description)
          : entry.description,
      }]));
      return previous.map((entry) => updates.has(entry.id) ? { ...entry, ...updates.get(entry.id)! } : entry);
    });
    setError("");
  };
  const deleteActivity = (item: ItineraryItem) => setDeleteRequest({ kind: "activity", item });
  const deleteNote = (item: NoteItem) => setDeleteRequest({ kind: "note", item });
  const deleteDay = (date: string, dayNumber: number, dayItems: ItineraryItem[]) => setDeleteRequest({ kind: "day", date, dayNumber, activityCount: dayItems.length });
  const confirmDelete = async () => {
    if (!deleteRequest) return;
    setDeleting(true);
    try {
      if (deleteRequest.kind === "activity") {
        const { error: failure } = await getSupabase().from("itinerary_items").delete().eq("id", deleteRequest.item.id).eq("trip_id", id);
        if (failure) throw failure;
        setItems((previous) => previous.filter((item) => item.id !== deleteRequest.item.id));
      } else if (deleteRequest.kind === "note") {
        const { item } = deleteRequest;
        await cancelNoteReminder(reminderNotificationKey, item.id);
        saveNoteItems(noteItems.filter((note) => note.id !== item.id));
      } else {
        if (!trip?.start_date || !trip.end_date) return;
        const singleDay = trip.start_date === trip.end_date;
        const removedActivities = items.filter((item) => getItineraryDayKey(item) === deleteRequest.date);
        const shiftedActivities = items.filter((item) => item.start_time && getItineraryDayKey(item) > deleteRequest.date);
        const previousDay = new Date(`${trip.end_date}T12:00:00Z`);
        previousDay.setUTCDate(previousDay.getUTCDate() - 1);
        const { error: failure } = await getSupabase().rpc("delete_trip_day", { target_trip: id, target_day: deleteRequest.date });
        if (failure) throw failure;
        setItems((previous) => previous.filter((item) => !removedActivities.some((removed) => removed.id === item.id)).map((item) => {
          const shifted = shiftedActivities.find((entry) => entry.id === item.id);
          if (!shifted?.start_time) return item;
          const shiftedDate = new Date(`${shifted.start_time.slice(0, 10)}T12:00:00Z`);
          shiftedDate.setUTCDate(shiftedDate.getUTCDate() - 1);
          return { ...item, start_time: `${shiftedDate.toISOString().slice(0, 10)}${shifted.start_time.slice(10)}` };
        }));
        setTrip((previous) => previous ? { ...previous, start_date: singleDay ? null : previous.start_date, end_date: singleDay ? null : previousDay.toISOString().slice(0, 10) } : previous);
        refreshTrips();
        setCollapsedDays((previous) => { const next = { ...previous }; delete next[deleteRequest.date]; return next; });
      }
      setDeleteRequest(null);
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setDeleting(false); }
  };

  const loadTripMembers = async () => {
    setManagementBusy(true); setManagementError("");
    const { data, error: failure } = await getSupabase().rpc("list_trip_members", { target_trip: id });
    if (failure) setManagementError(errorMessage(failure));
    else setTripMembers((data ?? []) as TripMember[]);
    setManagementBusy(false);
  };
  const openTripManagement = () => {
    setManageOpen(true); setMemberMatch(null); setMemberQuery(""); setManagementError("");
    void loadTripMembers();
  };
  const requestTripAction = (action: TripAction) => {
    setManagementError(""); setManageOpen(false); setTripAction(action);
  };
  const findMember = async () => {
    const username = memberQuery.trim().replace(/^@/, "").toLowerCase();
    if (!username) { setManagementError("Enter a username to search."); return; }
    setManagementBusy(true); setManagementError(""); setMemberMatch(null);
    const { data, error: failure } = await getSupabase().rpc("find_trip_member_by_username", { search_username: username });
    if (failure) setManagementError(errorMessage(failure));
    else {
      const found = Array.isArray(data) ? data[0] as { id: string; username: string; display_name: string | null; avatar_url: string | null } | undefined : undefined;
      if (!found) setManagementError("No account found with that username.");
      else if (tripMembers.some((member) => member.user_id === found.id)) setManagementError("This person is already in the trip.");
      else if (tripMembers.length >= 6) setManagementError("This trip has reached the six member limit.");
      else setMemberMatch(found);
    }
    setManagementBusy(false);
  };
  const addTripMember = async () => {
    if (!memberMatch) return;
    setManagementBusy(true); setManagementError("");
    const { error: failure } = await getSupabase().from("trip_members").insert({ trip_id: id, user_id: memberMatch.id, role: "member" });
    if (failure) setManagementError(errorMessage(failure));
    else { setMemberMatch(null); setMemberQuery(""); await loadTripMembers(); }
    setManagementBusy(false);
  };
  const confirmTripAction = async () => {
    if (!tripAction || !user) return;
    setDeleting(true); setManagementError("");
    try {
      if (tripAction.kind === "delete-trip") {
        const { error: failure } = await getSupabase().from("trips").delete().eq("id", id).eq("owner_id", user.id);
        if (failure) throw failure;
        setTripAction(null); setManageOpen(false); refreshTrips(); router.replace("/(tabs)/trips");
      } else if (tripAction.kind === "leave-trip") {
        const { error: failure } = await getSupabase().from("trip_members").delete().eq("trip_id", id).eq("user_id", user.id).eq("role", "member");
        if (failure) throw failure;
        setTripAction(null); setManageOpen(false); refreshTrips(); router.replace("/(tabs)/trips");
      } else {
        const { error: failure } = await getSupabase().from("trip_members").delete().eq("trip_id", id).eq("user_id", tripAction.member.user_id).eq("role", "member");
        if (failure) throw failure;
        setTripAction(null); await loadTripMembers(); setManageOpen(true);
      }
    } catch (cause) { setManagementError(errorMessage(cause)); }
    finally { setDeleting(false); }
  };

  return <SafeAreaView edges={["top", "left", "right"]} style={{ flex: 1, width: "100%", backgroundColor: "#FBF9FD" }}>
    <ScrollView ref={scrollRef} contentContainerStyle={{ width: "100%", maxWidth: 402, alignSelf: "center", paddingBottom: 18 }} showsVerticalScrollIndicator={false}>
      <WorkspaceHeader title={title} destination={destination} dateRange={dateRange} id={id} trips={allTrips} active={activeMode === "candidates" ? "candidates" : "itinerary"} go={go} onMore={openTripManagement} onBack={() => from === "home" ? router.replace("/(tabs)/home") : router.canGoBack() ? router.back() : router.replace("/(tabs)/home")} />
      {activeMode === "trip" && <TripOverview destination={destination} dateRange={dateRange} itemsCount={items.length} openItinerary={() => go("itinerary")} openCandidates={() => go("candidates")} />}
      {(activeMode === "itinerary" || activeMode === "notes") && <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
        <WorkspacePlanningCard mode={activeMode} itemsCount={items.length} notes={() => go("notes")} />
        <WorkspaceContentTabs active={activeMode} go={go} />
      </View>}
      {activeMode === "itinerary" && <ItineraryContent items={items} destination={destination} startDate={trip?.start_date} endDate={trip?.end_date} flexibleDayCount={trip?.flexible_day_count ?? 1} canEdit={trip?.owner_id === user?.id} isDayExpanded={(date) => !collapsedDays[date]} toggleDay={(date) => setCollapsedDays((previous) => ({ ...previous, [date]: !previous[date] }))} addActivity={(date, dayNumber) => openAdd("activity", date, dayNumber)} addDay={() => void addDay()} editActivity={openEditActivity} deleteActivity={(item) => void deleteActivity(item)} deleteDay={deleteDay} moveActivity={(day, item, offset) => void moveActivity(day, item, offset)} />}
      {activeMode === "notes" && <NotesContent items={noteItems} value={notes} onChange={saveNotes} onToggleNote={(note) => { const updated = { ...note, done: !note.done }; saveNoteItems(noteItems.map((entry) => entry.id === note.id ? updated : entry)); void syncNoteReminder({ storageKey: reminderNotificationKey, note: updated, tripTitle: title }).catch((cause) => setReminderNotice(errorMessage(cause))); }} destination={destination} tripDays={tripDays} addNote={() => openAdd("note")} editNote={openEditNote} deleteNote={deleteNote} loading={notesLoading || notesLoadedScope !== notesScope} syncError={notesError} reminderNotice={reminderNotice} />}
      {activeMode === "candidates" && <CandidatePool key={id} tripId={id} trip={trip} existingItems={items} onPublished={() => { void getSupabase().from("itinerary_items").select("id,title,description,activity_category,location_name,start_time,position").eq("trip_id",id).order("position").then(({data,error}) => { if(error) setError(error.message); else { setItems((data || []) as ItineraryItem[]); go("itinerary"); } }); }} />}
      {!!error && <Text style={{ color: "#B43F60", paddingHorizontal: 20, marginTop: 8 }}>{error}</Text>}
    </ScrollView>
    <BottomSheet visible={manageOpen} title="Trip members" onClose={() => { if (!managementBusy) setManageOpen(false); }} busy={managementBusy}>
      <Text style={{ color: muted, fontSize: 12, lineHeight: 18 }}>View who is on this trip and add friends by their Eggsplore username.</Text>
      <View style={{ gap: 9 }}>
          {tripMembers.map((member) => <View key={member.user_id} style={{ minHeight: 58, flexDirection: "row", alignItems: "center", gap: 10, borderBottomWidth: 1, borderBottomColor: line, paddingVertical: 7 }}>
          <View style={{ width: 38, height: 38, borderRadius: 20, backgroundColor: pale, alignItems: "center", justifyContent: "center", overflow: "hidden" }}>{member.avatar_url ? <Image source={{ uri: member.avatar_url }} style={{ width: 38, height: 38 }} /> : <Text style={{ color: purple, fontWeight: "700", fontSize: 14 }}>{(member.display_name || member.username).slice(0, 1).toUpperCase()}</Text>}</View>
          <View style={{ flex: 1 }}><Text numberOfLines={1} style={{ color: ink, fontWeight: "700", fontSize: 12 }}>{member.display_name || member.username}{member.user_id === user?.id ? " (You)" : ""}</Text><Text style={{ color: muted, fontSize: 10, marginTop: 2 }}>@{member.username} · {member.role === "owner" ? "Trip creator" : "Member"}</Text></View>
          {trip?.owner_id === user?.id && member.role === "member" && <Pressable accessibilityRole="button" accessibilityLabel={`Remove @${member.username}`} onPress={() => requestTripAction({ kind: "remove-member", member })} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: pale, alignItems: "center", justifyContent: "center" }}><X size={17} color={muted} /></Pressable>}
        </View>)}
        {!tripMembers.length && !managementBusy && <Text style={{ color: muted, fontSize: 12, paddingVertical: 8 }}>No members found.</Text>}
        {managementBusy && <Text style={{ color: muted, fontSize: 12, paddingVertical: 8 }}>Loading members...</Text>}
      </View>
      {trip?.owner_id === user?.id && <View style={{ gap: 10, paddingTop: 4 }}>
        <Text style={{ color: ink, fontSize: 12, fontWeight: "700" }}>Invite by username</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View style={{ flex: 1, minHeight: 44, borderRadius: 13, borderWidth: 1, borderColor: line, backgroundColor: "white", flexDirection: "row", alignItems: "center", paddingHorizontal: 12 }}><Text style={{ color: muted, fontSize: 14 }}>@</Text><TextInput value={memberQuery} onChangeText={(value) => { setMemberQuery(value); setMemberMatch(null); setManagementError(""); }} placeholder="Username" placeholderTextColor="#A99CB5" autoCapitalize="none" autoCorrect={false} style={{ flex: 1, color: ink, fontSize: 13, paddingVertical: 8 }} onSubmitEditing={() => void findMember()} /></View>
          <Pressable accessibilityRole="button" disabled={managementBusy} onPress={() => void findMember()} style={{ minHeight: 44, borderRadius: 13, backgroundColor: purple, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, opacity: managementBusy ? 0.6 : 1 }}><UserRoundPlus size={16} color="white" /><Text style={{ color: "white", fontSize: 12, fontWeight: "700" }}>Find</Text></Pressable>
        </View>
        {memberMatch && <View style={{ minHeight: 52, borderRadius: 14, backgroundColor: pale, paddingHorizontal: 11, flexDirection: "row", alignItems: "center", gap: 8 }}><UsersRound size={17} color={purple} /><View style={{ flex: 1 }}><Text style={{ color: ink, fontSize: 12, fontWeight: "700" }}>{memberMatch.display_name || memberMatch.username}</Text><Text style={{ color: muted, fontSize: 10 }}>@{memberMatch.username}</Text></View><Pressable accessibilityRole="button" disabled={managementBusy} onPress={() => void addTripMember()} style={{ minHeight: 34, borderRadius: 17, backgroundColor: "white", paddingHorizontal: 14, justifyContent: "center" }}><Text style={{ color: purple, fontSize: 11, fontWeight: "700" }}>Add</Text></Pressable></View>}
      </View>}
      {!!managementError && <Text accessibilityRole="alert" style={{ color: "#B43F60", fontSize: 11, lineHeight: 16 }}>{managementError}</Text>}
      <View style={{ borderTopWidth: 1, borderTopColor: line, paddingTop: 12, gap: 9 }}>
        {trip?.owner_id === user?.id ? <Pressable accessibilityRole="button" onPress={() => requestTripAction({ kind: "delete-trip" })} style={{ minHeight: 46, borderRadius: 24, backgroundColor: "#FFF2F4", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 }}><Trash2 size={16} color="#B43F60" /><Text style={{ color: "#B43F60", fontWeight: "700", fontSize: 12 }}>Delete trip</Text></Pressable> : <Pressable accessibilityRole="button" onPress={() => requestTripAction({ kind: "leave-trip" })} style={{ minHeight: 46, borderRadius: 24, backgroundColor: pale, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 }}><LogOut size={16} color={purple} /><Text style={{ color: purple, fontWeight: "700", fontSize: 12 }}>Leave trip</Text></Pressable>}
      </View>
    </BottomSheet>
    <Modal visible={tripAction !== null} transparent animationType="fade" onRequestClose={() => { if (!deleting) setTripAction(null); }}>
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 20, backgroundColor: "rgba(25, 12, 35, 0.4)" }}>
        <Pressable accessibilityLabel="Close confirmation" accessibilityRole="button" disabled={deleting} onPress={() => setTripAction(null)} style={{ position: "absolute", inset: 0 }} />
        <View style={{ width: "100%", maxWidth: 360, backgroundColor: "white", borderRadius: 22, padding: 22, gap: 14 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}><Text accessibilityRole="header" style={{ color: ink, fontSize: 19, fontWeight: "700", fontFamily: "Fredoka" }}>{tripAction?.kind === "delete-trip" ? "Delete this trip?" : tripAction?.kind === "leave-trip" ? "Leave this trip?" : "Remove member?"}</Text><Pressable accessibilityLabel="Close confirmation" accessibilityRole="button" disabled={deleting} onPress={() => setTripAction(null)} style={{ width: 34, height: 34, alignItems: "center", justifyContent: "center" }}><X size={21} color={purple} /></Pressable></View>
          <Text style={{ color: muted, fontSize: 13, lineHeight: 19 }}>{tripAction?.kind === "delete-trip" ? "This permanently deletes the trip, itinerary, votes and candidate pool for everyone. This cannot be undone." : tripAction?.kind === "leave-trip" ? "You will lose access to this trip, its itinerary and group vote." : `@${tripAction?.kind === "remove-member" ? tripAction.member.username : ""} will lose access to this trip.`}</Text>
          {!!managementError && <Text accessibilityRole="alert" style={{ color: "#B43F60", fontSize: 11 }}>{managementError}</Text>}
          <Pressable accessibilityRole="button" disabled={deleting} onPress={() => setTripAction(null)} style={{ minHeight: 46, borderRadius: 24, borderWidth: 1, borderColor: line, backgroundColor: pale, alignItems: "center", justifyContent: "center", opacity: deleting ? 0.5 : 1 }}><Text style={{ color: purple, fontWeight: "700" }}>Cancel</Text></Pressable>
          <Pressable accessibilityRole="button" accessibilityState={{ busy: deleting, disabled: deleting }} disabled={deleting} onPress={() => void confirmTripAction()} style={{ minHeight: 46, borderRadius: 24, backgroundColor: "#B43F60", alignItems: "center", justifyContent: "center", opacity: deleting ? 0.5 : 1 }}><Text style={{ color: "white", fontWeight: "700" }}>{deleting ? "Please wait..." : tripAction?.kind === "delete-trip" ? "Delete trip" : tripAction?.kind === "leave-trip" ? "Leave trip" : "Remove member"}</Text></Pressable>
        </View>
      </View>
    </Modal>
    <BottomSheet visible={addKind !== null} title={addKind === "activity" ? editingActivity ? "Edit Activity" : "Add Activity" : editingNote ? "Edit Note" : "Add Note"} onClose={() => { setAddKind(null); setEditingActivity(null); setEditingNote(null); }} busy={saving}>
      <Text style={{ color: muted, fontSize: 12 }}>{addKind === "activity" ? "Add a stop to this trip itinerary." : "This note is private and only visible to you."}</Text>
      <Text style={formLabel}>{addKind === "activity" ? "Activity name *" : "Title *"}</Text>
      <TextInput value={draftTitle} onChangeText={setDraftTitle} placeholder={addKind === "activity" ? "e.g. Visit Senso-ji Temple" : "e.g. Remember to bring an umbrella"} placeholderTextColor="#A99CB5" style={formInput} autoFocus />
      <Text style={formLabel}>{addKind === "activity" ? "Location (optional)" : "Details (optional)"}</Text>
      <TextInput value={draftDetail} onChangeText={setDraftDetail} placeholder={addKind === "activity" ? "Place or area" : "Add a little more detail"} placeholderTextColor="#A99CB5" style={formInput} />
      {addKind === "activity" && <View style={{ gap: 8 }}><Text style={formLabel}>Day</Text>{editingActivity ? <ActivityDaySelector items={items} tripDays={tripDays} date={draftDate} dayNumber={draftDayNumber} onChange={(date, dayNumber) => { setDraftDate(date); setDraftDayNumber(dayNumber); }} /> : <Text style={{ color: muted, fontSize: 12 }}>{draftDate ? formatTravelDate(draftDate) : draftDayNumber ? `Day ${draftDayNumber} · No calendar date` : "Flexible"}</Text>}<Text style={formLabel}>Time (optional)</Text><TextInput value={draftTime} onChangeText={setDraftTime} placeholder="09:30" placeholderTextColor={muted} style={formInput} /></View>}
      {addKind === "note" && <View style={{ gap: 10, padding: 13, borderRadius: 16, backgroundColor: pale, borderWidth: 1, borderColor: line }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><View style={{ width: 30, height: 30, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: "white" }}><Bell size={15} color={purple} /></View><View style={{ flex: 1 }}><Text style={{ color: ink, fontSize: 12, fontWeight: "700" }}>Reminder</Text><Text style={{ color: muted, fontSize: 9, marginTop: 2 }}>{draftReminderDate ? "Choose when this note should alert you" : "Get an alert for this note"}</Text></View><Switch accessibilityLabel="Enable note reminder" value={!!draftReminderDate} onValueChange={(enabled) => setDraftReminderDate(enabled ? suggestedReminderDate(trip?.start_date, tripDays) : null)} trackColor={{ false: "#DED6E7", true: "#CBB1E9" }} thumbColor={draftReminderDate ? purple : "#FFFFFF"} />
        </View>
        {draftReminderDate && <>
          <Text style={{ color: ink, fontSize: 10, fontWeight: "700" }}>Quick select</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7 }}>
            {[...(trip?.start_date ? [{ date: addDays(trip.start_date, -1), label: "Before trip", sub: formatShortDate(addDays(trip.start_date, -1)) }] : []), ...tripDays.map((date, index) => ({ date, label: `Day ${index + 1}`, sub: formatShortDate(date) }))].map((option) => <Pressable key={option.date} accessibilityRole="button" accessibilityState={{ selected: draftReminderDate === option.date }} onPress={() => setDraftReminderDate(option.date)} style={{ minWidth: 90, borderRadius: 12, borderWidth: 1, borderColor: draftReminderDate === option.date ? purple : line, backgroundColor: draftReminderDate === option.date ? "white" : "rgba(255,255,255,0.65)", paddingHorizontal: 10, paddingVertical: 8 }}><Text style={{ color: draftReminderDate === option.date ? purple : muted, fontSize: 10, fontWeight: "700" }}>{option.label}</Text><Text style={{ color: muted, fontSize: 9, marginTop: 3 }}>{option.sub}</Text></Pressable>)}
          </ScrollView>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><Text style={{ width: 44, color: ink, fontSize: 10, fontWeight: "700" }}>Date</Text><TextInput accessibilityLabel="Reminder date" value={draftReminderDate} onChangeText={(value) => setDraftReminderDate(value.trim())} placeholder="YYYY-MM-DD" placeholderTextColor={muted} keyboardType="numbers-and-punctuation" style={{ ...formInput, flex: 1, minHeight: 40, height: 40, fontSize: 12 }} /></View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><Text style={{ width: 44, color: ink, fontSize: 10, fontWeight: "700" }}>Time</Text><TextInput accessibilityLabel="Reminder time" value={draftReminderTime} onChangeText={setDraftReminderTime} placeholder="09:00" placeholderTextColor={muted} keyboardType="numbers-and-punctuation" style={{ width: 86, height: 40, borderRadius: 12, borderWidth: 1, borderColor: line, backgroundColor: "white", paddingHorizontal: 10, color: ink, textAlign: "center", fontSize: 12, fontWeight: "700" }} /><Text style={{ flex: 1, color: muted, fontSize: 9 }}>Default 09:00 · device local time</Text></View>
          <Text style={{ color: muted, fontSize: 9, lineHeight: 13 }}>A notification will arrive on this device at the selected time.</Text>
        </>}
      </View>}
      <Text style={formLabel}>Choose an icon</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>{(addKind === "activity" ? activityCategories : noteCategories).map(([key, label, Icon]) => <Pressable key={key} onPress={() => setDraftCategory(key)} style={{ flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 18, borderWidth: 1, borderColor: draftCategory === key ? purple : line, backgroundColor: draftCategory === key ? pale : "white", paddingHorizontal: 11, paddingVertical: 9 }}><Icon size={15} color={draftCategory === key ? purple : muted} /><Text style={{ color: draftCategory === key ? purple : muted, fontSize: 12, fontWeight: "600" }}>{label}</Text></Pressable>)}</View>
      {!!formError && <Text accessibilityRole="alert" style={{ color: "#B43F60", fontSize: 12 }}>{formError}</Text>}
      <Button busy={saving} onPress={() => void saveNewItem()} className="min-h-[52px] rounded-full">{`Save ${addKind === "activity" ? "Activity" : "Note"}`}</Button>
    </BottomSheet>
    <Modal visible={deleteRequest !== null} transparent animationType="fade" onRequestClose={() => { if (!deleting) setDeleteRequest(null); }}>
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 20, backgroundColor: "rgba(25, 12, 35, 0.4)" }}>
        <Pressable accessibilityLabel="Close delete confirmation" accessibilityRole="button" disabled={deleting} onPress={() => setDeleteRequest(null)} style={{ position: "absolute", inset: 0 }} />
        <View style={{ width: "100%", maxWidth: 360, backgroundColor: "white", borderRadius: 22, padding: 22, gap: 14 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text accessibilityRole="header" style={{ color: ink, fontSize: 19, fontWeight: "700", fontFamily: "Fredoka" }}>{deleteRequest?.kind === "day" ? `Remove Day ${deleteRequest.dayNumber}?` : deleteRequest?.kind === "activity" ? "Remove activity?" : "Remove note?"}</Text>
            <Pressable accessibilityLabel="Close delete confirmation" accessibilityRole="button" disabled={deleting} onPress={() => setDeleteRequest(null)} style={{ width: 34, height: 34, alignItems: "center", justifyContent: "center" }}><X size={21} color={purple} /></Pressable>
          </View>
          <Text style={{ color: muted, fontSize: 13, lineHeight: 19 }}>{deleteRequest ? getDeleteConfirmationMessage(deleteRequest, trip) : ""}</Text>
          <Pressable accessibilityRole="button" disabled={deleting} onPress={() => setDeleteRequest(null)} style={{ minHeight: 46, borderRadius: 24, borderWidth: 1, borderColor: line, backgroundColor: pale, alignItems: "center", justifyContent: "center", opacity: deleting ? 0.5 : 1 }}><Text style={{ color: purple, fontWeight: "700" }}>Cancel</Text></Pressable>
          <Pressable accessibilityRole="button" accessibilityState={{ busy: deleting, disabled: deleting }} disabled={deleting} onPress={() => void confirmDelete()} style={{ minHeight: 46, borderRadius: 24, borderWidth: 1, borderColor: line, backgroundColor: pale, alignItems: "center", justifyContent: "center", opacity: deleting ? 0.5 : 1 }}><Text style={{ color: "#B43F60", fontWeight: "700" }}>{deleting ? "Removing..." : deleteRequest?.kind === "day" ? "Remove day" : deleteRequest?.kind === "activity" ? "Remove activity" : "Remove note"}</Text></Pressable>
        </View>
      </View>
    </Modal>
  </SafeAreaView>;
}

function WorkspaceHeader({ title, destination, dateRange, id, trips, active, go, onMore, onBack }: { title: string; destination: string; dateRange: string; id: string; trips: Trip[]; active: "itinerary" | "candidates"; go: (mode: ScreenMode) => void; onMore: () => void; onBack: () => void }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const cover = /japan|tokyo|kyoto|osaka|hokkaido/i.test(`${destination} ${title}`) ? require("../../../assets/trip-japan-cover.png") : require("../../../assets/trip-bali-cover.png");
  const selectTrip = (tripId: string) => {
    void rememberTrip(tripId);
    setPickerOpen(false);
    router.replace({ pathname: "/trips/[id]/itinerary", params: { id: tripId } });
  };
  return <View style={{ paddingHorizontal: 20, paddingTop: 4 }}>
    <View style={{ height: 54, flexDirection: "row", alignItems: "center" }}><Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onBack} style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}><ArrowLeft size={23} color={ink} /></Pressable><Text style={{ marginLeft: 8, fontFamily: "Fredoka", fontSize: 21, color: "#3B1454", fontWeight: "700" }}>EGGSPLORE</Text><View style={{ flex: 1 }} /><View style={{ flexDirection: "row", gap: 8 }}><Pressable accessibilityRole="button" accessibilityLabel="Notifications" style={iconButton}><Bell size={24} color={purple} /><View style={notificationDot} /></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Trip options" onPress={onMore} style={iconButton}><MoreHorizontal size={24} color={purple} /></Pressable></View></View>
    <Pressable accessibilityRole="button" accessibilityLabel="Switch trip" onPress={() => setPickerOpen((v) => !v)} style={{ flexDirection: "row", alignItems: "center", backgroundColor: pale, borderRadius: 22, borderWidth: 1, borderColor: line, padding: 10, gap: 11, marginTop: 4 }}><Image source={cover} style={{ width: 66, height: 62, borderRadius: 14 }} /><View style={{ flex: 1, gap: 4 }}><View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}><Text numberOfLines={1} style={{ color: ink, fontFamily: "Fredoka", fontSize: 17, fontWeight: "700", flexShrink: 1 }}>{title}</Text><Text style={{ color: purple, backgroundColor: "#E9DFFA", paddingHorizontal: 7, paddingVertical: 3, borderRadius: 12, fontSize: 9 }}>Planning</Text></View><View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}><UsersRound size={13} color={muted} /><Text style={{ color: muted, fontSize: 10 }}>Travel group</Text></View><View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}><CalendarDays size={13} color={muted} /><Text numberOfLines={1} style={{ color: muted, fontSize: 10, flexShrink: 1 }}>{dateRange}</Text><MapPin size={13} color={muted} /><Text numberOfLines={1} style={{ color: muted, fontSize: 10, flex: 1 }}>{destination}</Text></View></View><ChevronDown size={19} color={purple} style={{ transform: [{ rotate: pickerOpen ? "180deg" : "0deg" }] }} /></Pressable>
    {pickerOpen && <View style={{ backgroundColor: "white", borderWidth: 1, borderColor: line, borderRadius: 16, padding: 5, marginTop: 6 }}>{trips.filter((trip) => trip.id !== id).map((trip) => <Pressable key={trip.id} onPress={() => selectTrip(trip.id)} style={{ padding: 11, borderRadius: 12, flexDirection: "row", alignItems: "center", gap: 8 }}><View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: pale, alignItems: "center", justifyContent: "center" }}><MapPin size={16} color={purple} /></View><View style={{ flex: 1 }}><Text numberOfLines={1} style={{ color: ink, fontWeight: "700", fontSize: 12 }}>{trip.title}</Text><Text numberOfLines={1} style={{ color: muted, fontSize: 10, marginTop: 2 }}>{trip.destination || "Destination to be decided"}</Text></View><ChevronRight size={16} color={muted} /></Pressable>)}{!trips.length && <Text style={{ color: muted, padding: 12, fontSize: 11 }}>Loading your trips...</Text>}</View>}
    <MainTabs active={active} go={go} />
  </View>;
}
function MainTabs({ active, go }: { active: "itinerary" | "candidates"; go: (mode: ScreenMode) => void }) {
  return <View style={{ flexDirection: "row", marginTop: 20, padding: 4, borderRadius: 28, backgroundColor: pale, borderWidth: 1, borderColor: line }}>{([["itinerary", "Itinerary", Plane], ["candidates", "Vote", UsersRound], ["budget", "Budget", Wallet]] as const).map(([key, label, Icon]) => <Pressable key={key} onPress={() => key !== "budget" && go(key)} style={{ flex: 1, minHeight: 44, borderRadius: 24, backgroundColor: active === key ? purple : "transparent", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }}><Icon size={17} color={active === key ? "white" : muted} /><Text numberOfLines={1} style={{ color: active === key ? "white" : muted, fontSize: 11, fontWeight: "600" }}>{label}</Text></Pressable>)}</View>;
}
function TripOverview({ destination, dateRange, itemsCount, openItinerary, openCandidates }: { destination: string; dateRange: string; itemsCount: number; openItinerary: () => void; openCandidates: () => void }) {
  return <View style={{ paddingHorizontal: 20, paddingTop: 20 }}>
    <View style={{ borderRadius: 22, backgroundColor: pale, padding: 18, borderWidth: 1, borderColor: line }}><Text style={{ fontFamily: "Fredoka", fontSize: 22, color: ink, fontWeight: "700" }}>Your trip at a glance</Text><Text style={{ color: muted, marginTop: 3 }}>{destination} - {dateRange}</Text><View style={{ flexDirection: "row", gap: 10, marginTop: 17 }}><Stat icon={<CalendarDays size={18} color={purple} />} label="Dates" value={dateRange} /><Stat icon={<MapPin size={18} color={purple} />} label="Destination" value={destination} /></View></View>
    <Text style={sectionTitle}>Your trip workspace</Text>
    <WorkspaceCard icon={<Plane size={20} color={purple} />} title="Itinerary" subtitle={itemsCount ? `${itemsCount} planned activities` : "Plan the places you want to visit"} action="Open itinerary" onPress={openItinerary} />
    <WorkspaceCard icon={<UsersRound size={20} color={purple} />} title="Candidates & Vote" subtitle="Collect ideas and decide together" action="Explore places" onPress={openCandidates} />
    <View style={{ marginTop: 16, backgroundColor: "white", borderRadius: 20, borderWidth: 1, borderColor: line, padding: 18 }}><Text style={{ fontFamily: "Fredoka", color: ink, fontSize: 18 }}>A little note for your group</Text><Text style={{ color: muted, lineHeight: 20, marginTop: 6 }}>Save the plan as you go. Your itinerary and notes will be ready whenever you open this trip.</Text></View>
  </View>;
}
function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) { return <View style={{ flex: 1, backgroundColor: "white", borderRadius: 15, padding: 12 }}><View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>{icon}<Text style={{ color: muted, fontSize: 11 }}>{label}</Text></View><Text numberOfLines={1} style={{ color: ink, fontWeight: "700", fontSize: 12, marginTop: 8 }}>{value}</Text></View>; }
function WorkspaceCard({ icon, title, subtitle, action, onPress }: { icon: React.ReactNode; title: string; subtitle: string; action: string; onPress: () => void }) { return <Pressable onPress={onPress} style={{ padding: 16, backgroundColor: "white", borderWidth: 1, borderColor: line, borderRadius: 18, marginTop: 10, flexDirection: "row", alignItems: "center", gap: 12 }}><View style={{ width: 44, height: 44, borderRadius: 15, backgroundColor: pale, alignItems: "center", justifyContent: "center" }}>{icon}</View><View style={{ flex: 1 }}><Text style={{ color: ink, fontSize: 16, fontWeight: "700" }}>{title}</Text><Text style={{ color: muted, fontSize: 12, marginTop: 3 }}>{subtitle}</Text></View><View style={{ alignItems: "flex-end" }}><ChevronRight size={18} color={purple} /><Text style={{ color: purple, fontSize: 10, marginTop: 5 }}>{action}</Text></View></Pressable>; }
function WorkspacePlanningCard({ mode, itemsCount, notes }: { mode: "itinerary" | "notes"; itemsCount: number; notes: () => void }) {
  return <View style={{ height: 110, borderRadius: 20, backgroundColor: pale, padding: 15, flexDirection: "row", alignItems: "center", marginBottom: 14 }}>
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>{mode === "notes" ? <Pencil size={12} color={purple} /> : <Plane size={12} color={purple} />}<Text style={{ color: purple, fontSize: 11, fontWeight: "700" }}>{mode === "notes" ? "My Notes" : "Planning"}</Text></View>
      <Text numberOfLines={1} style={{ color: ink, fontFamily: "Fredoka", fontSize: 16, fontWeight: "700", marginTop: 6 }}>{mode === "notes" ? "Your private notes" : itemsCount ? "Your itinerary is ready" : "Start planning your itinerary"}</Text>
      <Text numberOfLines={2} style={{ color: muted, fontSize: 11, marginTop: 4 }}>{mode === "notes" ? "Only you can see these notes." : itemsCount ? "AI draft - Review place details before you go." : "Reorder, edit or add your own stops."}</Text>
    </View>
    <Image source={require("../../../assets/figma-welcome-mascot.png")} resizeMode="contain" style={{ width: 74, height: 72 }} />
    <Pressable onPress={notes} style={{ borderWidth: 1, borderColor: "#DCCCEC", borderRadius: 22, paddingHorizontal: 12, paddingVertical: 9, flexDirection: "row", gap: 5 }}><Pencil size={14} color={purple} /><Text style={{ color: purple, fontWeight: "700", fontSize: 11 }}>Edit</Text></Pressable>
  </View>;
}
function WorkspaceContentTabs({ active, go }: { active: "itinerary" | "notes"; go: (mode: ScreenMode) => void }) {
  return <View style={{ height: 50, flexDirection: "row", backgroundColor: pale, borderRadius: 25, padding: 4, marginBottom: 15 }}>
    {([["itinerary", "Full Itinerary"], ["notes", "My Notes"]] as const).map(([mode, label]) => <Pressable key={mode} onPress={() => go(mode)} style={{ flex: 1, borderRadius: 22, backgroundColor: active === mode ? purple : "transparent", alignItems: "center", justifyContent: "center" }}><Text style={{ color: active === mode ? "white" : muted, fontWeight: active === mode ? "700" : "600", fontSize: 12 }}>{label}</Text></Pressable>)}
  </View>;
}
function ActivityDaySelector({ items, tripDays, date, dayNumber, onChange }: { items: ItineraryItem[]; tripDays: string[]; date: string; dayNumber: number | null; onChange: (date: string, dayNumber: number | null) => void }) {
  const undatedDayNumbers = [...new Set(items.filter((item) => !item.start_time).map((item) => parseLegacyDayDescription(item.description)?.day).filter((value): value is number => value !== undefined))].sort((a, b) => a - b);
  const options = [
    { date: "", dayNumber: null as number | null, label: "Flexible" },
    ...undatedDayNumbers.map((number) => ({ date: "", dayNumber: number, label: `Day ${number} · No date` })),
    ...tripDays.map((tripDate, index) => ({ date: tripDate, dayNumber: index + 1, label: formatTravelDate(tripDate) })),
    ...(date && !tripDays.includes(date) ? [{ date, dayNumber, label: formatTravelDate(date) }] : []),
  ];
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>{options.map((option) => {
    const selected = option.date === date && option.dayNumber === dayNumber;
    const key = option.date ? `date:${option.date}` : `ordinal:${option.dayNumber ?? "flexible"}`;
    return <Pressable key={key} onPress={() => onChange(option.date, option.dayNumber)} style={{ borderRadius: 18, borderWidth: 1, borderColor: selected ? purple : line, backgroundColor: selected ? pale : "white", paddingHorizontal: 12, paddingVertical: 9 }}><Text style={{ color: selected ? purple : muted, fontSize: 12, fontWeight: "600" }}>{option.label}</Text></Pressable>;
  })}</ScrollView>;
}
function ItineraryContent({ items, destination, startDate, endDate, flexibleDayCount, canEdit, isDayExpanded, toggleDay, addActivity, addDay, editActivity, deleteActivity, deleteDay, moveActivity }: { items: ItineraryItem[]; destination: string; startDate?: string | null; endDate?: string | null; flexibleDayCount: number; canEdit: boolean; isDayExpanded: (date: string) => boolean; toggleDay: (date: string) => void; addActivity: (date: string, dayNumber?: number) => void; addDay: () => void; editActivity: (item: ItineraryItem) => void; deleteActivity: (item: ItineraryItem) => void; deleteDay: (date: string, dayNumber: number, dayItems: ItineraryItem[]) => void; moveActivity: (date: string, item: ItineraryItem, offset: number) => void }) {
  const [openMoveControls, setOpenMoveControls] = useState<string | null>(null);
  const days: Record<string, ItineraryItem[]> = {};
  for (const item of items) {
    const date = getItineraryDayKey(item);
    days[date] = [...(days[date] ?? []), item];
  }
  for (const date of Object.keys(days)) days[date].sort(compareItineraryItems);
  if (startDate && endDate) {
    const day = new Date(`${startDate}T00:00:00Z`);
    const last = new Date(`${endDate}T00:00:00Z`);
    while (day <= last) { const date = day.toISOString().slice(0, 10); days[date] ||= []; day.setUTCDate(day.getUTCDate() + 1); }
  }
  if (!startDate || !endDate) {
    const storedFlexibleDays = Math.max(flexibleDayCount, ...Object.keys(days).map((key) => getOrdinalDayNumber(key) ?? 1));
    for (let day = 1; day <= storedFlexibleDays; day++) days[`ordinal:${day}`] ||= [];
  }
  if (!Object.keys(days).length) days.flexible = [];
  const orderedDays = Object.entries(days).sort(([left], [right]) => left === "flexible" ? 1 : right === "flexible" ? -1 : getOrdinalDayNumber(left) !== null && getOrdinalDayNumber(right) !== null ? getOrdinalDayNumber(left)! - getOrdinalDayNumber(right)! : getOrdinalDayNumber(left) !== null ? -1 : getOrdinalDayNumber(right) !== null ? 1 : left.localeCompare(right));
  return <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
    {!canEdit && <Text style={{ color: muted, fontSize: 12, marginBottom: 10 }}>Only the trip organiser can edit this itinerary.</Text>}
    {orderedDays.map(([date, dayItems], dayIndex) => {
      const ordinalDay = getOrdinalDayNumber(date);
      const displayedDay = ordinalDay ?? dayIndex + 1;
      const dayLabel = date === "flexible" ? "Flexible date" : ordinalDay ? `Day ${ordinalDay} · No calendar date` : `${formatTravelDate(date)} - Day ${displayedDay}`;
      const isCalendarDate = /^\d{4}-\d{2}-\d{2}$/.test(date);
      return <View key={date} style={{ backgroundColor: "white", borderRadius: 22, borderWidth: 1, borderColor: line, padding: 16, marginBottom: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Pressable onPress={() => toggleDay(date)} style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={{ width: 58, height: 58, borderRadius: 30, backgroundColor: purple, alignItems: "center", justifyContent: "center" }}><Text style={{ color: "white", fontSize: 11 }}>Day</Text><Text style={{ color: "white", fontFamily: "Fredoka", fontWeight: "700", fontSize: 22 }}>{displayedDay}</Text></View>
            <View style={{ flex: 1 }}><Text style={{ color: muted, fontSize: 11 }}>{dayLabel}</Text><Text numberOfLines={1} style={{ color: ink, fontFamily: "Fredoka", fontWeight: "700", fontSize: 17, marginTop: 5 }}>{dayItems.find((item) => item.location_name)?.location_name || destination}</Text></View>
            <ChevronDown size={17} color={purple} style={{ transform: [{ rotate: isDayExpanded(date) ? "180deg" : "0deg" }] }} />
          </Pressable>
          {canEdit && isCalendarDate && startDate && endDate && date >= startDate && date <= endDate && <Pressable accessibilityRole="button" accessibilityLabel={`Delete Day ${displayedDay}`} onPress={() => deleteDay(date, displayedDay, dayItems)} style={{ width: 38, height: 38, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: pale }}><Trash2 size={16} color={muted} /></Pressable>}
        </View>
        {isDayExpanded(date) && <View style={{ marginTop: 15, borderTopWidth: 1, borderTopColor: line, paddingTop: 6 }}>
          {dayItems.length ? dayItems.map((item, index) => {
            const hasTime = getActivityTime(item) !== null;
            let moveStart = index, moveEnd = index;
            while (moveStart > 0 && (getActivityTime(dayItems[moveStart - 1]) !== null) === hasTime) moveStart--;
            while (moveEnd < dayItems.length - 1 && (getActivityTime(dayItems[moveEnd + 1]) !== null) === hasTime) moveEnd++;
            return <ActivityRow key={item.id} item={item} index={index} moveStart={moveStart} moveEnd={moveEnd} first={index === moveStart} last={index === moveEnd} controls={openMoveControls === item.id} onToggleControls={() => setOpenMoveControls((current) => current === item.id ? null : item.id)} onMove={(targetIndex) => { moveActivity(date, item, targetIndex); setOpenMoveControls(null); }} onEdit={() => editActivity(item)} onDelete={() => deleteActivity(item)} canEdit={canEdit} />;
          }) : <View style={{ alignItems: "center", paddingVertical: 22 }}><Text style={{ color: muted, fontSize: 12 }}>Nothing planned for this day yet.</Text></View>}
          {canEdit && <Pressable onPress={() => addActivity(isCalendarDate ? date : "", ordinalDay ?? undefined)} style={{ borderRadius: 15, borderWidth: 1, borderStyle: "dashed", borderColor: line, backgroundColor: "white", padding: 12, flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 }}><Plus size={17} color={purple} /><Text style={{ color: purple, fontWeight: "700" }}>Add activity</Text></Pressable>}
        </View>}
      </View>;
    })}
    {canEdit && <Pressable onPress={addDay} style={{ borderRadius: 16, borderWidth: 1, borderColor: line, backgroundColor: pale, padding: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}><CalendarDays size={17} color={purple} /><Text style={{ color: purple, fontWeight: "700" }}>{startDate && endDate ? "Add day to trip" : "Add flexible day"}</Text></Pressable>}
  </View>;
}
function ActivityRow({ item, index, moveStart, moveEnd, first, last, controls, onToggleControls, onMove, onEdit, onDelete, canEdit }: { item: ItineraryItem; index: number; moveStart: number; moveEnd: number; first: boolean; last: boolean; controls: boolean; onToggleControls: () => void; onMove: (targetIndex: number) => void; onEdit: () => void; onDelete: () => void; canEdit: boolean }) {
  const dragY = useRef<number | null>(null);
  const legacyCategory = item.description?.startsWith("category:") ? item.description.slice(9) : "";
  const category = item.activity_category || legacyCategory;
  const Icon = activityCategories.find(([key]) => key === category)?.[2] ?? (index % 3 === 0 ? Plane : index % 3 === 1 ? TrainFront : Utensils);
  const detail = legacyCategory || parseLegacyDayDescription(item.description) ? "" : item.description;
  const displayTime = item.start_time?.slice(11, 16) ?? parseLegacyDayDescription(item.description)?.time ?? "--:--";
  return <View style={{ borderBottomWidth: 1, borderBottomColor: line }}>
  <View style={{ flexDirection: "row", alignItems: "center", minHeight: 72, gap: 8 }}>
    {canEdit && <View onStartShouldSetResponder={() => true} onResponderGrant={(event) => { dragY.current = event.nativeEvent.pageY; }} onResponderRelease={(event) => { const delta = event.nativeEvent.pageY - (dragY.current ?? event.nativeEvent.pageY); if (Math.abs(delta) > 24) { const steps = Math.max(1, Math.round(Math.abs(delta) / 78)); const target = Math.max(moveStart, Math.min(moveEnd, index + (delta > 0 ? steps : -steps))); if (target !== index) onMove(target); } else onToggleControls(); dragY.current = null; }} accessibilityRole="button" accessibilityLabel={`Reorder ${item.title}. Drag to another position or tap for move controls.`} style={{ width: 20, alignItems: "center", justifyContent: "center", paddingVertical: 15 }}><GripVertical size={15} color={controls ? purple : "#CFCCD8"} /></View>}
    <View style={{ width: 8, alignItems: "center" }}><View style={{ width: 8, height: 8, borderRadius: 5, backgroundColor: purple }} /></View>
    <Text style={{ width: 44, color: muted, fontSize: 12 }}>{displayTime}</Text>
    <View style={{ width: 42, height: 42, borderRadius: 24, backgroundColor: pale, alignItems: "center", justifyContent: "center" }}><Icon size={19} color={purple} /></View>
    <Pressable onPress={canEdit ? onEdit : undefined} style={{ flex: 1, paddingVertical: 9 }}><Text numberOfLines={1} style={{ color: ink, fontWeight: "700", fontSize: 13 }}>{item.title}</Text><Text numberOfLines={1} style={{ color: muted, fontSize: 11, marginTop: 4 }}>{[item.location_name, detail].filter(Boolean).join(" - ") || "Activity"}</Text></Pressable>
    {canEdit && <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${item.title}`} onPress={onEdit} style={{ padding: 7 }}><Pencil size={15} color={purple} /></Pressable>}
    {canEdit && <Pressable accessibilityRole="button" accessibilityLabel={`Delete ${item.title}`} onPress={onDelete} style={{ padding: 7 }}><Trash2 size={15} color={muted} /></Pressable>}
  </View>
  {canEdit && controls && <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 8, paddingBottom: 8 }}>
    <Pressable accessibilityRole="button" accessibilityLabel={`Move ${item.title} up`} disabled={first} onPress={() => onMove(index - 1)} style={{ flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 24, borderWidth: 1, borderColor: line, backgroundColor: pale, paddingHorizontal: 10, paddingVertical: 10, opacity: first ? 0.4 : 1 }}><ArrowUp size={14} color={purple} /><Text style={{ color: purple }}>Move up</Text></Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel={`Move ${item.title} down`} disabled={last} onPress={() => onMove(index + 1)} style={{ flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 24, borderWidth: 1, borderColor: line, backgroundColor: pale, paddingHorizontal: 10, paddingVertical: 10, opacity: last ? 0.4 : 1 }}><ArrowDown size={14} color={purple} /><Text style={{ color: purple }}>Move down</Text></Pressable>
  </View>}
  </View>;
}

function NotesContent({ items, value, onChange, onToggleNote, destination, tripDays, addNote, editNote, deleteNote, loading, syncError, reminderNotice }: { items: NoteItem[]; value: string; onChange: (value: string) => void; onToggleNote: (note: NoteItem) => void; destination: string; tripDays: string[]; addNote: () => void; editNote: (note: NoteItem) => void; deleteNote: (note: NoteItem) => void; loading: boolean; syncError: string; reminderNotice: string }) {
  const total = items.length;
  const completed = items.filter((item) => item.done).length;
  const pending = items.filter((item) => !item.done);
  const beforeTrip = items.filter((item) => item.reminderDay === -1);
  const dayNotes = tripDays.map((date, index) => ({ day: index + 1, date, items: items.filter((item) => item.reminderDay === index + 1) })).filter((group) => group.items.length > 0);
  const placed = new Set([...beforeTrip, ...dayNotes.flatMap((group) => group.items)].map((item) => item.id));
  const otherNotes = items.filter((item) => !placed.has(item.id));
  const nextReminder = pending.find((item) => item.reminderDate || (item.reminderDay !== null && item.reminderDay !== undefined));
  const nextReminderLabel = nextReminder ? reminderLabel(nextReminder.reminderDay, tripDays, nextReminder.reminderDate) : null;
  const renderGroup = (heading: string, helper: string, groupItems: NoteItem[]) => groupItems.length ? <View key={heading} style={{ marginTop: 16 }}>
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}><View><Text style={{ color: ink, fontFamily: "Fredoka", fontSize: 16, fontWeight: "700" }}>{heading}</Text><Text style={{ color: muted, fontSize: 10, marginTop: 2 }}>{helper}</Text></View><Text style={{ color: purple, fontSize: 10, fontWeight: "700" }}>{groupItems.filter((item) => item.done).length}/{groupItems.length}</Text></View>
    {groupItems.map((note) => <NoteCard key={note.id} note={note} tripDays={tripDays} onToggle={() => onToggleNote(note)} onEdit={() => editNote(note)} onDelete={() => deleteNote(note)} />)}
  </View> : null;

  return <View style={{ paddingHorizontal: 20 }}>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 }}><Pencil size={13} color={purple} /><Text style={{ color: muted, fontWeight: "600", fontSize: 11 }}>Your private trip checklist and notes</Text><View style={{ flex: 1 }} /><View style={{ borderRadius: 12, backgroundColor: pale, paddingHorizontal: 8, paddingVertical: 4 }}><Text style={{ color: purple, fontSize: 9, fontWeight: "700" }}>ONLY YOU</Text></View></View>
    {!!syncError && <Text accessibilityRole="alert" style={{ color: "#B43F60", fontSize: 12, marginBottom: 10 }}>{syncError}</Text>}
    {!!reminderNotice && <View accessibilityRole="alert" style={{ backgroundColor: pale, borderRadius: 12, borderWidth: 1, borderColor: line, padding: 10, marginBottom: 10 }}><Text style={{ color: purple, fontSize: 11, fontWeight: "600" }}>{reminderNotice}</Text></View>}
    {loading ? <Text style={{ color: muted, padding: 24, textAlign: "center" }}>Loading your private notes...</Text> : <>
      <View style={{ backgroundColor: pale, borderRadius: 20, borderWidth: 1, borderColor: line, padding: 15 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}><View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: "white", alignItems: "center", justifyContent: "center" }}><Check size={21} color={purple} /></View><View style={{ flex: 1 }}><Text style={{ color: ink, fontFamily: "Fredoka", fontSize: 17, fontWeight: "700" }}>Trip prep</Text><Text style={{ color: muted, fontSize: 11, marginTop: 2 }}>{completed} of {total} items completed</Text></View><Text style={{ color: purple, fontFamily: "Fredoka", fontSize: 18, fontWeight: "700" }}>{total ? `${Math.round(completed / total * 100)}%` : "—"}</Text></View>
        <View style={{ height: 7, borderRadius: 5, backgroundColor: "#E5D9F2", overflow: "hidden", marginTop: 13 }}><View style={{ width: `${total ? Math.round(completed / total * 100) : 0}%`, height: 7, borderRadius: 5, backgroundColor: purple }} /></View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 10 }}><CalendarDays size={13} color={purple} /><Text style={{ color: muted, fontSize: 10 }}>{nextReminderLabel ? `Next reminder: ${nextReminderLabel}` : pending.length ? "Add a reminder for your next travel task" : total ? "You are all set for this trip!" : `Start a checklist for ${destination}`}</Text></View>
      </View>
      {!total && <View style={{ alignItems: "center", backgroundColor: "white", borderRadius: 18, borderWidth: 1, borderColor: line, padding: 20, marginTop: 12 }}><View style={{ width: 46, height: 46, borderRadius: 24, backgroundColor: pale, alignItems: "center", justifyContent: "center", marginBottom: 9 }}><Bell size={21} color={purple} /></View><Text style={{ color: ink, fontFamily: "Fredoka", fontSize: 16, fontWeight: "700" }}>Get trip-ready, one step at a time</Text><Text style={{ color: muted, fontSize: 11, lineHeight: 17, marginTop: 5, textAlign: "center" }}>Keep packing tasks, booking reminders and private ideas together.</Text></View>}
      {renderGroup("Before your trip", "Get these ready before you leave", beforeTrip)}
      {dayNotes.map((group) => renderGroup(`Day ${group.day}${group.date ? ` · ${formatTravelDate(group.date)}` : ""}`, "Reminders for this trip day", group.items))}
      {renderGroup("Notes & ideas", "Unscheduled checklist items and personal notes", otherNotes)}
      <Pressable onPress={addNote} style={{ borderRadius: 15, borderWidth: 1, borderStyle: "dashed", borderColor: "#DCCCEC", backgroundColor: "white", padding: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 15 }}><Plus size={18} color={purple} /><Text style={{ color: purple, fontWeight: "700" }}>Add reminder or note</Text></Pressable>
      {!!value && <TextInput value={value} onChangeText={onChange} placeholder="Additional private note" style={{ marginTop: 12, backgroundColor: "white", borderColor: line, borderWidth: 1, borderRadius: 14, padding: 12, color: ink }} />}
    </>}
  </View>;
}

function NoteCard({ note, tripDays, onToggle, onEdit, onDelete }: { note: NoteItem; tripDays: string[]; onToggle: () => void; onEdit: () => void; onDelete: () => void }) {
  const Icon = note.icon === "umbrella" ? Umbrella : note.icon === "bag" ? Luggage : note.icon === "thought" ? Cloud : noteCategories.find(([key]) => key === note.icon)?.[2] ?? Pencil;
  const due = reminderLabel(note.reminderDay, tripDays, note.reminderDate);
  return <View style={{ minHeight: 78, backgroundColor: "white", borderRadius: 17, borderWidth: 1, borderColor: line, padding: 10, marginBottom: 8, flexDirection: "row", alignItems: "center", gap: 8 }}>
    <Pressable accessibilityRole="button" accessibilityLabel={note.done ? `Mark ${note.title} incomplete` : `Mark ${note.title} complete`} accessibilityState={{ checked: !!note.done }} onPress={onToggle} style={{ width: 27, minHeight: 40, alignItems: "center", justifyContent: "center" }}>{note.done ? <SquareCheckBig size={20} color={purple} /> : <Circle size={20} color="#D9C9E9" />}</Pressable>
    <View style={{ width: 40, height: 40, borderRadius: 15, backgroundColor: pale, alignItems: "center", justifyContent: "center" }}><Icon size={19} color={purple} /></View>
    <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${note.title}`} onPress={onEdit} style={{ flex: 1, paddingVertical: 6 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}><Text numberOfLines={2} style={{ flex: 1, color: note.done ? muted : ink, fontWeight: "700", fontSize: 12, textDecorationLine: note.done ? "line-through" : "none" }}>{note.title}</Text>{due && <View style={{ flexDirection: "row", alignItems: "center", gap: 3, borderRadius: 10, backgroundColor: pale, paddingHorizontal: 6, paddingVertical: 4 }}><CalendarDays size={10} color={purple} /><Text style={{ color: purple, fontSize: 8, fontWeight: "700" }}>{due}{note.reminderTime ? ` · ${note.reminderTime}` : ""}</Text></View>}</View>
      {!!note.detail && note.detail !== "Personal note" && <Text numberOfLines={1} style={{ color: muted, fontSize: 10, marginTop: 4 }}>{note.detail}</Text>}
    </Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${note.title}`} onPress={onEdit} style={{ padding: 5 }}><Pencil size={14} color={purple} /></Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel={`Delete ${note.title}`} onPress={onDelete} style={{ padding: 5 }}><Trash2 size={14} color={muted} /></Pressable>
  </View>;
}

function reminderLabel(reminderDay: number | null | undefined, tripDays: string[], reminderDate?: string | null) {
  if (reminderDay === -1) return reminderDate ? `Before trip · ${formatShortDate(reminderDate)}` : "Before trip";
  if (!reminderDay) return reminderDate ? formatShortDate(reminderDate) : null;
  const date = tripDays[reminderDay - 1];
  return date ? `Day ${reminderDay} · ${formatShortDate(reminderDate ?? date)}` : reminderDate ? formatShortDate(reminderDate) : `Day ${reminderDay}`;
}

function formatShortDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}
function addDays(value: string, amount: number) { const date = new Date(`${value}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + amount); return date.toISOString().slice(0, 10); }
function suggestedReminderDate(startDate?: string | null, tripDays: string[] = []) {
  const now = new Date();
  const candidates = [...(startDate ? [addDays(startDate, -1)] : []), ...tripDays];
  const firstFutureTripDate = candidates.find((date) => {
    const [year, month, day] = date.split("-").map(Number);
    return new Date(year, month - 1, day, 9, 0, 0).getTime() > now.getTime();
  });
  if (firstFutureTripDate) return firstFutureTripDate;
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;
}
function isValidDate(value: string) { if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false; const date = new Date(`${value}T12:00:00Z`); return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value; }
function getReminderDay(date: string, tripDays: string[], startDate?: string | null) {
  if (startDate && date === addDays(startDate, -1)) return -1;
  const index = tripDays.indexOf(date);
  return index >= 0 ? index + 1 : null;
}
const iconButton = { width: 40, height: 40, alignItems: "center" as const, justifyContent: "center" as const, position: "relative" as const };
const notificationDot = { position: "absolute" as const, width: 8, height: 8, borderRadius: 4, top: 8, right: 8, backgroundColor: "#BD4C42", borderWidth: 1, borderColor: "#FBF9FD" };
const sectionTitle = { color: ink, fontFamily: "Fredoka", fontWeight: "700" as const, fontSize: 20 };
function getItineraryDayKey(item: ItineraryItem) { return item.start_time?.slice(0, 10) || (parseLegacyDayDescription(item.description) ? `ordinal:${parseLegacyDayDescription(item.description)!.day}` : "flexible"); }
function getActivityTime(item: ItineraryItem) { return item.start_time?.slice(11, 16) ?? parseLegacyDayDescription(item.description)?.time ?? null; }
function compareItineraryItems(left: ItineraryItem, right: ItineraryItem) {
  const leftTime = getActivityTime(left), rightTime = getActivityTime(right);
  if (leftTime !== null && rightTime === null) return -1;
  if (leftTime === null && rightTime !== null) return 1;
  if (leftTime !== null && rightTime !== null && leftTime !== rightTime) return leftTime.localeCompare(rightTime);
  return left.position - right.position || left.id.localeCompare(right.id);
}
function swapLegacyActivityTime(description: string | null, otherDescription: string | null) {
  const otherTime = otherDescription?.match(/(?:[01]\d|2[0-3]):[0-5]\d/)?.[0];
  if (!description || !otherTime || !getLegacyTime(description)) return description;
  return description.replace(/(?:[01]\d|2[0-3]):[0-5]\d/, otherTime);
}
function getLegacyTime(description: string) { return description.match(/(?:[01]\d|2[0-3]):[0-5]\d/)?.[0] ?? null; }
function getOrdinalDayNumber(dayKey: string) { const match = dayKey.match(/^ordinal:(\d+)$/); return match ? Number(match[1]) : null; }
function parseLegacyDayDescription(description: string | null | undefined) {
  const match = description?.match(/^Day (\d+)(?:\s+.*?(\d{2}:\d{2}))?$/);
  return match ? { day: Number(match[1]), time: match[2] } : null;
}
function getDeleteConfirmationMessage(request: DeleteRequest, trip: Trip | null) {
  if (request.kind === "activity") return `Remove ${request.item.title} from this itinerary?`;
  if (request.kind === "note") return `Delete ${request.item.title}?`;
  const details = [`Remove ${formatTravelDate(request.date)} from this trip?`];
  if (request.activityCount) details.push(`This will also delete ${request.activityCount} ${request.activityCount === 1 ? "activity" : "activities"}.`);
  if (trip?.start_date === trip?.end_date) details.push("Trip dates will be cleared.");
  else {
    details.push("Trip end date will move one day earlier.");
    if (trip?.end_date && request.date < trip.end_date) details.push("Later days and activities will move one day earlier.");
  }
  return details.join(" ");
}
function formatRange(start?: string | null, end?: string | null) { if (!start && !end) return "Dates to be decided"; const f = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }); return (start ? f(start) : "Flexible") + (end ? " - " + f(end) : ""); }
function formatTravelDate(value: string) { const [year, month, day] = value.split("-").map(Number); const date = new Date(Date.UTC(year, month - 1, day, 12)); return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(date); }
function normalizeNoteItems(value: unknown): NoteItem[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is NoteItem => !!item && typeof item === "object" && typeof item.id === "string" && typeof item.title === "string" && typeof item.detail === "string").map((item) => ({ ...item, done: Boolean(item.done) }));
}
function parseCachedNotes(rawItems: string | null, rawText: string | null) {
  let items: NoteItem[] = [];
  let text = rawText ?? "";
  if (rawItems !== null) {
    try {
      const parsed: unknown = JSON.parse(rawItems);
      if (Array.isArray(parsed)) items = normalizeNoteItems(parsed);
      else if (typeof parsed === "string" && !text) text = parsed;
    } catch { if (!text) text = rawItems; }
  }
  return { items, text, hasData: rawItems !== null || rawText !== null };
}
