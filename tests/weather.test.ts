import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildRainAlerts,
  formatTime12,
  isOutdoor,
  localNow,
  rainChanceAt,
  type Forecast,
  type WeatherItem,
} from "../src/features/notifications/weather";

function forecast(chances: Record<string, number | null> = {}): Forecast {
  const time: string[] = [];
  const precipitation_probability: (number | null)[] = [];
  for (const day of ["2026-10-11", "2026-10-12", "2026-10-13"]) {
    for (let h = 0; h < 24; h++) {
      const t = `${day}T${String(h).padStart(2, "0")}:00`;
      time.push(t);
      precipitation_probability.push(t in chances ? chances[t] : 10);
    }
  }
  return { time, precipitation_probability, utc_offset_seconds: 32400 };
}

// 12:00 on 11 Oct in a UTC+9 place
const NOW = Date.UTC(2026, 9, 11, 3, 0, 0);
const item = (over: Partial<WeatherItem> = {}): WeatherItem => ({
  id: "a1",
  title: "Senso-ji Temple",
  activity_category: "sightseeing",
  location_name: "Asakusa",
  start_time: "2026-10-11T14:00:00Z",
  ...over,
});
const outdoor = (over: Partial<WeatherItem>) =>
  isOutdoor({ title: "", location_name: null, activity_category: null, ...over });

test("outdoor rule uses categories, vibes, names, then the sightseeing category", () => {
  assert.equal(outdoor({ title: "Senso-ji Temple", activity_category: "sightseeing" }), true);
  assert.equal(outdoor({ title: "Ramen dinner", activity_category: "food" }), false);
  assert.equal(outdoor({ title: "Tokyo National Museum", activity_category: "sightseeing" }), false);
  assert.equal(outdoor({ title: "Picnic at Yoyogi Park", activity_category: "food" }), true);
  assert.equal(
    outdoor({ title: "Climb Mt Fuji", activity_category: "transport", location_categories: ["natural.mountain.peak"] }),
    true,
  );
  assert.equal(
    outdoor({ title: "Exhibit", activity_category: "sightseeing", location_categories: ["entertainment.museum"] }),
    false,
  );
  assert.equal(outdoor({ title: "Lunch", activity_category: "food", vibe_tags: ["Nature"] }), true);
  assert.equal(outdoor({ title: "Hotel check-in", activity_category: "stay" }), false);
  assert.equal(outdoor({ title: "Free time" }), false);
});

test("local time and clock formatting", () => {
  assert.equal(localNow(32400, NOW), "2026-10-11T12:00");
  assert.equal(formatTime12("2026-10-11T14:00"), "2:00 PM");
  assert.equal(formatTime12("2026-10-11T00:30"), "12:30 AM");
  assert.equal(formatTime12("2026-10-11T12:05"), "12:05 PM");
  assert.equal(formatTime12("2026-10-11T09:00"), "9:00 AM");
});

test("rain chance is read for the activity's hour and may be missing", () => {
  assert.equal(rainChanceAt(forecast({ "2026-10-11T14:00": 70 }), "2026-10-11T14:30"), 70);
  assert.equal(rainChanceAt(forecast({ "2026-10-11T14:00": null }), "2026-10-11T14:00"), null);
  assert.equal(rainChanceAt(forecast(), "2026-10-20T10:00"), null);
});

test("a likely-rain outdoor activity produces one readable alert", () => {
  const alerts = buildRainAlerts([item()], () => forecast({ "2026-10-11T14:00": 70 }), NOW);
  assert.deepEqual(alerts, [
    {
      key: "weather:a1:2026-10-11",
      item_id: "a1",
      title: "Rain likely for Senso-ji Temple",
      body: "Today at 2:00 PM · 70% chance of rain",
    },
  ]);
});

test("day labels read Tomorrow and then a date", () => {
  const tomorrow = buildRainAlerts(
    [item({ start_time: "2026-10-12T10:00:00Z" })],
    () => forecast({ "2026-10-12T10:00": 80 }),
    NOW,
  );
  assert.equal(tomorrow[0].body, "Tomorrow at 10:00 AM · 80% chance of rain");
  const later = buildRainAlerts(
    [item({ start_time: "2026-10-13T10:00:00Z" })],
    () => forecast({ "2026-10-13T10:00": 80 }),
    NOW,
  );
  assert.equal(later[0].body, "13 Oct at 10:00 AM · 80% chance of rain");
});

test("the threshold is inclusive at 60", () => {
  assert.equal(buildRainAlerts([item()], () => forecast({ "2026-10-11T14:00": 59 }), NOW).length, 0);
  assert.equal(buildRainAlerts([item()], () => forecast({ "2026-10-11T14:00": 60 }), NOW).length, 1);
});

test("indoor, undated, unforecast, past and far-away activities are skipped", () => {
  const wet = forecast({
    "2026-10-11T14:00": 90,
    "2026-10-11T09:00": 90,
    "2026-10-13T20:00": 90,
  });
  assert.equal(buildRainAlerts([item({ title: "Tokyo National Museum" })], () => wet, NOW).length, 0);
  assert.equal(buildRainAlerts([item({ start_time: null })], () => wet, NOW).length, 0);
  assert.equal(buildRainAlerts([item()], () => null, NOW).length, 0);
  assert.equal(buildRainAlerts([item({ start_time: "2026-10-11T09:00:00Z" })], () => wet, NOW).length, 0);
  assert.equal(buildRainAlerts([item({ start_time: "2026-10-13T20:00:00Z" })], () => wet, NOW).length, 0);
  assert.equal(
    buildRainAlerts(
      [item({ start_time: "2026-10-13T11:00:00Z" })],
      () => forecast({ "2026-10-13T11:00": 90 }),
      NOW,
    ).length,
    1,
  );
});

test("each activity gets its own key", () => {
  const f = forecast({ "2026-10-11T14:00": 70, "2026-10-11T16:00": 70 });
  const alerts = buildRainAlerts(
    [item(), item({ id: "a2", title: "Ueno Park", start_time: "2026-10-11T16:00:00Z" })],
    () => f,
    NOW,
  );
  assert.deepEqual(alerts.map((a) => a.key), ["weather:a1:2026-10-11", "weather:a2:2026-10-11"]);
});