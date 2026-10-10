// @ts-nocheck -- Supabase Edge runtime.
import { createLocationSearchHandler } from "../_shared/location-search.ts";
Deno.serve(createLocationSearchHandler({ env: (name) => Deno.env.get(name) }));
