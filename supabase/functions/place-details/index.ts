// @ts-nocheck -- Runs in Deno runtime (Supabase Edge Functions)
// NEW: public landmark data, available to authenticated app users.
import { createDetailsHandler } from "../_shared/handlers.ts";
Deno.serve(createDetailsHandler({ env: (name) => Deno.env.get(name) }));
