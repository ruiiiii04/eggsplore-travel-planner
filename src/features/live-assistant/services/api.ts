// NEW: authenticated calls; no Gemini secret is included in the Expo bundle.
import { getSupabase } from "@/lib/supabase";
import type { AssistantReply, ChatMessage, OnlinePlaceDetails } from "../types";

export async function invokeAssistantFunction<T>(
  name: "place-details" | "ask-assistant" | "trip-map" | "explore-places",
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
    if (context instanceof Response) {
      const payload = await context.json().catch(() => null);
      if (typeof payload?.error?.message === "string")
        throw new Error(payload.error.message);
      if (context.status === 401) throw new Error("Please sign in again.");
      if (context.status === 404)
        throw new Error(
          "This service has not been deployed yet. Follow the setup guide.",
        );
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
