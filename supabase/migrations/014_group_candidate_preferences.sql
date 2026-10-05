-- Run after 013. Only travel preferences are exposed to trip members.
begin;
create or replace function public.read_candidate_group_preferences(target_trip uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if not public.is_trip_member(target_trip) then raise exception 'Trip membership required'; end if;
  select jsonb_build_object('destination', t.destination, 'members', (
    select coalesce(jsonb_agg(jsonb_build_object('profiles', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'category', profile->'category', 'tags', profile->'tags', 'interests', profile->'interests',
        'pace', profile->'pace', 'companion', profile->'companion', 'spendingOrder', profile->'spendingOrder'
      )), '[]'::jsonb)
      from jsonb_array_elements(case when jsonb_typeof(p.preferences->'profiles') = 'array'
        then p.preferences->'profiles' else '[]'::jsonb end) profile
    ))), '[]'::jsonb)
    from (select t.owner_id as user_id union select m.user_id from public.trip_members m where m.trip_id = t.id) participants
    left join public.profiles p on p.id = participants.user_id
  )) into result from public.trips t where t.id = target_trip;
  return result;
end;
$$;
revoke all on function public.read_candidate_group_preferences(uuid) from public,anon;
grant execute on function public.read_candidate_group_preferences(uuid) to authenticated;
commit;
