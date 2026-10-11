export type WeatherItem = {
  id: string;
  title: string;
  activity_category: string | null;
  location_name: string | null;
  start_time: string | null;
  latitude?: number | null;
  longitude?: number | null;
  location_categories?: string[] | null;
  vibe_tags?: string[] | null;
};

// Hourly times are in the place's own timezone, like Open-Meteo returns them.
export type Forecast = {
  time: string[];
  precipitation_probability: (number | null)[];
  utc_offset_seconds: number;
};

export type RainAlert = { key: string; item_id: string; title: string; body: string };

// Change the 60 to 0 to test with any forecast, then change it back.
export const RAIN_THRESHOLD = 60;
export const WINDOW_HOURS = 48;

const OUTDOOR_CATEGORY =
  /^(natural|national_park|beach|camping)|^leisure\.(park|garden|nature|picnic|marina|playground)|^tourism\.(attraction|sights)|^heritage|^entertainment\.(zoo|theme_park)/;
const INDOOR_CATEGORY =
  /^entertainment\.(museum|culture|cinema|aquarium|planetarium|escape_game|bowling_alley)|^(commercial|catering|accommodation|healthcare|service|office)/;
const OUTDOOR_WORDS =
  /\b(park|beach|garden|gardens|hike|hiking|trail|market|zoo|island|mountain|river|lake|waterfall|shrine|temple|castle|viewpoint|bridge|tower|walk|cruise|picnic)\b/i;
const INDOOR_WORDS =
  /\b(museum|aquarium|mall|cinema|gallery|theatre|theater|restaurant|cafe|hotel|spa|indoor|planetarium|library|arcade)\b/i;

// Provider categories first, then the Nature vibe, then words in the name,
// then the plain "sightseeing" category. Indoor signals win over outdoor ones.
export function isOutdoor(
  item: Pick<
    WeatherItem,
    "title" | "location_name" | "activity_category" | "location_categories" | "vibe_tags"
  >,
): boolean {
  const categories = item.location_categories ?? [];
  if (categories.some((c) => INDOOR_CATEGORY.test(c))) return false;
  if (categories.some((c) => OUTDOOR_CATEGORY.test(c))) return true;
  if ((item.vibe_tags ?? []).includes("Nature")) return true;
  const text = `${item.title} ${item.location_name ?? ""}`;
  if (INDOOR_WORDS.test(text)) return false;
  if (OUTDOOR_WORDS.test(text)) return true;
  return item.activity_category === "sightseeing";
}

const DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// B stores the time the user typed with a Z on the end, so read it as plain
// local clock time ("YYYY-MM-DDTHH:MM"), never convert it.
export function activityLocalTime(item: Pick<WeatherItem, "start_time">): string | null {
  const value = item.start_time;
  return value && DATE_TIME.test(value) ? value.slice(0, 16) : null;
}

const naive = (local: string) => Date.parse(`${local}:00Z`);

export function localNow(offsetSeconds: number, nowMs: number): string {
  return new Date(nowMs + offsetSeconds * 1000).toISOString().slice(0, 16);
}

export function rainChanceAt(forecast: Forecast, localTime: string): number | null {
  const hour = localTime.slice(0, 13);
  const index = forecast.time.findIndex((t) => t.slice(0, 13) === hour);
  if (index < 0) return null;
  const value = forecast.precipitation_probability[index];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function formatTime12(localTime: string): string {
  const [h, m] = localTime.slice(11, 16).split(":").map(Number);
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

export function dayLabel(date: string, todayLocal: string): string {
  if (date === todayLocal) return "Today";
  const tomorrow = new Date(naive(`${todayLocal}T00:00`) + 86_400_000)
    .toISOString()
    .slice(0, 10);
  if (date === tomorrow) return "Tomorrow";
  const [, month, day] = date.split("-").map(Number);
  return `${day} ${MONTHS[month - 1]}`;
}

export function buildRainAlerts(
  items: WeatherItem[],
  forecastFor: (item: WeatherItem) => Forecast | null,
  nowMs: number,
  options: { threshold?: number; windowHours?: number } = {},
): RainAlert[] {
  const threshold = options.threshold ?? RAIN_THRESHOLD;
  const windowHours = options.windowHours ?? WINDOW_HOURS;
  const alerts: RainAlert[] = [];
  for (const item of items) {
    const when = activityLocalTime(item);
    if (!when || Number.isNaN(naive(when)) || !isOutdoor(item)) continue;
    const forecast = forecastFor(item);
    if (!forecast) continue;
    const now = localNow(forecast.utc_offset_seconds, nowMs);
    const hoursAway = (naive(when) - naive(now)) / 3_600_000;
    if (hoursAway < -1 || hoursAway > windowHours) continue;
    const chance = rainChanceAt(forecast, when);
    if (chance === null || chance < threshold) continue;
    const date = when.slice(0, 10);
    alerts.push({
      key: `weather:${item.id}:${date}`,
      item_id: item.id,
      title: `Rain likely for ${item.title}`,
      body: `${dayLabel(date, now.slice(0, 10))} at ${formatTime12(when)} · ${Math.round(chance)}% chance of rain`,
    });
  }
  return alerts;
}