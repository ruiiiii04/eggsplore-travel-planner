export type PublishedActivity = {
  id: string;
  title: string;
  description: string | null;
  activity_category: string | null;
  location_name: string | null;
  latitude?: number | null;
  longitude?: number | null;
  location_provider?: string | null;
  location_provider_id?: string | null;
  location_address?: string | null;
  location_categories?: string[];
  start_time: string | null;
  position: number;
};
export type PublicationResult = {
  revision: string;
  items: PublishedActivity[];
  flexibleDayCount: number;
};
export function readPublicationResult(value: unknown): PublicationResult {
  if (!value || typeof value !== "object")
    throw Error(
      "The publication response was incomplete. Reopen the itinerary to check the saved plan.",
    );
  const result = value as PublicationResult;
  if (
    typeof result.revision !== "string" ||
    !Array.isArray(result.items) ||
    !result.items.length ||
    result.items.some(
      (item) =>
        !item ||
        typeof item.id !== "string" ||
        typeof item.title !== "string" ||
        !Number.isInteger(item.position),
    )
  )
    throw Error(
      "The saved itinerary could not be confirmed. Reopen the itinerary before retrying.",
    );
  return {
    ...result,
    flexibleDayCount: Math.max(1, Number(result.flexibleDayCount) || 1),
  };
}
