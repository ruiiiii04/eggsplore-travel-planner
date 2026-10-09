// @ts-nocheck -- Runs in Deno runtime (Supabase Edge Functions)
import { createTripMapHandler } from "../_shared/trip-map-handler.ts";
Deno.serve(createTripMapHandler({ env: (name) => Deno.env.get(name) }));
