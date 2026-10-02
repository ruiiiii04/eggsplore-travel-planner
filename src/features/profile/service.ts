import { getSupabase } from "@/lib/supabase";
import type { Profile } from "./types";
const columns =
  "id,display_name,avatar_url,preferences,emergency_contact,updated_at";
export async function readProfile(userId: string): Promise<Profile> {
  const { data, error } = await getSupabase()
    .from("profiles")
    .select(columns)
    .eq("id", userId)
    .single();
  if (error) throw error;
  return {
    ...data,
    preferences: data.preferences ?? {},
    emergency_contact: data.emergency_contact ?? {},
  } as Profile;
}
type Changes = Partial<
  Pick<
    Profile,
    "display_name" | "avatar_url" | "preferences" | "emergency_contact"
  >
>;
export async function updateProfile(
  userId: string,
  change: (current: Profile) => Changes,
): Promise<Profile> {
  const current = await readProfile(userId);
  // Compare the version read so concurrent edits never silently overwrite JSON preferences.
  const { data, error } = await getSupabase()
    .from("profiles")
    .update(change(current))
    .eq("id", userId)
    .eq("updated_at", current.updated_at)
    .select(columns)
    .maybeSingle();
  if (error) throw error;
  if (!data)
    throw new Error("Your profile changed on another device. Please retry.");
  return data as Profile;
}
