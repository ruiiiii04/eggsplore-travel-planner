-- Apply after 015. Preserve newly inserted activities during draft publication.
begin;
create or replace function public.publish_candidate_draft(target_trip uuid, stops jsonb)
returns void
language plpgsql security definer set search_path = '' as $$
declare expected_existing integer;
updated_existing integer;
expected_ids jsonb;
begin
  if not public.is_trip_owner(target_trip) then raise exception 'Only the trip organiser can publish'; end if;
  perform 1 from public.trips where id = target_trip for update;
  if not found then raise exception 'Trip not found'; end if;
  lock table public.itinerary_items in share row exclusive mode;
  if stops is null or jsonb_typeof(stops) <> 'array' then
    raise exception 'Supply between 1 and 120 activities';
  end if;
  if jsonb_array_length(stops) = 0 or jsonb_array_length(stops) > 120 then
    raise exception 'Supply between 1 and 120 activities';
  end if;
  expected_ids := stops->0->'expected_existing_ids';
  if expected_ids is null or jsonb_typeof(expected_ids) <> 'array' then
    raise exception 'Reload the current itinerary and review the draft again';
  end if;
  if jsonb_array_length(expected_ids) > 500 then
    raise exception 'Reload the current itinerary and review the draft again';
  end if;
  if exists (
    select 1 from public.itinerary_items item
    where item.trip_id = target_trip and not exists (
      select 1 from jsonb_array_elements_text(expected_ids) expected(id) where expected.id = item.id::text
    )
  ) or exists (
    select 1 from jsonb_array_elements_text(expected_ids) expected(id)
    where not exists (select 1 from public.itinerary_items item where item.trip_id = target_trip and item.id::text = expected.id)
  ) then raise exception 'The Full Itinerary changed. Reload and review the plan again.'; end if;
  if exists (
    select 1 from jsonb_array_elements(stops) x
    where coalesce(length(trim(x->>'title')), 0) = 0 or length(x->>'title') > 120
       or coalesce(nullif(x->>'activity_category', ''), 'sightseeing') not in ('sightseeing', 'food', 'transport', 'stay')
  ) then raise exception 'Every activity needs a valid name and category'; end if;

  select count(*) into expected_existing from jsonb_array_elements(stops) x
  where nullif(x->>'existing_id', '') is not null;
  if exists (
    select 1 from jsonb_array_elements(stops) x
    where nullif(x->>'existing_id', '') is not null
    group by x->>'existing_id' having count(*) > 1
  ) then raise exception 'An existing activity appears more than once'; end if;
  if exists (
    select 1 from jsonb_array_elements(stops) x
    where nullif(x->>'existing_id', '') is not null
      and jsonb_typeof(x->'existing_snapshot') is distinct from 'array'
  ) then raise exception 'Reload and review each existing activity before publishing'; end if;
  if exists (
    select 1 from jsonb_array_elements(stops) x
    where nullif(x->>'existing_id', '') is not null and jsonb_array_length(x->'existing_snapshot') <> 6
  ) then raise exception 'Reload and review each existing activity before publishing'; end if;
  if exists (
    select 1
    from jsonb_array_elements(stops) x
    join public.itinerary_items item on item.id = (x->>'existing_id')::uuid and item.trip_id = target_trip
    where nullif(x->>'existing_id', '') is not null and (
      (x->'existing_snapshot'->>0) is distinct from item.title or
      (x->'existing_snapshot'->>1) is distinct from item.description or
      (x->'existing_snapshot'->>2) is distinct from item.activity_category or
      (x->'existing_snapshot'->>3) is distinct from item.location_name or
      nullif(x->'existing_snapshot'->>4, '')::timestamptz is distinct from item.start_time or
      (x->'existing_snapshot'->>5)::integer is distinct from item.position
    )
  ) then raise exception 'An existing activity changed. Reload and review the plan again'; end if;

  update public.itinerary_items item
  set title = x->>'title', description = x->>'description', location_name = x->>'location_name',
      activity_category = nullif(x->>'activity_category', ''),
      start_time = nullif(x->>'start_time', '')::timestamptz,
      position = (a.ordinality - 1)::integer
  from jsonb_array_elements(stops) with ordinality a(x, ordinality)
  where nullif(x->>'existing_id', '') is not null
    and item.id = (x->>'existing_id')::uuid and item.trip_id = target_trip;
  get diagnostics updated_existing = row_count;
  if updated_existing <> expected_existing then raise exception 'An existing activity changed. Reload and review the plan again'; end if;

  -- Remove excluded existing rows before inserting new rows with generated IDs.
  delete from public.itinerary_items item
  where item.trip_id = target_trip and not exists (
    select 1 from jsonb_array_elements(stops) x
    where nullif(x->>'existing_id', '') is not null and item.id = (x->>'existing_id')::uuid
  );

  insert into public.itinerary_items(trip_id, title, description, location_name, activity_category, start_time, position)
  select target_trip, x->>'title', x->>'description', x->>'location_name', nullif(x->>'activity_category', ''),
         nullif(x->>'start_time', '')::timestamptz, (a.ordinality - 1)::integer
  from jsonb_array_elements(stops) with ordinality a(x, ordinality)
  where nullif(x->>'existing_id', '') is null;
end;
$$;
revoke all on function public.publish_candidate_draft(uuid, jsonb) from public, anon;
grant execute on function public.publish_candidate_draft(uuid, jsonb) to authenticated;
commit;
