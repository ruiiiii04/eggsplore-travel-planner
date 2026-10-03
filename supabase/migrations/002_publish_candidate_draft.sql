-- Run after 001_foundation.sql. Atomically replace an itinerary; only its owner may publish.
begin;
create or replace function public.publish_candidate_draft(target_trip uuid, stops jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
 if not public.is_trip_owner(target_trip) then raise exception 'Only the trip organiser can publish'; end if;
 -- Serialise simultaneous publishes for this trip.
 perform 1 from public.trips where id=target_trip for update;
 if stops is null or jsonb_typeof(stops) <> 'array' or jsonb_array_length(stops) = 0 or jsonb_array_length(stops)>120 then
  raise exception 'Supply between 1 and 120 activities';
 end if;
 if exists(select 1 from jsonb_array_elements(stops) x where coalesce(length(trim(x->>'title')),0)=0 or length(x->>'title')>120) then
  raise exception 'Every activity requires a name of at most 120 characters';
 end if;
 delete from public.itinerary_items where trip_id=target_trip;
 insert into public.itinerary_items(trip_id,title,description,location_name,start_time,position)
 select target_trip,x->>'title',x->>'description',x->>'location_name',nullif(x->>'start_time','')::timestamptz,(ordinality-1)::integer
 from jsonb_array_elements(stops) with ordinality a(x,ordinality);
end;
$$;
revoke all on function public.publish_candidate_draft(uuid,jsonb) from public,anon;
grant execute on function public.publish_candidate_draft(uuid,jsonb) to authenticated;
commit;
