create table public.trip_private_notes (
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  items jsonb not null default '[]'::jsonb check (jsonb_typeof(items) = 'array'),
  additional_text text not null default '',
  updated_at timestamptz not null default now(),
  primary key (trip_id, user_id)
);

create trigger trip_private_notes_updated
  before update on public.trip_private_notes
  for each row execute function public.touch_updated_at();

alter table public.trip_private_notes enable row level security;

create policy trip_private_notes_read
  on public.trip_private_notes for select to authenticated
  using (user_id = (select auth.uid()) and public.is_trip_member(trip_id));

create policy trip_private_notes_add
  on public.trip_private_notes for insert to authenticated
  with check (user_id = (select auth.uid()) and public.is_trip_member(trip_id));

create policy trip_private_notes_update
  on public.trip_private_notes for update to authenticated
  using (user_id = (select auth.uid()) and public.is_trip_member(trip_id))
  with check (user_id = (select auth.uid()) and public.is_trip_member(trip_id));

create policy trip_private_notes_remove
  on public.trip_private_notes for delete to authenticated
  using (user_id = (select auth.uid()) and public.is_trip_member(trip_id));

revoke all on public.trip_private_notes from anon, public;
grant select, insert, update, delete on public.trip_private_notes to authenticated;
