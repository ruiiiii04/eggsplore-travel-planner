// Generate destination-based candidate places. The Gemini key stays in Supabase secrets.
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
const allowedTags = ["Culture", "Nature", "Food", "Sightseeing", "Shopping", "Nightlife", "Beach", "Relax", "Adventure"];
const responseSchema = {
  type: "OBJECT",
  properties: {
    candidates: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          name: { type: "STRING" },
          location: { type: "STRING" },
          tags: { type: "ARRAY", items: { type: "STRING", enum: allowedTags } },
        },
        required: ["name", "location", "tags"],
      },
    },
  },
  required: ["candidates"],
};

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return respond({ error: "Use POST to generate candidates." }, 405);
  if (!request.headers.get("authorization")?.startsWith("Bearer ")) {
    return respond({ error: "Please sign in before generating candidates." }, 401);
  }
  if (Number(request.headers.get("content-length") || 0) > 8_000) {
    return respond({ error: "The candidate request is too large." }, 413);
  }

  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) return respond({ error: "Gemini is not configured in Supabase Function secrets." }, 503);

  let input: Record<string, unknown>;
  try { input = await request.json(); }
  catch { return respond({ error: "The candidate request was invalid." }, 400); }

  const destination = typeof input.destination === "string" ? input.destination.trim() : "";
  const budget = typeof input.budget === "string" ? input.budget.trim().slice(0, 80) : "";
  const preferences = Array.isArray(input.preferences)
    ? input.preferences.filter((value): value is string => typeof value === "string").map((value) => value.trim().slice(0, 60)).filter(Boolean).slice(0, 8)
    : [];
  const existingPlaces = Array.isArray(input.existingPlaces)
    ? input.existingPlaces.slice(0, 60).flatMap((place) => {
      if (!place || typeof place !== "object") return [];
      const value = place as Record<string, unknown>;
      const name = typeof value.name === "string" ? value.name.trim().slice(0, 120) : "";
      const location = typeof value.location === "string" ? value.location.trim().slice(0, 120) : "";
      return name ? [{ name, location }] : [];
    })
    : [];
  const requestedCount = typeof input.count === "number" && Number.isFinite(input.count) ? Math.floor(input.count) : 6;
  const count = Math.max(4, Math.min(8, requestedCount));
  if (destination.length < 2 || destination.length > 100) {
    return respond({ error: "Enter a destination between 2 and 100 characters." }, 400);
  }

  const model = Deno.env.get("GEMINI_MODEL") || "gemini-3.5-flash-lite";
  if (!/^[a-zA-Z0-9.-]{3,80}$/.test(model)) return respond({ error: "The configured Gemini model name is invalid." }, 500);
  const prompt = [
    "Suggest real, well-known travel places for a destination-based group candidate pool.",
    `Destination: ${destination}`,
    `Budget range: ${budget || "not specified"}`,
    `Interests: ${preferences.length ? preferences.join(", ") : "a varied mix of culture, food, nature, and sightseeing"}`,
    `Return ${count} distinct places relevant to this destination.`,
    existingPlaces.length ? `Do not suggest any place already present in this candidate pool or itinerary. Avoid alternate spellings and common aliases for these places: ${JSON.stringify(existingPlaces)}.` : "",
    "Each place must have a concise name, a specific neighborhood/city location, and 1 to 3 tags from the allowed list.",
    `Allowed tags: ${allowedTags.join(", ")}.`,
    "Do not invent opening hours, prices, current availability, or booking details. Do not repeat places.",
  ].join("\n");

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 1800, responseMimeType: "application/json", responseSchema },
      }),
      signal: AbortSignal.timeout(25000),
    });
    if (!response.ok) {
      if (response.status === 429) return respond({ error: "Gemini's request limit was reached. Please wait and try again." }, 429);
      return respond({ error: "Gemini could not generate candidate places. Please try again." }, 502);
    }
    const payload = await response.json();
    const text = payload?.candidates?.[0]?.content?.parts?.find((part: { text?: unknown }) => typeof part.text === "string")?.text;
    if (typeof text !== "string") return respond({ error: "Gemini returned no candidate places. Please try again." }, 502);
    let parsed: unknown;
    try { parsed = JSON.parse(text); }
    catch { return respond({ error: "Gemini returned unreadable candidate data. Please try again." }, 502); }
    const rawCandidates = (parsed as { candidates?: unknown })?.candidates;
    if (!Array.isArray(rawCandidates)) return respond({ error: "Gemini returned invalid candidate data. Please try again." }, 502);
    const excludedNames = new Set(existingPlaces.map((place) => normalizePlace(place.name)));
    const generatedNames = new Set<string>();
    const candidates = rawCandidates.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const value = item as Record<string, unknown>;
      const name = typeof value.name === "string" ? value.name.trim().slice(0, 120) : "";
      const location = typeof value.location === "string" ? value.location.trim().slice(0, 120) : "";
      const tags = Array.isArray(value.tags)
        ? Array.from(new Set(value.tags.filter((tag): tag is string => typeof tag === "string" && allowedTags.includes(tag)))).slice(0, 3)
        : [];
      const normalizedName = normalizePlace(name);
      if (!name || !location || excludedNames.has(normalizedName) || generatedNames.has(normalizedName)) return [];
      generatedNames.add(normalizedName);
      return [{ name, location, tags }];
    });
    return respond({ candidates: candidates.slice(0, count), model });
  } catch {
    return respond({ error: "The candidate service is unavailable. Check your connection and try again." }, 503);
  }
});

function normalizePlace(value: string) {
  return value.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}
