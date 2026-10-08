-- Publish the reviewed plan while keeping existing itinerary row identities.
-- Review Draft sends existing_id for activities already on the trip and NULL
-- for newly added candidate or manually inserted activities.
begin;

create or replace function public.publish_candidate_draft(target_trip uuid, stops jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  expected_existing integer;
  updated_existing integer;
begin
  if not public.is_trip_owner(target_trip) then
    raise exception 'Only the trip organiser can publish';
  end if;

  perform 1 from public.trips where id = target_trip for update;
  if not found then raise exception 'Trip not found'; end if;
  if stops is null or jsonb_typeof(stops) <> 'array'
     or jsonb_array_length(stops) = 0 or jsonb_array_length(stops) > 120 then
    raise exception 'Supply between 1 and 120 activities';
  end if;
  if exists (
    select 1 from jsonb_array_elements(stops) x
    where coalesce(length(trim(x->>'title')), 0) = 0
       or length(x->>'title') > 120
       or coalesce(nullif(x->>'activity_category', ''), 'sightseeing') not in ('sightseeing', 'food', 'transport', 'stay')
  ) then
    raise exception 'Every activity needs a valid name and category';
  end if;

  select count(*) into expected_existing
  from jsonb_array_elements(stops) x
  where nullif(x->>'existing_id', '') is not null;

  if exists (
    select 1
    from jsonb_array_elements(stops) x
    where nullif(x->>'existing_id', '') is not null
    group by x->>'existing_id' having count(*) > 1
  ) then raise exception 'An existing activity appears more than once'; end if;

  update public.itinerary_items item
  set title = x->>'title',
      description = x->>'description',
      location_name = x->>'location_name',
      activity_category = nullif(x->>'activity_category', ''),
      start_time = nullif(x->>'start_time', '')::timestamptz,
      position = (a.ordinality - 1)::integer
  from jsonb_array_elements(stops) with ordinality a(x, ordinality)
  where nullif(x->>'existing_id', '') is not null
    and item.id = (x->>'existing_id')::uuid
    and item.trip_id = target_trip;
  get diagnostics updated_existing = row_count;

  if updated_existing <> expected_existing then
    raise exception 'An existing activity changed while this draft was open. Reload and review again.';
  end if;

  insert into public.itinerary_items
    (trip_id, title, description, location_name, activity_category, start_time, position)
  select target_trip, x->>'title', x->>'description', x->>'location_name',
         nullif(x->>'activity_category', ''), nullif(x->>'start_time', '')::timestamptz,
         (a.ordinality - 1)::integer
  from jsonb_array_elements(stops) with ordinality a(x, ordinality)
  where nullif(x->>'existing_id', '') is null;

  delete from public.itinerary_items item
  where item.trip_id = target_trip
    and not exists (
      select 1 from jsonb_array_elements(stops) x
      where nullif(x->>'existing_id', '') is not null
        and item.id = (x->>'existing_id')::uuid
    );
end;
$$;

revoke all on function public.publish_candidate_draft(uuid, jsonb) from public, anon;
grant execute on function public.publish_candidate_draft(uuid, jsonb) to authenticated;

commit;
