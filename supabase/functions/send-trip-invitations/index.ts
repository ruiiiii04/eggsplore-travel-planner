// @ts-ignore Deno resolves npm: imports when deploying Supabase Edge Functions.
import { createClient } from "npm:@supabase/supabase-js@2";

declare const Deno: {
  serve: (handler: (request: Request) => Response | Promise<Response>) => void;
  env: { get(name: string): string | undefined };
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return respond({ error: "Use POST to send trip invitations." }, 405);
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return respond({ error: "Please sign in to invite trip members." }, 401);

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anonKey || !serviceKey) return respond({ error: "Trip invitations are not configured on the server." }, 503);

  let input: Record<string, unknown>;
  try { input = await request.json(); }
  catch { return respond({ error: "The invitation request was invalid." }, 400); }
  const tripId = typeof input.tripId === "string" ? input.tripId : "";
  const emails = Array.isArray(input.emails)
    ? [...new Set(input.emails.filter((email): email is string => typeof email === "string").map((email) => email.trim().toLowerCase()).filter(Boolean))]
    : [];
  if (!/^[0-9a-f-]{36}$/i.test(tripId) || emails.length > 5 || emails.some((email) => email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    return respond({ error: "Check the trip and invitee email addresses, then try again." }, 400);
  }
  if (!emails.length) return respond({ sent: 0, added: 0, alreadyMembers: 0, failures: [] });

  const memberClient = createClient(url, anonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false, autoRefreshToken: false } });
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: authData, error: authError } = await memberClient.auth.getUser();
  if (authError || !authData.user) return respond({ error: "Your session expired. Sign in again and retry." }, 401);

  let sent = 0;
  let added = 0;
  let alreadyMembers = 0;
  const failures: { email: string; message: string }[] = [];
  for (const email of emails) {
    const { data, error } = await memberClient.rpc("prepare_trip_invitation", { target_trip: tripId, invite_email: email });
    if (error) {
      failures.push({ email, message: error.message });
      continue;
    }
    const invitation = Array.isArray(data) ? data[0] : data;
    if (!invitation?.invitation_id) {
      failures.push({ email, message: "Could not save this invitation." });
      continue;
    }
    if (invitation.already_member) {
      alreadyMembers++;
      continue;
    }
    if (invitation.existing_user_id) {
      added++;
      continue;
    }

    const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { trip_id: tripId, trip_invitation_id: invitation.invitation_id },
    });
    if (inviteError || !invited.user) {
      failures.push({ email, message: inviteError?.message || "The invitation email could not be sent." });
      continue;
    }
    const { error: linkError } = await admin.rpc("mark_trip_invitation_sent", {
      target_invitation: invitation.invitation_id,
      invited_user: invited.user.id,
    });
    if (linkError) {
      failures.push({ email, message: "The email was sent, but trip access could not be attached. Contact the trip organiser." });
      continue;
    }
    sent++;
  }
  return respond({ sent, added, alreadyMembers, failures });
});
