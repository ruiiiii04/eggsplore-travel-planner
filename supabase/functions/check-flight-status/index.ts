// @ts-nocheck -- Runs in Deno runtime (Supabase Edge Functions)
import { createClient } from "npm:@supabase/supabase-js@2";
import { lookupFlight } from "../_shared/flight-status.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};
const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: corsHeaders });

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return respond({ error: "Use POST to check a flight." }, 405);
  const authorization = request.headers.get("authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) return respond({ error: "Please sign in before checking a flight." }, 401);

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anonKey || !serviceKey) return respond({ error: "Flight status backend is not configured." }, 503);
  const member = createClient(url, anonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data: authData, error: authError } = await member.auth.getUser();
  if (authError || !authData.user) return respond({ error: "Please sign in again before checking a flight." }, 401);

  let input: { flightId?: unknown };
  try { input = await request.json(); } catch { return respond({ error: "The flight request was invalid." }, 400); }
  if (typeof input.flightId !== "string" || !/^[0-9a-f-]{36}$/i.test(input.flightId)) return respond({ error: "Choose a saved flight first." }, 400);
  const { data: flight, error: flightError } = await member.from("trip_flights")
    .select("id,trip_id,user_id,flight_number,flight_date,share_with_trip")
    .eq("id", input.flightId).eq("user_id", authData.user.id).maybeSingle();
  if (flightError || !flight) return respond({ error: "This flight is not available to your account." }, 404);
  const { data: trip } = await member.from("trips").select("id").eq("id", flight.trip_id).maybeSingle();
  if (!trip) return respond({ error: "You no longer have access to this trip." }, 403);

  const apiKey = Deno.env.get("AVIATIONSTACK_ACCESS_KEY");
  if (!apiKey) return respond({ error: "AVIATIONSTACK_ACCESS_KEY is not configured." }, 503);
  try {
    const result = await lookupFlight(flight.flight_number, flight.flight_date, apiKey);
    if (!result) return respond({ error: "No matching live flight data was found for that number and date." }, 404);
    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error: recordError } = await admin.rpc("record_trip_flight_status", {
      target_flight: flight.id,
      provider_status: result.flightStatus,
      departure_delay: result.departureDelay,
      arrival_delay: result.arrivalDelay,
      departure_name: result.departure,
      arrival_name: result.arrival,
      scheduled_arrival_at: result.scheduledArrival,
      estimated_arrival_at: result.estimatedArrival,
    });
    if (recordError) return respond({ error: "The flight was checked but its status could not be saved." }, 500);
    return respond({ ...result, checkedAt: new Date().toISOString() });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "";
    if (message === "FLIGHT_PROVIDER_REJECTED_REQUEST") return respond({ error: "The flight provider rejected the request. Check its API key and plan." }, 502);
    return respond({ error: "The flight status provider is temporarily unavailable." }, 502);
  }
});
