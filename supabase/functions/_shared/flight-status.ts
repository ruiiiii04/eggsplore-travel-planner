export type FlightLookup = {
  flightStatus: string;
  flightNumber: string;
  departure: string;
  arrival: string;
  departureDelay: number | null;
  arrivalDelay: number | null;
  delayMinutes: number | null;
  scheduledDeparture: string | null;
  estimatedDeparture: string | null;
  scheduledArrival: string | null;
  estimatedArrival: string | null;
};

function minutes(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : null;
}

export async function lookupFlight(
  flightNumber: string,
  flightDate: string,
  accessKey: string,
): Promise<FlightLookup | null> {
  const url = new URL("https://api.aviationstack.com/v1/flights");
  url.searchParams.set("access_key", accessKey);
  url.searchParams.set("flight_iata", flightNumber);
  // Keep this on the real-time endpoint so a Free-plan key can be used.
  // Historical/future flight_date lookups require a paid Aviationstack plan.
  const response = await fetch(url, { signal: AbortSignal.timeout(12_000) });
  if (!response.ok) throw new Error("FLIGHT_PROVIDER_UNAVAILABLE");
  const payload = await response.json();
  if (payload?.error) throw new Error("FLIGHT_PROVIDER_REJECTED_REQUEST");
  const rows = Array.isArray(payload?.data) ? payload.data : [];
  const row = rows.find((item: any) =>
    String(item?.flight?.iata ?? "").toUpperCase() === flightNumber &&
    String(item?.flight_date ?? "") === flightDate
  );
  if (!row) return null;
  const departureDelay = minutes(row.departure?.delay);
  const arrivalDelay = minutes(row.arrival?.delay);
  return {
    flightStatus: String(row.flight_status ?? "unknown").toLowerCase(),
    flightNumber,
    departure: String(row.departure?.iata ?? row.departure?.airport ?? "Departure airport unavailable"),
    arrival: String(row.arrival?.iata ?? row.arrival?.airport ?? "Arrival airport unavailable"),
    departureDelay,
    arrivalDelay,
    delayMinutes: departureDelay === null && arrivalDelay === null
      ? null
      : Math.max(departureDelay ?? 0, arrivalDelay ?? 0),
    scheduledDeparture: typeof row.departure?.scheduled === "string" ? row.departure.scheduled : null,
    estimatedDeparture: typeof row.departure?.estimated === "string" ? row.departure.estimated : null,
    scheduledArrival: typeof row.arrival?.scheduled === "string" ? row.arrival.scheduled : null,
    estimatedArrival: typeof row.arrival?.estimated === "string" ? row.arrival.estimated : null,
  };
}
