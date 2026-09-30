-- Run ONCE in a new Supabase project. Transactional: no partial setup on error.
-- If these tables already exist, do not drop them: reconcile the schema first.
begin;
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 display_name text, avatar_url text,
 preferences jsonb not null default '{}'::jsonb,
 emergency_contact jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.trips (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references public.profiles(id),
 title text not null check (length(trim(title)) > 0), destination text,
 start_date date, end_date date,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check (end_date is null or start_date is null or end_date >= start_date)
);
create table public.trip_members (
 id uuid primary key default gen_random_uuid(),
 trip_id uuid not null references public.trips(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 role text not null default 'member' check (role in ('owner','member')),
 joined_at timestamptz not null default now(), unique(trip_id,user_id)
);
create table public.expenses (
 id uuid primary key default gen_random_uuid(),
 trip_id uuid not null references public.trips(id) on delete cascade,
 paid_by uuid references public.profiles(id) on delete set null,
 title text not null check(length(trim(title)) > 0),
 amount numeric(12,2) not null check(amount >= 0), category text,
 created_at timestamptz not null default now()
);
create table public.itinerary_items (
 id uuid primary key default gen_random_uuid(),
 trip_id uuid not null references public.trips(id) on delete cascade,
 title text not null check(length(trim(title)) > 0), description text, location_name text,
 latitude double precision check(latitude between -90 and 90),
 longitude double precision check(longitude between -180 and 180),
 start_time timestamptz, end_time timestamptz, position integer not null default 0,
 created_at timestamptz not null default now(),
 check(end_time is null or start_time is null or end_time >= start_time)
);
create index on public.trips(owner_id);
create index on public.trip_members(user_id,trip_id);
create index on public.expenses(trip_id);
create index on public.itinerary_items(trip_id);

-- Definer helpers avoid recursive RLS when checking membership. Authenticated
-- clients can check only their OWN membership/ownership (no user-id argument).
create function public.is_trip_owner(target uuid) returns boolean
language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.trips where id = target and owner_id = (select auth.uid()));
$$;
create function public.is_trip_member(target uuid) returns boolean
language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.trips where id = target and owner_id = (select auth.uid()))
 or exists(select 1 from public.trip_members where trip_id = target and user_id = (select auth.uid()));
$$;
revoke all on function public.is_trip_owner(uuid), public.is_trip_member(uuid) from public, anon;
grant execute on function public.is_trip_owner(uuid), public.is_trip_member(uuid) to authenticated;

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
 insert into public.profiles(id,display_name,avatar_url)
 values(new.id,coalesce(new.raw_user_meta_data->>'full_name',new.raw_user_meta_data->>'name',split_part(new.email,'@',1)),new.raw_user_meta_data->>'avatar_url');
 return new;
end;
$$;
revoke all on function public.handle_new_user() from public, anon, authenticated;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
-- Include users created before this migration.
insert into public.profiles(id,display_name,avatar_url)
select id,coalesce(raw_user_meta_data->>'full_name',raw_user_meta_data->>'name',split_part(email,'@',1)),raw_user_meta_data->>'avatar_url' from auth.users
on conflict(id) do nothing;

create function public.add_trip_owner() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
 insert into public.trip_members(trip_id,user_id,role) values(new.id,new.owner_id,'owner');
 return new;
end;
$$;
revoke all on function public.add_trip_owner() from public, anon, authenticated;
create trigger after_trip_created after insert on public.trips for each row execute function public.add_trip_owner();
create function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger profiles_updated before update on public.profiles for each row execute function public.touch_updated_at();
create trigger trips_updated before update on public.trips for each row execute function public.touch_updated_at();

alter table public.profiles enable row level security;
alter table public.trips enable row level security;
alter table public.trip_members enable row level security;
alter table public.expenses enable row level security;
alter table public.itinerary_items enable row level security;
-- Private profile fields stay visible only to their owner. A later member
-- directory must expose only public display fields, not emergency contacts.
create policy profiles_read on public.profiles for select to authenticated using(id=(select auth.uid()));
create policy profiles_update on public.profiles for update to authenticated using(id=(select auth.uid())) with check(id=(select auth.uid()));
create policy trips_read on public.trips for select to authenticated using(owner_id=(select auth.uid()) or public.is_trip_member(id));
create policy trips_create on public.trips for insert to authenticated with check(owner_id=(select auth.uid()));
create policy trips_update on public.trips for update to authenticated using(public.is_trip_owner(id)) with check(owner_id=(select auth.uid()));
create policy trips_delete on public.trips for delete to authenticated using(public.is_trip_owner(id));
create policy members_read on public.trip_members for select to authenticated using(public.is_trip_member(trip_id));
-- No self-join and no role promotion. Owner alone adds/removes ordinary members.
create policy members_add on public.trip_members for insert to authenticated with check(public.is_trip_owner(trip_id) and role='member' and not exists(select 1 from public.trips where id=trip_id and owner_id=user_id));
create policy members_remove on public.trip_members for delete to authenticated using(public.is_trip_owner(trip_id) and role='member');
create policy expenses_read on public.expenses for select to authenticated using(public.is_trip_member(trip_id));
-- Foundation permits owner-managed expenses. Expand with per-author rules when
-- Module D adds created_by, expense splits and payer-membership validation.
create policy expenses_add on public.expenses for insert to authenticated with check(public.is_trip_owner(trip_id) and (paid_by is null or exists(select 1 from public.trip_members m where m.trip_id=expenses.trip_id and m.user_id=paid_by)));
create policy expenses_update on public.expenses for update to authenticated using(public.is_trip_owner(trip_id)) with check(public.is_trip_owner(trip_id) and (paid_by is null or exists(select 1 from public.trip_members m where m.trip_id=expenses.trip_id and m.user_id=paid_by)));
create policy expenses_remove on public.expenses for delete to authenticated using(public.is_trip_owner(trip_id));
create policy itinerary_read on public.itinerary_items for select to authenticated using(public.is_trip_member(trip_id));
create policy itinerary_add on public.itinerary_items for insert to authenticated with check(public.is_trip_owner(trip_id));
create policy itinerary_update on public.itinerary_items for update to authenticated using(public.is_trip_owner(trip_id)) with check(public.is_trip_owner(trip_id));
create policy itinerary_remove on public.itinerary_items for delete to authenticated using(public.is_trip_owner(trip_id));
revoke all on public.profiles,public.trips,public.trip_members,public.expenses,public.itinerary_items from anon;
grant select,update on public.profiles to authenticated;
grant select,insert,update,delete on public.trips,public.trip_members,public.expenses,public.itinerary_items to authenticated;
-- ID cannot be changed through the client; trip owner cannot be transferred.
revoke update on public.profiles from authenticated;
grant update(display_name,avatar_url,preferences,emergency_contact) on public.profiles to authenticated;
revoke update on public.trips from authenticated;
grant update(title,destination,start_date,end_date) on public.trips to authenticated;
commit;
