begin;

create or replace function public.swap_itinerary_positions(
  target_trip uuid,
  first_item uuid,
  second_item uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  first_position integer;
  second_position integer;
  first_start_time timestamptz;
  second_start_time timestamptz;
  first_description text;
  second_description text;
  first_day_key text;
  second_day_key text;
  first_legacy_time text;
  second_legacy_time text;
begin
  if not public.is_trip_owner(target_trip) then
    raise exception 'Only the trip organiser can reorder itinerary activities';
  end if;
  if first_item = second_item then
    return;
  end if;

  select position, start_time, description,
    case when start_time is not null then to_char(start_time at time zone 'UTC', 'YYYY-MM-DD')
      else coalesce(substring(description from '^Day ([0-9]+)'), 'flexible') end
  into first_position, first_start_time, first_description, first_day_key
  from public.itinerary_items
  where id = first_item and trip_id = target_trip
  for update;
  if not found then raise exception 'Activity not found'; end if;

  select position, start_time, description,
    case when start_time is not null then to_char(start_time at time zone 'UTC', 'YYYY-MM-DD')
      else coalesce(substring(description from '^Day ([0-9]+)'), 'flexible') end
  into second_position, second_start_time, second_description, second_day_key
  from public.itinerary_items
  where id = second_item and trip_id = target_trip
  for update;
  if not found then raise exception 'Activity not found'; end if;
  if first_day_key is distinct from second_day_key then
    raise exception 'Activities can only be reordered within the same day';
  end if;

  if first_start_time is null and second_start_time is null then
    first_legacy_time := substring(first_description from '[0-2][0-9]:[0-5][0-9]');
    second_legacy_time := substring(second_description from '[0-2][0-9]:[0-5][0-9]');
    if (first_legacy_time is null) <> (second_legacy_time is null) then
      raise exception 'Add a time to both activities before reordering them';
    end if;
  end if;

  update public.itinerary_items
  set position = second_position,
      start_time = second_start_time,
      description = case when first_start_time is null and second_start_time is null
        and first_legacy_time is not null and second_legacy_time is not null
        then regexp_replace(first_description, '[0-2][0-9]:[0-5][0-9]', second_legacy_time)
        else first_description end
  where id = first_item and trip_id = target_trip;

  update public.itinerary_items
  set position = first_position,
      start_time = first_start_time,
      description = case when first_start_time is null and second_start_time is null
        and first_legacy_time is not null and second_legacy_time is not null
        then regexp_replace(second_description, '[0-2][0-9]:[0-5][0-9]', first_legacy_time)
        else second_description end
  where id = second_item and trip_id = target_trip;
end;
$$;

revoke all on function public.swap_itinerary_positions(uuid, uuid, uuid) from public, anon;
grant execute on function public.swap_itinerary_positions(uuid, uuid, uuid) to authenticated;

commit;
