import { exploreId } from "./explore-places.ts";
import { ApiError } from "./http.ts";
import { uuid } from "./trip-places.ts";
import { isPlaceId } from "./catalog.ts";
export function parsePlace(body: Record<string, unknown>) {
  if (
    !isPlaceId(body.placeId) &&
    !(
      typeof body.placeId === "string" &&
      (uuid.test(body.placeId) || exploreId.test(body.placeId))
    )
  )
    throw new ApiError(400, "PLACE", "This place is not supported yet.");
  // Resolve trip access from the saved item; never trust client-supplied trip context.
  if (body.tripId != null)
    throw new ApiError(
      400,
      "TRIP_UNSUPPORTED",
      "Trip-aware requests must use only the saved place ID; its trip is resolved by the server.",
    );
  return body.placeId as string;
}
export type Message = { role: "user" | "assistant"; text: string };
export function parseChat(body: Record<string, unknown>) {
  const placeId = parsePlace(body);
  const question =
    typeof body.question === "string" ? body.question.trim() : "";
  if (!question || question.length > 1500)
    throw new ApiError(400, "QUESTION", "Use a question of 1–1500 characters.");
  const raw = body.history ?? [];
  if (!Array.isArray(raw) || raw.length > 12 || raw.length % 2 !== 0)
    throw new ApiError(400, "HISTORY", "Invalid conversation history.");
  const history: Message[] = raw.map((item, index) => {
    const role = index % 2 === 0 ? "user" : "assistant";
    if (
      !item ||
      item.role !== role ||
      typeof item.text !== "string" ||
      !item.text.trim() ||
      item.text.length > 6000
    ) {
      throw new ApiError(400, "HISTORY", "Invalid conversation history.");
    }
    return { role, text: item.text.trim() };
  });
  if (
    history.reduce((sum, item) => sum + item.text.length, question.length) >
    18_000
  ) {
    throw new ApiError(
      400,
      "HISTORY",
      "The conversation is too long. Start a new chat.",
    );
  }
  return { placeId, question, history };
}
