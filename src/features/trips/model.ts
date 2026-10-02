export type Trip = {
  id: string;
  title: string;
  destination: string | null;
  /** Optional future destination-specific cover URL. The current table may omit it. */
  cover_url?: string | null;
  owner_id: string;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
};
export type TripStatus = "Live" | "Upcoming" | "Past";
export function localDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function tripStatus(
  trip: Pick<Trip, "start_date" | "end_date">,
  today = localDate(),
): TripStatus {
  if (trip.end_date && trip.end_date < today) return "Past";
  if (!trip.start_date || trip.start_date > today) return "Upcoming";
  return "Live";
}
export function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}
export function validateTrip(
  title: string,
  start: string,
  end: string,
): string | null {
  if (!title.trim()) return "Enter a trip title.";
  if ((start && !validDate(start)) || (end && !validDate(end)))
    return "Use valid dates in YYYY-MM-DD format.";
  if (end && !start) return "Enter a start date before setting an end date.";
  if (start && end && end < start)
    return "The end date cannot be before the start date.";
  return null;
}
