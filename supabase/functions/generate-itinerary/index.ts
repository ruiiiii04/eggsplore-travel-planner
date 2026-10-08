declare const Deno: {
  serve: (handler: (request: Request) => Response | Promise<Response>) => void;
  env: { get: (name: string) => string | undefined };
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};

const outputSchema = {
  type: "OBJECT",
  properties: {
    days: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          date: { type: "STRING" },
          activities: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                time: { type: "STRING" },
                title: { type: "STRING" },
                description: { type: "STRING" },
                location: { type: "STRING" },
              },
              required: ["time", "title", "description", "location"],
            },
          },
        },
        required: ["date", "activities"],
      },
    },
  },
  required: ["days"],
};

type Activity = { time: string; title: string; description: string; location: string };
type Itinerary = { days: { date: string; activities: Activity[] }[] };

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function isDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function dateRange(start: string, end: string) {
  const dates: string[] = [];
  const cursor = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  while (cursor <= last && dates.length <= 14) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

function validateItinerary(value: unknown, dates: string[]): value is Itinerary {
  if (!value || typeof value !== "object" || !Array.isArray((value as Itinerary).days)) return false;
  const days = (value as Itinerary).days;
  if (days.length !== dates.length) return false;
  return days.every((day, index) =>
    day && day.date === dates[index] &&
    Array.isArray(day.activities) && day.activities.length >= 2 && day.activities.length <= 3 &&
    day.activities.every((activity) =>
      activity && /^([01]\d|2[0-3]):[0-5]\d$/.test(activity.time) &&
      typeof activity.title === "string" && activity.title.trim().length > 0 && activity.title.length <= 100 &&
      typeof activity.description === "string" && activity.description.trim().length > 0 && activity.description.length <= 240 &&
      typeof activity.location === "string" && activity.location.trim().length > 0 && activity.location.length <= 120
    )
  );
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return respond({ error: "Use POST to generate an itinerary." }, 405);

  // Supabase verifies the signed-in user's JWT before the request reaches this handler.
  if (!request.headers.get("authorization")?.startsWith("Bearer ")) {
    return respond({ error: "Please sign in again before generating an itinerary." }, 401);
  }
  if (Number(request.headers.get("content-length") || 0) > 12_000) {
    return respond({ error: "The itinerary request is too large." }, 413);
  }

  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) return respond({ error: "Gemini is not configured yet. Add GEMINI_API_KEY to your Supabase Function secrets." }, 503);

  let input: Record<string, unknown>;
  try {
    input = await request.json();
  } catch {
    return respond({ error: "The itinerary request was invalid." }, 400);
  }

  const destination = typeof input.destination === "string" ? input.destination.trim() : "";
  const startDate = input.startDate;
  const endDate = input.endDate;
  const tripType = input.tripType;
  const budget = typeof input.budget === "string" ? input.budget.trim() : "";
  const preferences = Array.isArray(input.preferences)
    ? input.preferences.filter((item): item is string => typeof item === "string").map((item) => item.trim().slice(0, 80)).filter(Boolean).slice(0, 6)
    : [];

  if (destination.length < 2 || destination.length > 100) {
    return respond({ error: "Enter a destination between 2 and 100 characters." }, 400);
  }
  if (!isDate(startDate) || !isDate(endDate) || endDate < startDate) {
    return respond({ error: "Add a valid start and end date for your AI itinerary." }, 400);
  }
  if (tripType !== "solo" && tripType !== "group") return respond({ error: "Choose a trip type first." }, 400);
  if (budget.length > 60) return respond({ error: "The budget selection is invalid." }, 400);

  const dates = dateRange(startDate, endDate);
  if (dates.length === 0 || dates.length > 14) {
    return respond({ error: "AI itinerary generation currently supports trips up to 14 days." }, 400);
  }

  const model = Deno.env.get("GEMINI_MODEL") || "gemini-3.5-flash-lite";
  if (!/^[a-zA-Z0-9.-]{3,80}$/.test(model)) return respond({ error: "The configured Gemini model name is invalid." }, 500);

  const prompt = [
    "Create a practical first-draft travel itinerary as structured JSON.",
    `Destination: ${destination}`,
    `Travel dates: ${startDate} through ${endDate} (${dates.length} calendar day${dates.length === 1 ? "" : "s"}).`,
    `Trip type: ${tripType}.`,
    `Per-person budget range: ${budget || "not specified"}.`,
    `Travel preferences: ${preferences.length ? preferences.join(", ") : "balanced mix of local culture, food, and relaxed exploration"}.`,
    "Return exactly one day for each supplied date, in the same order, with 2 or 3 activities per day.",
    "Use realistic local place names and sensible sequence; include meal breaks and avoid packing the day too tightly.",
    "Use 24-hour local wall-clock times in HH:mm. Keep each description to one concise sentence.",
    "Treat this as an unverified draft: do not claim live opening hours, weather, crowd levels, prices, or availability. Never invent booking confirmations. Avoid repeating the same attraction.",
    `Dates in order: ${dates.join(", ")}.`,
  ].join("\n");

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.35,
          maxOutputTokens: Math.min(8192, 500 + dates.length * 420),
          responseMimeType: "application/json",
          responseSchema: outputSchema,
        },
      }),
    });

    if (!response.ok) {
      const details = await response.json().catch(() => ({}));
      const upstreamMessage = details?.error?.message;
      const status = response.status === 429 ? 429 : response.status >= 500 ? 503 : 502;
      return respond({ error: response.status === 429
        ? "Gemini's free request limit was reached. Please wait and try again."
        : typeof upstreamMessage === "string" ? `Gemini could not generate the itinerary: ${upstreamMessage.slice(0, 240)}` : "Gemini could not generate the itinerary." }, status);
    }

    const payload = await response.json();
    const text = payload?.candidates?.[0]?.content?.parts?.find((part: { text?: unknown }) => typeof part.text === "string")?.text;
    if (typeof text !== "string") return respond({ error: "Gemini returned an empty itinerary. Please try again." }, 502);

    let itinerary: unknown;
    try { itinerary = JSON.parse(text); } catch { return respond({ error: "Gemini returned an unreadable itinerary. Please try again." }, 502); }
    if (!validateItinerary(itinerary, dates)) {
      return respond({ error: "Gemini returned an incomplete itinerary. Please try again." }, 502);
    }

    return respond({ itinerary, model });
  } catch {
    return respond({ error: "The itinerary service is unavailable. Check your connection and try again." }, 503);
  }
});
