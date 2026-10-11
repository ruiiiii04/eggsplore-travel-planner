-- 025_weather_alerts.sql
-- Rain alerts for outdoor activities. Members cannot insert notifications
-- directly, so they call create_weather_alerts, which checks trip membership.
-- Safe to run more than once.
begin;

alter table public.notifications add column if not exists dedupe_key text;

create unique index if not exists notifications_dedupe
  on public.notifications (user_id, dedupe_key) where dedupe_key is not null;

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in ('expense_added','debt_paid','flight_delay','note_reminder','budget_alert','weather_alert'));

create or replace function public.create_weather_alerts(target_trip uuid, alerts jsonb)
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  a jsonb;
  added integer := 0;
  n integer;
begin
  if not public.is_trip_member(target_trip) then
    raise exception 'Not a member of this trip';
  end if;
  if jsonb_typeof(alerts) <> 'array' or jsonb_array_length(alerts) > 20 then
    raise exception 'Invalid alerts';
  end if;
  for a in select * from jsonb_array_elements(alerts) loop
    if coalesce(a->>'key', '') = '' or coalesce(a->>'title', '') = '' then
      raise exception 'Each alert needs a key and a title';
    end if;
    insert into public.notifications (user_id, trip_id, type, title, body, data, dedupe_key)
    select m.user_id, target_trip, 'weather_alert',
           left(a->>'title', 120), left(a->>'body', 240),
           jsonb_build_object(
             'item_id', a->>'item_id',
             'simulated', coalesce((a->>'simulated')::boolean, false)),
           left(a->>'key', 120)
    from public.trip_members m
    where m.trip_id = target_trip
    on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;
    get diagnostics n = row_count;
    added := added + n;
  end loop;
  return added;
end;
$$;

revoke all on function public.create_weather_alerts(uuid, jsonb) from public, anon;
grant execute on function public.create_weather_alerts(uuid, jsonb) to authenticated;

commit;