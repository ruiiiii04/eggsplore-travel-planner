-- Shared, trip-scoped flight records and disruption events.
-- Apply after 026_trip_creation_preferences.sql.
begin;

create table public.trip_flights (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  leg_type text not null default 'outbound' check (leg_type in ('outbound','return','demo')),
  -- Four letters are accepted for the explicit DEMO123 sample identifier.
  flight_number text not null check (flight_number ~ '^[A-Z0-9]{2,4}[0-9]{1,4}$'),
  flight_date date not null,
  share_with_trip boolean not null default false,
  monitoring_enabled boolean not null default true,
  is_demo boolean not null default false,
  last_status text,
  last_delay_minutes integer,
  last_departure text,
  last_arrival text,
  scheduled_arrival timestamptz,
  estimated_arrival timestamptz,
  last_checked_at timestamptz,
  next_check_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (trip_id, user_id, leg_type),
  check (last_delay_minutes is null or last_delay_minutes >= 0)
);

create index trip_flights_monitor_due
  on public.trip_flights (next_check_at)
  where monitoring_enabled and not is_demo;
create index trip_flights_trip on public.trip_flights (trip_id, flight_date desc);
create trigger trip_flights_updated before update on public.trip_flights
  for each row execute function public.touch_updated_at();

alter table public.trip_flights enable row level security;
create policy trip_flights_read on public.trip_flights for select to authenticated
  using (user_id = (select auth.uid()) or (share_with_trip and public.is_trip_member(trip_id)));
create policy trip_flights_add on public.trip_flights for insert to authenticated
  with check (user_id = (select auth.uid()) and public.is_trip_member(trip_id));
create policy trip_flights_edit on public.trip_flights for update to authenticated
  using (user_id = (select auth.uid()) and public.is_trip_member(trip_id))
  with check (user_id = (select auth.uid()) and public.is_trip_member(trip_id));
create policy trip_flights_remove on public.trip_flights for delete to authenticated
  using (user_id = (select auth.uid()) and public.is_trip_member(trip_id));
revoke all on public.trip_flights from anon, authenticated;
grant select, delete on public.trip_flights to authenticated;
grant insert (trip_id,user_id,leg_type,flight_number,flight_date,share_with_trip,monitoring_enabled),
  update (flight_number,flight_date,share_with_trip,monitoring_enabled) on public.trip_flights to authenticated;

create table public.trip_disruptions (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  flight_id uuid references public.trip_flights(id) on delete set null,
  flight_number text not null,
  flight_date date not null,
  leg_type text not null default 'outbound' check (leg_type in ('outbound','return','demo')),
  source text not null check (source in ('live','demo')),
  flight_status text not null,
  delay_minutes integer,
  departure text,
  arrival text,
  scheduled_arrival timestamptz,
  estimated_arrival timestamptz,
  impact_date date not null,
  state text not null default 'detected'
    check (state in ('detected','draft_ready','applied','dismissed','recovered')),
  summary text not null,
  proposed_plan jsonb not null default '[]'::jsonb
    check (jsonb_typeof(proposed_plan) = 'array' and jsonb_array_length(proposed_plan) <= 30),
  created_by uuid not null references public.profiles(id),
  detected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  check (delay_minutes is null or delay_minutes >= 0)
);

create unique index trip_disruptions_one_active_flight
  on public.trip_disruptions (flight_id)
  where flight_id is not null and state in ('detected','draft_ready');
create unique index trip_disruptions_one_active_demo
  on public.trip_disruptions (trip_id)
  where source = 'demo' and state in ('detected','draft_ready');
create index trip_disruptions_trip_recent on public.trip_disruptions (trip_id, detected_at desc);
create trigger trip_disruptions_updated before update on public.trip_disruptions
  for each row execute function public.touch_updated_at();

alter table public.trip_disruptions enable row level security;
create policy trip_disruptions_read on public.trip_disruptions for select to authenticated
  using (
    public.is_trip_member(trip_id)
    and (
      created_by = (select auth.uid())
      or source = 'demo'
      or exists (
        select 1 from public.trip_flights f
        where f.id = trip_disruptions.flight_id and f.share_with_trip
      )
    )
  );
revoke all on public.trip_disruptions from anon, authenticated;
grant select on public.trip_disruptions to authenticated;

-- Let trip members see a shared alert and its state changes without reopening the screen.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'trip_flights'
    ) then
      execute 'alter publication supabase_realtime add table public.trip_flights';
    end if;
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'trip_disruptions'
    ) then
      execute 'alter publication supabase_realtime add table public.trip_disruptions';
    end if;
  end if;
end;
$$;

-- Called only by the trusted flight-monitor Edge Functions using service_role.
create function public.record_trip_flight_status(
  target_flight uuid,
  provider_status text,
  departure_delay integer,
  arrival_delay integer,
  departure_name text,
  arrival_name text,
  scheduled_arrival_at timestamptz,
  estimated_arrival_at timestamptz
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  f public.trip_flights%rowtype;
  current_event public.trip_disruptions%rowtype;
  impact_delay integer;
  is_disrupted boolean;
  event_id uuid;
  event_summary text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service role required';
  end if;
  select * into f from public.trip_flights where id = target_flight for update;
  if not found then raise exception 'Flight record not found'; end if;
  impact_delay := greatest(coalesce(departure_delay, 0), coalesce(arrival_delay, 0));
  is_disrupted := lower(coalesce(provider_status, '')) in ('cancelled','diverted') or impact_delay >= 60;

  update public.trip_flights set
    last_status = left(coalesce(provider_status, 'unknown'), 40),
    last_delay_minutes = case when departure_delay is null and arrival_delay is null then null else impact_delay end,
    last_departure = left(departure_name, 120),
    last_arrival = left(arrival_name, 120),
    scheduled_arrival = scheduled_arrival_at,
    estimated_arrival = estimated_arrival_at,
    last_checked_at = now(),
    next_check_at = now() + interval '2 hours',
    monitoring_enabled = case when lower(coalesce(provider_status, '')) in ('landed','cancelled','diverted') then false else monitoring_enabled end
  where id = target_flight;

  select * into current_event from public.trip_disruptions
    where flight_id = target_flight and state in ('detected','draft_ready','dismissed','applied')
    order by detected_at desc limit 1 for update;

  if not is_disrupted then
    if found then
      update public.trip_disruptions set state = 'recovered', resolved_at = now(),
        flight_status = left(coalesce(provider_status, 'unknown'), 40),
        delay_minutes = case when departure_delay is null and arrival_delay is null then null else impact_delay end
      where id = current_event.id and current_event.state in ('detected','draft_ready','dismissed','applied');
    end if;
    return null;
  end if;

  -- Keep a dismissed alert quiet while the same disruption remains active.
  if found and current_event.state in ('dismissed','applied') then return current_event.id; end if;

  event_summary := case
    when lower(provider_status) = 'cancelled' then 'Flight ' || f.flight_number || ' was cancelled.'
    when lower(provider_status) = 'diverted' then 'Flight ' || f.flight_number || ' was diverted.'
    else 'Flight ' || f.flight_number || ' is delayed by ' || impact_delay || ' minutes.'
  end;
  if found then
    event_id := current_event.id;
    update public.trip_disruptions set flight_status = left(provider_status,40), delay_minutes = impact_delay,
      departure = left(departure_name,120), arrival = left(arrival_name,120),
      scheduled_arrival = scheduled_arrival_at, estimated_arrival = estimated_arrival_at,
      summary = left(event_summary,240), resolved_at = null
    where id = event_id;
  else
    insert into public.trip_disruptions (
      trip_id, flight_id, flight_number, flight_date, source, flight_status,
      leg_type, delay_minutes, departure, arrival, scheduled_arrival, estimated_arrival,
      impact_date, summary, created_by
    ) values (
      f.trip_id, f.id, f.flight_number, f.flight_date, 'live', left(provider_status,40), f.leg_type,
      impact_delay, left(departure_name,120), left(arrival_name,120), scheduled_arrival_at,
      estimated_arrival_at, coalesce((scheduled_arrival_at at time zone 'UTC')::date, f.flight_date),
      left(event_summary,240), f.user_id
    ) returning id into event_id;
    if f.share_with_trip then
      insert into public.notifications (user_id, trip_id, type, title, body, data, dedupe_key)
      select m.user_id, f.trip_id, 'flight_delay', 'Flight disruption detected',
        left(event_summary,240), jsonb_build_object('disruption_id',event_id,'flight_id',f.id,'source','live'),
        'flight-disruption:' || event_id::text
      from public.trip_members m where m.trip_id = f.trip_id
      on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;
    end if;
  end if;
  return event_id;
end;
$$;
revoke all on function public.record_trip_flight_status(uuid,text,integer,integer,text,text,timestamptz,timestamptz) from public, anon, authenticated;
grant execute on function public.record_trip_flight_status(uuid,text,integer,integer,text,text,timestamptz,timestamptz) to service_role;

-- Deterministic demo event, routed through the same card and notification path as live events.
create function public.simulate_trip_flight_disruption(target_trip uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_owner_id uuid;
  demo_flight uuid;
  event_id uuid;
  event_date date;
begin
  if not public.is_trip_owner(target_trip) then raise exception 'Only the Group Leader can run the demo'; end if;
  select t.owner_id, coalesce(t.start_date, current_date) into v_owner_id, event_date
    from public.trips t where t.id = target_trip;
  if v_owner_id is null then raise exception 'Trip not found'; end if;
  insert into public.trip_flights (trip_id,user_id,leg_type,flight_number,flight_date,share_with_trip,monitoring_enabled,is_demo)
  values (target_trip,v_owner_id,'demo','DEMO123',event_date,true,false,true)
  on conflict (trip_id,user_id,leg_type) do update set flight_number='DEMO123',flight_date=excluded.flight_date,share_with_trip=true,is_demo=true
  returning id into demo_flight;

  select id into event_id from public.trip_disruptions
    where trip_id=target_trip and source='demo' and state in ('detected','draft_ready') limit 1;
  if event_id is null then
    insert into public.trip_disruptions (trip_id,flight_id,flight_number,flight_date,source,flight_status,leg_type,
      delay_minutes,departure,arrival,scheduled_arrival,estimated_arrival,impact_date,summary,created_by)
    values (target_trip,demo_flight,'DEMO123',event_date,'demo','delayed','demo',180,
      'Demo Origin Airport (ABC)','Demo Destination Airport (XYZ)',
      (event_date + time '12:00') at time zone 'UTC',(event_date + time '15:00') at time zone 'UTC',event_date,
      'Demo simulation: flight DEMO123 is delayed by 3 hours.',v_owner_id)
    returning id into event_id;
    insert into public.notifications (user_id,trip_id,type,title,body,data,dedupe_key)
    select m.user_id,target_trip,'flight_delay','Demo disruption detected',
      'Demo simulation: flight DEMO123 is delayed by 3 hours.',
      jsonb_build_object('disruption_id',event_id,'flight_id',demo_flight,'source','demo'),
      'flight-disruption:' || event_id::text
    from public.trip_members m where m.trip_id=target_trip
    on conflict (user_id,dedupe_key) where dedupe_key is not null do nothing;
  end if;
  return event_id;
end;
$$;
revoke all on function public.simulate_trip_flight_disruption(uuid) from public,anon;
grant execute on function public.simulate_trip_flight_disruption(uuid) to authenticated;

create function public.dismiss_trip_disruption(target_event uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare target_trip uuid;
begin
  select trip_id into target_trip from public.trip_disruptions where id=target_event;
  if target_trip is null or not public.is_trip_owner(target_trip) then
    raise exception 'Only the Group Leader can dismiss this disruption';
  end if;
  update public.trip_disruptions set state='dismissed',resolved_at=now() where id=target_event;
end;
$$;
revoke all on function public.dismiss_trip_disruption(uuid) from public,anon;
grant execute on function public.dismiss_trip_disruption(uuid) to authenticated;

create function public.save_trip_disruption_plan(target_event uuid, proposed jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare target_trip uuid;
begin
  select trip_id into target_trip from public.trip_disruptions where id=target_event for update;
  if target_trip is null or not public.is_trip_owner(target_trip) then
    raise exception 'Only the Group Leader can prepare a shared itinerary change';
  end if;
  if jsonb_typeof(proposed) <> 'array' or jsonb_array_length(proposed) > 30 then
    raise exception 'Invalid disruption plan';
  end if;
  if exists (
    select 1 from jsonb_array_elements(proposed) as p(item)
    where (p.item->>'new_start_time')::timestamptz <= (p.item->>'expected_start_time')::timestamptz
      or ((p.item->>'new_start_time')::timestamptz at time zone 'UTC')::date <>
         ((p.item->>'expected_start_time')::timestamptz at time zone 'UTC')::date
  ) then
    raise exception 'Recovery times must move forward within the same day';
  end if;
  update public.trip_disruptions set state='draft_ready',proposed_plan=proposed,resolved_at=null
    where id=target_event and state in ('detected','draft_ready');
  if not found then raise exception 'This disruption is no longer active'; end if;
end;
$$;
revoke all on function public.save_trip_disruption_plan(uuid,jsonb) from public,anon;
grant execute on function public.save_trip_disruption_plan(uuid,jsonb) to authenticated;

create function public.apply_trip_disruption_plan(target_event uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  current_event public.trip_disruptions%rowtype;
  change jsonb;
  item_id uuid;
  expected_start timestamptz;
  next_start timestamptz;
  current_start timestamptz;
  changed integer := 0;
begin
  select * into current_event from public.trip_disruptions where id=target_event for update;
  if not found or not public.is_trip_owner(current_event.trip_id) then
    raise exception 'Only the Group Leader can publish this itinerary recovery';
  end if;
  if current_event.state <> 'draft_ready' then raise exception 'Review the latest recovery draft before publishing'; end if;
  perform 1 from public.trips where id=current_event.trip_id for update;
  for change in select * from jsonb_array_elements(current_event.proposed_plan) loop
    item_id := (change->>'item_id')::uuid;
    expected_start := (change->>'expected_start_time')::timestamptz;
    next_start := (change->>'new_start_time')::timestamptz;
    select start_time into current_start from public.itinerary_items
      where id=item_id and trip_id=current_event.trip_id for update;
    if not found or current_start is distinct from expected_start then
      raise exception 'The itinerary changed while you reviewed this draft. Reopen Review Impact.';
    end if;
    if current_event.source <> 'demo' and current_start <= now() then
      raise exception 'Only upcoming activities can be changed for a live disruption';
    end if;
    if (current_start at time zone 'UTC')::date <> current_event.impact_date then
      raise exception 'The recovery draft includes an activity outside the affected day';
    end if;
    update public.itinerary_items set start_time=next_start where id=item_id;
    changed := changed + 1;
  end loop;
  update public.trip_disruptions set state='applied',resolved_at=now() where id=target_event;
  return changed;
end;
$$;
revoke all on function public.apply_trip_disruption_plan(uuid) from public,anon;
grant execute on function public.apply_trip_disruption_plan(uuid) to authenticated;

commit;
