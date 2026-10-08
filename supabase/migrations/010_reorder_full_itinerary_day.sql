begin;

create or replace function public.reorder_itinerary_day(
  target_trip uuid,
  ordered_items uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_day_key text;
  day_count integer;
  slot_ids uuid[];
  slot_positions integer[];
  slot_start_times timestamptz[];
  slot_times text[];
  slot_index integer;
  source_index integer;
  activity_id uuid;
begin
  if not public.is_trip_owner(target_trip) then
    raise exception 'Only the trip organiser can reorder itinerary activities';
  end if;
  -- Serialize itinerary writes briefly so a concurrent add/edit cannot make
  -- the supplied whole-day ordering incomplete midway through the reorder.
  lock table public.itinerary_items in share row exclusive mode;
  if ordered_items is null or cardinality(ordered_items) = 0 then
    raise exception 'Select itinerary activities to reorder';
  end if;
  if cardinality(ordered_items) <> (select count(distinct id) from unnest(ordered_items) as values_list(id)) then
    raise exception 'The activity order contains duplicates';
  end if;

  select case
    when i.start_time is not null then 'date:' || to_char(i.start_time at time zone 'UTC', 'YYYY-MM-DD')
    else coalesce('ordinal:' || substring(i.description from '^Day ([0-9]+)'), 'flexible')
  end
  into target_day_key
  from public.itinerary_items i
  where i.id = ordered_items[1] and i.trip_id = target_trip;
  if not found then raise exception 'Activity not found'; end if;

  if exists (
    select 1
    from unnest(ordered_items) as requested(id)
    where not exists (
      select 1 from public.itinerary_items i
      where i.id = requested.id and i.trip_id = target_trip
        and (case
          when i.start_time is not null then 'date:' || to_char(i.start_time at time zone 'UTC', 'YYYY-MM-DD')
          else coalesce('ordinal:' || substring(i.description from '^Day ([0-9]+)'), 'flexible')
        end) = target_day_key
    )
  ) then raise exception 'Activities can only be reordered within the same day'; end if;

  with day_items as (
    select i.id
    from public.itinerary_items i
    where i.trip_id = target_trip and (case
      when i.start_time is not null then 'date:' || to_char(i.start_time at time zone 'UTC', 'YYYY-MM-DD')
      else coalesce('ordinal:' || substring(i.description from '^Day ([0-9]+)'), 'flexible')
    end) = target_day_key
  )
  select count(*) into day_count from day_items;
  if day_count <> cardinality(ordered_items) then
    raise exception 'This itinerary day changed. Reload it and try again';
  end if;

  perform i.id
  from public.itinerary_items i
  where i.trip_id = target_trip and (case
    when i.start_time is not null then 'date:' || to_char(i.start_time at time zone 'UTC', 'YYYY-MM-DD')
    else coalesce('ordinal:' || substring(i.description from '^Day ([0-9]+)'), 'flexible')
  end) = target_day_key
  order by i.id
  for update;

  with day_items as (
    select i.id, i.position, i.start_time,
      coalesce(to_char(i.start_time at time zone 'UTC', 'HH24:MI'), substring(i.description from '[0-2][0-9]:[0-5][0-9]')) as activity_time
    from public.itinerary_items i
    where i.trip_id = target_trip and (case
      when i.start_time is not null then 'date:' || to_char(i.start_time at time zone 'UTC', 'YYYY-MM-DD')
      else coalesce('ordinal:' || substring(i.description from '^Day ([0-9]+)'), 'flexible')
    end) = target_day_key
  )
  select array_agg(id order by (activity_time is null), activity_time, position, id),
         array_agg(position order by (activity_time is null), activity_time, position, id),
         array_agg(start_time order by (activity_time is null), activity_time, position, id),
         array_agg(activity_time order by (activity_time is null), activity_time, position, id)
  into slot_ids, slot_positions, slot_start_times, slot_times
  from day_items;

  for slot_index in 1..day_count loop
    activity_id := ordered_items[slot_index];
    source_index := array_position(slot_ids, activity_id);
    if source_index is null then raise exception 'This itinerary day changed. Reload it and try again'; end if;
    if (slot_times[source_index] is null) <> (slot_times[slot_index] is null) then
      raise exception 'Activities with times can only be moved among other scheduled activities';
    end if;

    update public.itinerary_items i
    set position = slot_positions[slot_index],
        start_time = slot_start_times[slot_index],
        description = case
          when i.start_time is null and slot_start_times[slot_index] is null
            and slot_times[slot_index] is not null
            then regexp_replace(i.description, '[0-2][0-9]:[0-5][0-9]', slot_times[slot_index])
          else i.description
        end
    where i.id = activity_id and i.trip_id = target_trip;
  end loop;
end;
$$;

revoke all on function public.reorder_itinerary_day(uuid, uuid[]) from public, anon;
grant execute on function public.reorder_itinerary_day(uuid, uuid[]) to authenticated;

commit;
