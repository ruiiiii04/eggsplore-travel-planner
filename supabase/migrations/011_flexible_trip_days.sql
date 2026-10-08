-- Preserve manually added itinerary days for trips without calendar dates.
alter table public.trips
  add column if not exists flexible_day_count integer not null default 1
  check (flexible_day_count >= 1);

grant update(flexible_day_count) on public.trips to authenticated;
