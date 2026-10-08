-- Apply after 014. Return the committed itinerary to the publisher in one request.
begin;
create or replace function public.publish_shared_candidate_plan(target_trip uuid, reviewed_draft jsonb, stops jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare current_pool public.trip_candidate_pools%rowtype;
revision timestamptz;
itinerary jsonb;
number_of_days integer;
begin
  if not public.is_trip_owner(target_trip) then raise exception 'Only the Group Leader can publish the draft'; end if;
  perform pg_catalog.set_config('lock_timeout', '5s', true);
  perform 1 from public.trips where id = target_trip for update;
  select * into current_pool from public.trip_candidate_pools where trip_id = target_trip for update;
  if not found or current_pool.draft is null then raise exception 'Reload and review the current shared draft before publishing'; end if;
  if current_pool.draft is distinct from reviewed_draft then raise exception 'The shared draft changed. Review the latest plan before publishing again.'; end if;
  -- Votes can change without changing the reviewed plan. Use the locked revision.
  revision := public.publish_shared_candidate_draft(target_trip, current_pool.updated_at, stops);
  select greatest(coalesce(max(least(120, (d->>'day')::numeric)::integer), 1), 1) into number_of_days
  from jsonb_array_elements(reviewed_draft) d where d->>'day' ~ '^[0-9]+$';
  update public.trips set flexible_day_count = greatest(flexible_day_count, number_of_days)
  where id = target_trip and start_date is null;
  select coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'title', i.title,
    'description', i.description, 'activity_category', i.activity_category,
    'location_name', i.location_name, 'start_time', i.start_time, 'position', i.position)
    order by i.position, i.id), '[]'::jsonb) into itinerary
  from public.itinerary_items i where i.trip_id = target_trip;
  if jsonb_array_length(itinerary) = 0 then raise exception 'No itinerary activities were saved. Publication was rolled back.'; end if;
  return jsonb_build_object('revision', revision, 'items', itinerary,
    'flexibleDayCount', (select flexible_day_count from public.trips where id = target_trip));
end;
$$;
revoke all on function public.publish_shared_candidate_plan(uuid,jsonb,jsonb) from public,anon;
grant execute on function public.publish_shared_candidate_plan(uuid,jsonb,jsonb) to authenticated;
commit;
