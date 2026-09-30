import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const configured = Boolean(url && key && !url.includes('YOUR_') && !key.includes('YOUR_') && /^https?:\/\//.test(url));

export const supabaseConfigurationError = configured ? null :
  'Supabase is not configured. Replace the placeholders in .env.local with your project URL and publishable/anon key, then restart npm run dev.';
export const supabase = configured ? createClient(url!, key!) : null;
export function getSupabase() {
  if (!supabase) throw new Error(supabaseConfigurationError!);
  return supabase;
}
