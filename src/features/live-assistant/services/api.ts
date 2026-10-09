// NEW: authenticated calls; no Gemini secret is included in the Expo bundle.
import { getSupabase } from "@/lib/supabase";
import type { AssistantReply, ChatMessage, OnlinePlaceDetails } from "../types";

export async function invokeAssistantFunction<T>(
  name: "place-details" | "ask-assistant" | "trip-map" | "explore-places" | "location-search",
  body: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const client = getSupabase();
  const { data, error } = await client.auth.getSession();
  if (error || !data.session) throw new Error("Please sign in again.");
  const result = await client.functions.invoke<T>(name, {
    body: body as Record<string, unknown>,
    headers: { Authorization: `Bearer ${data.session.access_token}` },
    signal,
  });
  if (result.error) {
    const context = result.error.context;
    if (context && typeof context.text === "function") {
      const status = typeof context.status === "number" ? context.status : "unknown";
      const raw = await context.text().catch(() => "");
      // Redact credentials if a gateway happens to echo them in an error body.
      const safeBody = String(raw)
        .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
        .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[redacted]")
        .replace(/AIza[A-Za-z0-9_-]+/g, "[redacted]")
        .replace(/("(?:access_token|refresh_token|api_key|apikey|authorization|secret)"\s*:\s*")[^"]*/gi, "$1[redacted]");
      console.warn("Assistant service error", { status, body: safeBody });
      let payload: unknown = null;
      try {
        payload = JSON.parse(safeBody);
      } catch {
        // Gateways can return plain text or HTML instead of JSON.
      }
      const message = (payload as { error?: { message?: unknown } } | null)?.error?.message;
      if (typeof message === "string") throw new Error(message);
      if (status === 401) throw new Error("Please sign in again.");
      if (status === 404)
        throw new Error(
          "This service has not been deployed yet. Follow the setup guide.",
        );
      const snippet = safeBody.replace(/\s+/g, " ").trim().slice(0, 200);
      throw new Error("HTTP " + status + (snippet ? ": " + snippet : ""));
    }
    throw new Error(
      "Could not reach the service. Check your connection and server setup, then retry.",
    );
  }
  if (!result.data) throw new Error("The service returned no data.");
  return result.data;
}
export function loadPlaceDetails(placeId: string, signal?: AbortSignal) {
  return invokeAssistantFunction<OnlinePlaceDetails>(
    "place-details",
    { placeId },
    signal,
  );
}
export function askAssistant(
  placeId: string,
  question: string,
  history: ChatMessage[],
  signal?: AbortSignal,
) {
  return invokeAssistantFunction<AssistantReply>(
    "ask-assistant",
    { placeId, question, history },
    signal,
  );
}
// Keep complete user/assistant pairs within the server's history budget.
export function recentHistory(messages: ChatMessage[]) {
  const pairs: ChatMessage[] = [];
  let length = 0;
  for (let end = messages.length; end >= 2 && pairs.length < 12; end -= 2) {
    const pair = messages.slice(end - 2, end);
    if (pair[0].role !== "user" || pair[1].role !== "assistant") break;
    const size = pair[0].text.length + pair[1].text.length;
    if (length + size > 15_000) break;
    pairs.unshift(...pair);
    length += size;
  }
  return pairs;
}
