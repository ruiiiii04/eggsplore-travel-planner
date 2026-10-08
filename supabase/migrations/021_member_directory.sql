-- 004_member_directory.sql
-- Lets trip members see each other's display name and avatar only.
-- profiles stays private (emergency_contact etc. are never exposed).
begin;

create function public.trip_member_profiles(target uuid)
returns table (user_id uuid, display_name text, avatar_url text)
language sql stable security definer set search_path = '' as $$
  select p.id, p.display_name, p.avatar_url
  from public.trip_members m
  join public.profiles p on p.id = m.user_id
  where m.trip_id = target
    and public.is_trip_member(target);
$$;

revoke all on function public.trip_member_profiles(uuid) from public, anon;
grant execute on function public.trip_member_profiles(uuid) to authenticated;

commit;