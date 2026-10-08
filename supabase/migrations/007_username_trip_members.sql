begin;

alter table public.profiles add column username text;

update public.profiles
set username = left(coalesce(nullif(regexp_replace(lower(coalesce(display_name, '')), '[^a-z0-9]+', '', 'g'), ''), 'traveller'), 18)
  || '_' || substr(replace(id::text, '-', ''), 1, 8)
where username is null;

alter table public.profiles alter column username set not null;
create unique index profiles_username_lower_unique on public.profiles (lower(username));

create or replace function public.assign_profile_username()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.username is null or trim(new.username) = '' then
    new.username := left(coalesce(nullif(regexp_replace(lower(coalesce(new.display_name, '')), '[^a-z0-9]+', '', 'g'), ''), 'traveller'), 18)
      || '_' || substr(replace(new.id::text, '-', ''), 1, 8);
  end if;
  return new;
end;
$$;

create trigger profiles_assign_username
before insert on public.profiles
for each row execute function public.assign_profile_username();

create or replace function public.find_trip_member_by_username(search_username text)
returns table(id uuid, username text, display_name text, avatar_url text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.username, p.display_name, p.avatar_url
  from public.profiles p
  where lower(p.username) = lower(trim(both '@' from search_username))
    and p.id <> (select auth.uid())
  limit 1;
$$;

revoke all on function public.assign_profile_username() from public, anon, authenticated;
revoke all on function public.find_trip_member_by_username(text) from public, anon;
grant execute on function public.find_trip_member_by_username(text) to authenticated;

commit;
