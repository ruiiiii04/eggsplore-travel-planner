-- 002_expenses_module_d.sql
-- Module D: expense splitting. Any trip member may log/manage expenses
-- (not owner-only, per team decision). Run once against the existing
-- foundation schema. Do not drop existing tables.

begin;

-- Track who actually logged the expense (may differ from who paid)
alter table public.expenses add column created_by uuid references public.profiles(id);

-- Replace owner-only expense policies with member-level policies
drop policy expenses_add on public.expenses;
drop policy expenses_update on public.expenses;
drop policy expenses_remove on public.expenses;

create policy expenses_add on public.expenses
  for insert to authenticated
  with check (
    public.is_trip_member(trip_id)
    and created_by = (select auth.uid())
    and (paid_by is null or exists(
      select 1 from public.trip_members m
      where m.trip_id = expenses.trip_id and m.user_id = paid_by
    ))
  );

-- Only the person who logged the expense, or the trip owner, may edit/delete it
create policy expenses_update on public.expenses
  for update to authenticated
  using (created_by = (select auth.uid()) or public.is_trip_owner(trip_id))
  with check (
    public.is_trip_member(trip_id)
    and (paid_by is null or exists(
      select 1 from public.trip_members m
      where m.trip_id = expenses.trip_id and m.user_id = paid_by
    ))
  );

create policy expenses_remove on public.expenses
  for delete to authenticated
  using (created_by = (select auth.uid()) or public.is_trip_owner(trip_id));

-- New table: per-member share of each expense
create table public.expense_splits (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount_owed numeric(12,2) not null check (amount_owed >= 0),
  settled boolean not null default false,
  created_at timestamptz not null default now(),
  unique(expense_id, user_id)
);

create index on public.expense_splits(expense_id);
create index on public.expense_splits(user_id);

alter table public.expense_splits enable row level security;

-- Readable by any trip member (join through expenses -> trip_id)
create policy expense_splits_read on public.expense_splits
  for select to authenticated
  using (
    exists(
      select 1 from public.expenses e
      where e.id = expense_splits.expense_id
      and public.is_trip_member(e.trip_id)
    )
  );

-- Only the expense's creator or trip owner may define/edit the split
create policy expense_splits_add on public.expense_splits
  for insert to authenticated
  with check (
    exists(
      select 1 from public.expenses e
      where e.id = expense_splits.expense_id
      and (e.created_by = (select auth.uid()) or public.is_trip_owner(e.trip_id))
    )
  );

create policy expense_splits_update on public.expense_splits
  for update to authenticated
  using (
    -- the person who owes it can mark their own split settled
    user_id = (select auth.uid())
    or exists(
      select 1 from public.expenses e
      where e.id = expense_splits.expense_id
      and (e.created_by = (select auth.uid()) or public.is_trip_owner(e.trip_id))
    )
  )
  with check (
    exists(
      select 1 from public.expenses e
      where e.id = expense_splits.expense_id
      and public.is_trip_member(e.trip_id)
    )
  );

create policy expense_splits_remove on public.expense_splits
  for delete to authenticated
  using (
    exists(
      select 1 from public.expenses e
      where e.id = expense_splits.expense_id
      and (e.created_by = (select auth.uid()) or public.is_trip_owner(e.trip_id))
    )
  );

revoke all on public.expense_splits from anon;
grant select, insert, update, delete on public.expense_splits to authenticated;

commit;