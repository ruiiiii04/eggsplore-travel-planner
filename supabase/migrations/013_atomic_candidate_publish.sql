-- Run after 012. Publish the reviewed shared draft and its saved status together.
begin;
create or replace function public.publish_shared_candidate_draft(target_trip uuid, expected_revision timestamptz, stops jsonb)
returns timestamptz language plpgsql security definer set search_path = '' as $$
declare current_pool public.trip_candidate_pools%rowtype;
new_revision timestamptz;
begin
  if not public.is_trip_owner(target_trip) then raise exception 'Only the Group Leader can publish the draft'; end if;
  perform pg_catalog.set_config('lock_timeout', '5s', true);
  perform 1 from public.trips where id = target_trip for update;
  select * into current_pool from public.trip_candidate_pools where trip_id = target_trip for update;
  if not found then raise exception 'Reload the shared candidate pool before publishing'; end if;
  if current_pool.updated_at is distinct from expected_revision then raise exception 'The group draft or votes changed. Review the latest draft before publishing again.'; end if;
  if current_pool.draft is null or jsonb_array_length(current_pool.draft) = 0 then raise exception 'There is no shared draft to publish'; end if;
  -- Keep the existing itinerary identity, snapshot and ownership validation.
  perform public.publish_candidate_draft(target_trip, stops);
  new_revision := clock_timestamp();
  update public.trip_candidate_pools set published = current_pool.draft, draft = null,
    draft_excluded_existing = '{}'::jsonb, updated_at = new_revision where trip_id = target_trip;
  return new_revision;
end;
$$;
revoke all on function public.publish_shared_candidate_draft(uuid,timestamptz,jsonb) from public,anon;
grant execute on function public.publish_shared_candidate_draft(uuid,timestamptz,jsonb) to authenticated;
commit;
