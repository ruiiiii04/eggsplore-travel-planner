import { test } from "node:test";
import assert from "node:assert/strict";
import { lookupFlight } from "../supabase/functions/_shared/flight-status";

test("flight lookup matches date, reads delays and rejects provider failures", async () => {
 const original = globalThis.fetch;
 try {
  globalThis.fetch = async (input) => {
   const url = new URL(String(input));
   assert.equal(url.protocol, "https:");
   assert.equal(url.searchParams.get("flight_iata"), "MH123");
   assert.equal(url.searchParams.has("flight_date"), false);
   return Response.json({ data: [
    { flight: { iata: "MH123" }, flight_date: "2026-10-12", departure: { delay: 999 } },
    { flight: { iata: "MH123" }, flight_date: "2026-10-13", flight_status: "active", departure: { delay: "180", iata: "KUL" }, arrival: { delay: 120, iata: "NRT" } }
   ] });
  };
  const flight = await lookupFlight("MH123", "2026-10-13", "test-key");
  assert.equal(flight?.delayMinutes, 180);
  assert.equal(flight?.arrival, "NRT");
  assert.equal(await lookupFlight("MH123", "2026-10-14", "test-key"), null);
  globalThis.fetch = async () => Response.json({ error: { code: "invalid_access_key" } });
  await assert.rejects(lookupFlight("MH123", "2026-10-13", "test-key"), /FLIGHT_PROVIDER_REJECTED_REQUEST/);
  globalThis.fetch = async () => new Response("", { status: 503 });
  await assert.rejects(lookupFlight("MH123", "2026-10-13", "test-key"), /FLIGHT_PROVIDER_UNAVAILABLE/);
 } finally { globalThis.fetch = original; }
});
