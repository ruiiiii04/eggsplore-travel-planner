// @ts-nocheck -- Runs in Deno runtime (Supabase Edge Functions)
import { createExploreHandler } from "../_shared/explore-places.ts";
Deno.serve(createExploreHandler({ env: (name) => Deno.env.get(name) }));
