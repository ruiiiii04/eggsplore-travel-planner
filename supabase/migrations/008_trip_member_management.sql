begin;

create or replace function public.list_trip_members(target_trip uuid)
returns table(user_id uuid, username text, display_name text, avatar_url text, role text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_trip_member(target_trip) then
    raise exception 'You are not a member of this trip';
  end if;

  return query
    select m.user_id, p.username, p.display_name, p.avatar_url, m.role
    from public.trip_members m
    join public.profiles p on p.id = m.user_id
    where m.trip_id = target_trip
    order by case when m.role = 'owner' then 0 else 1 end, lower(coalesce(p.display_name, p.username));
end;
$$;

revoke all on function public.list_trip_members(uuid) from public, anon;
grant execute on function public.list_trip_members(uuid) to authenticated;

drop policy if exists members_leave on public.trip_members;
create policy members_leave on public.trip_members for delete to authenticated
using (user_id = (select auth.uid()) and role = 'member');

commit;
