-- 003_budget_module_d.sql
-- Module D: per-person trip budgets + currency tracking on expenses.
-- Run once against the existing foundation + 002 migration. Do not drop
-- existing tables.

begin;

-- Each trip member sets their own independent budget for the trip
create table public.trip_budgets (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  budget_amount numeric(12,2) not null check (budget_amount >= 0),
  currency text not null default 'RM',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(trip_id, user_id)
);

create index on public.trip_budgets(trip_id);
create index on public.trip_budgets(user_id);

alter table public.trip_budgets enable row level security;

-- Any trip member can see everyone's budget (needed for group budget view)
create policy trip_budgets_read on public.trip_budgets
  for select to authenticated
  using (public.is_trip_member(trip_id));

-- A user may only set/edit/delete their OWN budget — not anyone else's
create policy trip_budgets_add on public.trip_budgets
  for insert to authenticated
  with check (
    public.is_trip_member(trip_id)
    and user_id = (select auth.uid())
  );

create policy trip_budgets_update on public.trip_budgets
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy trip_budgets_remove on public.trip_budgets
  for delete to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.trip_budgets from anon;
grant select, insert, update, delete on public.trip_budgets to authenticated;

create trigger trip_budgets_updated before update on public.trip_budgets
  for each row execute function public.touch_updated_at();

-- Currency tracking on expenses: store what the user typed, plus the
-- converted RM amount locked in at entry time (so historical expenses
-- don't shift if conversion rates change later).
alter table public.expenses
  add column original_amount numeric(12,2),
  add column original_currency text not null default 'RM';

-- Backfill existing rows (if any) so original_amount matches amount in RM
update public.expenses
  set original_amount = amount, original_currency = 'RM'
  where original_amount is null;

commit;