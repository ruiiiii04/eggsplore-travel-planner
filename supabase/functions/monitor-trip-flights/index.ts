// @ts-nocheck -- Runs in Deno runtime (Supabase Edge Functions)
import { createClient } from "npm:@supabase/supabase-js@2";
import { lookupFlight } from "../_shared/flight-status.ts";

const headers = { "Content-Type": "application/json; charset=utf-8" };
const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
const isoDate = (date: Date) => date.toISOString().slice(0, 10);

Deno.serve(async (request) => {
  if (request.method !== "POST") return respond({ error: "Use POST." }, 405);
  const expected = Deno.env.get("FLIGHT_MONITOR_CRON_SECRET");
  if (!expected || request.headers.get("x-flight-monitor-secret") !== expected) return respond({ error: "Unauthorized scheduler." }, 401);
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const apiKey = Deno.env.get("AVIATIONSTACK_ACCESS_KEY");
  if (!url || !serviceKey || !apiKey) return respond({ error: "Flight monitor secrets are not configured." }, 503);
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const today = new Date();
  const from = new Date(today); from.setUTCDate(from.getUTCDate() - 1);
  const until = new Date(today); until.setUTCDate(until.getUTCDate() + 1);
  const now = new Date().toISOString();
  const { data: flights, error } = await admin.from("trip_flights")
    .select("id,trip_id,user_id,flight_number,flight_date")
    .eq("monitoring_enabled", true).eq("is_demo", false)
    .lte("next_check_at", now).gte("flight_date", isoDate(from)).lte("flight_date", isoDate(until))
    .order("next_check_at", { ascending: true }).limit(20);
  if (error) return respond({ error: "Could not load flights due for monitoring." }, 500);

  let checked = 0;
  let disruptions = 0;
  for (const flight of flights ?? []) {
    try {
      const result = await lookupFlight(flight.flight_number, flight.flight_date, apiKey);
      if (!result) {
        await admin.from("trip_flights").update({ last_status: "unknown", last_checked_at: now, next_check_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString() }).eq("id", flight.id);
        continue;
      }
      const { data: eventId, error: recordError } = await admin.rpc("record_trip_flight_status", {
        target_flight: flight.id,
        provider_status: result.flightStatus,
        departure_delay: result.departureDelay,
        arrival_delay: result.arrivalDelay,
        departure_name: result.departure,
        arrival_name: result.arrival,
        scheduled_arrival_at: result.scheduledArrival,
        estimated_arrival_at: result.estimatedArrival,
      });
      if (!recordError) {
        checked++;
        if (eventId) disruptions++;
      }
    } catch {
      await admin.from("trip_flights").update({ last_checked_at: now, next_check_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString() }).eq("id", flight.id);
    }
  }
  return respond({ checked, disruptions, due: flights?.length ?? 0 });
});
