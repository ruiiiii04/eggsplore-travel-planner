import AsyncStorage from "@react-native-async-storage/async-storage";
import { getSupabase } from "@/lib/supabase";
import { localDate, tripStatus } from "@/features/trips/model";
import { buildRainAlerts, type Forecast, type WeatherItem } from "./weather";

type TripRow = {
  id: string;
  destination: string | null;
  start_date: string | null;
  end_date: string | null;
};
type Point = { lat: number; lon: number };

const MIN_GAP_MS = 5 * 60 * 1000;
const FORECAST_TTL_MS = 30 * 60 * 1000;
const DAY_MS = 86_400_000;
const BASE_COLUMNS =
  "id,title,description,activity_category,location_name,start_time,latitude,longitude";
const FULL_COLUMNS = `${BASE_COLUMNS},location_categories,vibe_tags`;

const forecasts = new Map<string, { at: number; data: Forecast }>();
const places = new Map<string, Point | null>();
const sent = new Set<string>();
let lastRun = 0;
let running = false;

const pointKey = (p: Point) => `${p.lat.toFixed(2)},${p.lon.toFixed(2)}`;

// The weather service answers with loosely shaped JSON, so this is untyped on purpose.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchJson(url: string): Promise<any | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    return response.ok ? await response.json() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function geocode(destination: string): Promise<Point | null> {
  const name = destination.split(",")[0].trim();
  if (name.length < 2) return null;
  const key = name.toLowerCase();
  if (places.has(key)) return places.get(key) ?? null;
  const storageKey = `eggsplore:geo:${key}`;
  try {
    const stored = await AsyncStorage.getItem(storageKey);
    const parsed = stored ? JSON.parse(stored) : null;
    if (parsed && Number.isFinite(parsed.lat) && Number.isFinite(parsed.lon)) {
      places.set(key, parsed);
      return parsed;
    }
  } catch {
    // Fall through to a fresh lookup.
  }
  const data = await fetchJson(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1&language=en&format=json`,
  );
  const hit = data?.results?.[0];
  const point =
    hit && Number.isFinite(hit.latitude) && Number.isFinite(hit.longitude)
      ? { lat: hit.latitude as number, lon: hit.longitude as number }
      : null;
  places.set(key, point);
  if (point) await AsyncStorage.setItem(storageKey, JSON.stringify(point)).catch(() => undefined);
  return point;
}

async function getForecast(point: Point): Promise<Forecast | null> {
  const key = pointKey(point);
  const cached = forecasts.get(key);
  if (cached && Date.now() - cached.at < FORECAST_TTL_MS) return cached.data;
  const data = await fetchJson(
    `https://api.open-meteo.com/v1/forecast?latitude=${point.lat}&longitude=${point.lon}&hourly=precipitation_probability&forecast_days=3&timezone=auto`,
  );
  if (!data?.hourly?.time || !Array.isArray(data.hourly.precipitation_probability)) return null;
  const forecast: Forecast = {
    time: data.hourly.time,
    precipitation_probability: data.hourly.precipitation_probability,
    utc_offset_seconds: Number(data.utc_offset_seconds) || 0,
  };
  forecasts.set(key, { at: Date.now(), data: forecast });
  return forecast;
}

async function loadItems(tripId: string): Promise<WeatherItem[]> {
  const db = getSupabase();
  // The extra columns only exist once migration 024 has been applied.
  let result: { data: unknown; error: unknown } = await db
    .from("itinerary_items")
    .select(FULL_COLUMNS)
    .eq("trip_id", tripId);
  if (result.error) {
    result = await db.from("itinerary_items").select(BASE_COLUMNS).eq("trip_id", tripId);
  }
  return result.error ? [] : ((result.data ?? []) as WeatherItem[]);
}

async function checkTrip(trip: TripRow, nowMs: number): Promise<number> {
  const earliest = localDate(new Date(nowMs - DAY_MS));
  const latest = localDate(new Date(nowMs + 3 * DAY_MS));
  const items = (await loadItems(trip.id)).filter((item) => {
    const day = item.start_time?.slice(0, 10);
    return !!day && day >= earliest && day <= latest;
  });
  if (items.length === 0) return 0;

  const fallback = trip.destination ? await geocode(trip.destination) : null;
  const pointOf = (item: WeatherItem): Point | null =>
    typeof item.latitude === "number" && typeof item.longitude === "number"
      ? { lat: item.latitude, lon: item.longitude }
      : fallback;

  const wanted = new Map<string, Point>();
  for (const item of items) {
    const point = pointOf(item);
    if (point) wanted.set(pointKey(point), point);
  }
  const byPoint = new Map<string, Forecast | null>();
  await Promise.all(
    Array.from(wanted, async ([key, point]) => {
      byPoint.set(key, await getForecast(point));
    }),
  );

  const alerts = buildRainAlerts(
    items,
    (item) => {
      const point = pointOf(item);
      return point ? (byPoint.get(pointKey(point)) ?? null) : null;
    },
    nowMs,
  )
    .filter((alert) => !sent.has(alert.key))
    .slice(0, 10);
  if (alerts.length === 0) return 0;

  const { data, error } = await getSupabase().rpc("create_weather_alerts", {
    target_trip: trip.id,
    alerts,
  });
  if (error) return 0;
  alerts.forEach((alert) => sent.add(alert.key));
  return typeof data === "number" ? data : 0;
}

// Returns true when new alerts were created, so the caller can refresh the list.
export async function runWeatherCheck(
  options: { force?: boolean } = {},
): Promise<boolean> {
  const now = Date.now();
  if (running || (!options.force && now - lastRun < MIN_GAP_MS)) return false;
  running = true;
  lastRun = now;
  let created = 0;
  try {
    const { data, error } = await getSupabase()
      .from("trips")
      .select("id,destination,start_date,end_date");
    if (error) return false;
    const soon = localDate(new Date(now + 3 * DAY_MS));
    const trips = ((data ?? []) as TripRow[]).filter(
      (trip) => !!trip.start_date && tripStatus(trip) !== "Past" && trip.start_date <= soon,
    );
    for (const trip of trips) created += await checkTrip(trip, now);
  } catch {
    // Weather alerts are a bonus, so a failure here is never shown to the user.
  } finally {
    running = false;
  }
  return created > 0;
}