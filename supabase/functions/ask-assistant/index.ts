// @ts-nocheck -- Runs in Deno runtime (Supabase Edge Functions)
// NEW: JWT is verified by Supabase Auth inside the handler on every request.
import { createAssistantHandler } from "../_shared/handlers.ts";
Deno.serve(createAssistantHandler({ env: (name) => Deno.env.get(name) }));
