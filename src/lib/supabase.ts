import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, processLock } from "@supabase/supabase-js";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const configured = Boolean(
  url?.startsWith("https://") &&
  !url.includes("YOUR_PROJECT") &&
  key &&
  !key.includes("YOUR_"),
);
export const supabaseConfigurationError = configured
  ? null
  : "Add your Supabase URL and publishable (or anon) key to .env, then restart Expo with npm start -- --clear.";
export const supabase = configured
  ? createClient(url!, key!, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
        lock: processLock,
      },
    })
  : null;
export function getSupabase() {
  if (!supabase) throw new Error(supabaseConfigurationError!);
  return supabase;
}
