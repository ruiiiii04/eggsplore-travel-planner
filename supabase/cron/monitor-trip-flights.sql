-- Run once after applying migration 027 and deploying monitor-trip-flights.
-- First store these values in Supabase Vault (never commit the real values):
--   flight_monitor_project_url = https://<project-ref>.supabase.co
--   flight_monitor_cron_secret = the same random value as the
--     FLIGHT_MONITOR_CRON_SECRET Edge Function secret
-- Also set AVIATIONSTACK_ACCESS_KEY and FLIGHT_MONITOR_CRON_SECRET as
-- Supabase Edge Function secrets before enabling the schedule.

select cron.schedule(
  'monitor-trip-flights-every-15-minutes',
  '*/15 * * * *',
  $$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'flight_monitor_project_url')
        || '/functions/v1/monitor-trip-flights',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-flight-monitor-secret',
        (select decrypted_secret from vault.decrypted_secrets where name = 'flight_monitor_cron_secret')
      ),
      body := '{}'::jsonb
    );
  $$
);
