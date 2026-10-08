-- Apply after 017. Read current travel preferences with votes, including unchanged pool snapshots.
begin;
create or replace function public.read_trip_candidate_changes(target_trip uuid, known_revision timestamptz default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
 if not public.is_trip_member(target_trip) then raise exception 'Trip membership required'; end if;
 select jsonb_build_object(
  'revision', p.updated_at,
  'pool', case when p.updated_at is distinct from known_revision then to_jsonb(p) else null end,
  'votes', coalesce((select jsonb_agg(jsonb_build_object('candidate_id',v.candidate_id,'user_id',v.user_id,'vote',v.vote))
    from public.trip_candidate_votes v where v.trip_id=target_trip),'[]'::jsonb),
  'members', coalesce((
    select jsonb_agg(jsonb_build_object('user_id',participants.user_id,'profiles',(
     select coalesce(jsonb_agg(jsonb_build_object(
       'category',profile->'category','tags',profile->'tags','interests',profile->'interests','categoryWeights',profile->'categoryWeights'
     )),'[]'::jsonb)
     from jsonb_array_elements(case when jsonb_typeof(pr.preferences->'profiles')='array' then pr.preferences->'profiles' else '[]'::jsonb end) profile
    )))
    from (select t.owner_id as user_id from public.trips t where t.id=target_trip
      union select m.user_id from public.trip_members m where m.trip_id=target_trip) participants
    left join public.profiles pr on pr.id=participants.user_id
  ),'[]'::jsonb)
 ) into result from public.trip_candidate_pools p where p.trip_id=target_trip;
 return result;
end;
$$;
revoke all on function public.read_trip_candidate_changes(uuid,timestamptz) from public,anon;
grant execute on function public.read_trip_candidate_changes(uuid,timestamptz) to authenticated;

create or replace function public.read_candidate_group_preferences(target_trip uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
 if not public.is_trip_member(target_trip) then raise exception 'Trip membership required'; end if;
 select jsonb_build_object('destination',t.destination,'members',(
  select coalesce(jsonb_agg(jsonb_build_object('profiles',(
   select coalesce(jsonb_agg(jsonb_build_object(
    'category',profile->'category','tags',profile->'tags','interests',profile->'interests',
    'pace',profile->'pace','companion',profile->'companion','spendingOrder',profile->'spendingOrder',
    'categoryWeights',profile->'categoryWeights'
   )),'[]'::jsonb)
   from jsonb_array_elements(case when jsonb_typeof(p.preferences->'profiles')='array' then p.preferences->'profiles' else '[]'::jsonb end) profile
  ))),'[]'::jsonb)
  from (select t.owner_id as user_id union select m.user_id from public.trip_members m where m.trip_id=t.id) participants
  left join public.profiles p on p.id=participants.user_id
 )) into result from public.trips t where t.id=target_trip;
 return result;
end;
$$;
revoke all on function public.read_candidate_group_preferences(uuid) from public,anon;
grant execute on function public.read_candidate_group_preferences(uuid) to authenticated;
commit;
