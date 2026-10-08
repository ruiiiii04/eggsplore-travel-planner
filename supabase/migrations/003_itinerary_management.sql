-- Keep itinerary categories separate from AI-generated descriptions.
alter table public.itinerary_items
  add column if not exists activity_category text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'itinerary_items_activity_category_check'
      and conrelid = 'public.itinerary_items'::regclass
  ) then
    alter table public.itinerary_items
      add constraint itinerary_items_activity_category_check
      check (activity_category is null or activity_category in ('sightseeing', 'food', 'transport', 'stay'));
  end if;
end;
$$;

-- Delete a calendar day, its activities, and compact later days in one transaction.
create or replace function public.delete_trip_day(target_trip uuid, target_day date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  trip_start date;
  trip_end date;
begin
  if not public.is_trip_owner(target_trip) then
    raise exception 'Only the trip organiser can remove itinerary days';
  end if;

  select start_date, end_date into trip_start, trip_end
  from public.trips
  where id = target_trip
  for update;

  if not found or trip_start is null or trip_end is null then
    raise exception 'Set trip dates before removing an itinerary day';
  end if;
  if target_day < trip_start or target_day > trip_end then
    raise exception 'The selected date is outside this trip';
  end if;

  delete from public.itinerary_items
  where trip_id = target_trip
    and (start_time at time zone 'UTC')::date = target_day;

  update public.itinerary_items
  set start_time = ((start_time at time zone 'UTC') - interval '1 day') at time zone 'UTC'
  where trip_id = target_trip
    and start_time is not null
    and (start_time at time zone 'UTC')::date > target_day;

  if trip_start = trip_end then
    update public.trips set start_date = null, end_date = null where id = target_trip;
  else
    update public.trips set end_date = trip_end - 1 where id = target_trip;
  end if;
end;
$$;

-- Move adjacent activities without risking a half-completed position swap.
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
  first_day date;
  second_day date;
begin
  if not public.is_trip_owner(target_trip) then
    raise exception 'Only the trip organiser can reorder itinerary activities';
  end if;
  if first_item = second_item then
    return;
  end if;

  select position, (start_time at time zone 'UTC')::date
  into first_position, first_day
  from public.itinerary_items
  where id = first_item and trip_id = target_trip
  for update;
  if not found then raise exception 'Activity not found'; end if;

  select position, (start_time at time zone 'UTC')::date
  into second_position, second_day
  from public.itinerary_items
  where id = second_item and trip_id = target_trip
  for update;
  if not found then raise exception 'Activity not found'; end if;
  if first_day is distinct from second_day then
    raise exception 'Activities can only be reordered within the same day';
  end if;

  update public.itinerary_items set position = second_position where id = first_item;
  update public.itinerary_items set position = first_position where id = second_item;
end;
$$;

revoke all on function public.delete_trip_day(uuid, date) from public, anon;
revoke all on function public.swap_itinerary_positions(uuid, uuid, uuid) from public, anon;
grant execute on function public.delete_trip_day(uuid, date) to authenticated;
grant execute on function public.swap_itinerary_positions(uuid, uuid, uuid) to authenticated;
