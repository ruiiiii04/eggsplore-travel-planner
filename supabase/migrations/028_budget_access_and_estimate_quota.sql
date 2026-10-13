-- Tighten budget privacy and settlement permissions. Add a separate
-- per-user quota for paid cost-estimate requests so it does not consume the
-- Ask AI chat quota.
begin;

-- Budgets are personal: trip members may read only their own budget row.
drop policy if exists trip_budgets_read on public.trip_budgets;
create policy trip_budgets_read on public.trip_budgets
  for select to authenticated
  using (user_id = (select auth.uid()) and public.is_trip_member(trip_id));

-- A debtor may change only the settled flag on their own split. Column-level
-- grants prevent changing amount_owed or moving the split to another user.
drop policy if exists expense_splits_update on public.expense_splits;
create policy expense_splits_update on public.expense_splits
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
revoke update on public.expense_splits from authenticated;
grant update (settled) on public.expense_splits to authenticated;

-- Save an expense and all of its shares in one transaction. This avoids an
-- orphan expense if a second client request fails while inserting the splits.
create function public.add_trip_expense(
  target_trip uuid,
  expense_title text,
  expense_amount numeric,
  expense_category text,
  target_paid_by uuid,
  target_original_amount numeric,
  target_original_currency text,
  split_rows jsonb
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  caller uuid := auth.uid();
  new_expense uuid;
  shares_total numeric;
begin
  if caller is null then raise exception 'Sign in to add an expense'; end if;
  if not public.is_trip_member(target_trip) then raise exception 'Trip membership required'; end if;
  if expense_title is null or length(trim(expense_title)) = 0 then raise exception 'Enter an expense title'; end if;
  if expense_amount is null or expense_amount <= 0 or expense_amount <> round(expense_amount, 2)
     or target_original_amount is null or target_original_amount <= 0
     or target_original_amount <> round(target_original_amount, 2) then
    raise exception 'Expense amounts must be greater than zero';
  end if;
  if target_original_currency is null or length(trim(target_original_currency)) = 0 then
    raise exception 'Choose a currency';
  end if;
  if target_paid_by is null or not exists (
    select 1 from public.trip_members m
    where m.trip_id = target_trip and m.user_id = target_paid_by
  ) then raise exception 'The payer must be a trip member'; end if;
  if jsonb_typeof(split_rows) <> 'array' or jsonb_array_length(split_rows) > 100 then
    raise exception 'Invalid expense splits';
  end if;
  if exists (
    select 1 from jsonb_to_recordset(split_rows) as s(user_id uuid, amount_owed numeric, settled boolean)
    where s.user_id is null or s.amount_owed is null or s.amount_owed < 0
       or s.amount_owed <> round(s.amount_owed, 2) or s.settled is null
       or not exists (select 1 from public.trip_members m where m.trip_id = target_trip and m.user_id = s.user_id)
       or (s.settled and s.user_id <> target_paid_by)
       or (not s.settled and s.user_id = target_paid_by)
  ) then raise exception 'Splits must belong to trip members and only the payer share can be settled'; end if;
  select coalesce(sum(s.amount_owed), 0) into shares_total
  from jsonb_to_recordset(split_rows) as s(user_id uuid, amount_owed numeric, settled boolean);
  if round(shares_total * 100) <> round(expense_amount * 100) then
    raise exception 'Expense splits must add up to the expense total';
  end if;

  insert into public.expenses (
    trip_id, paid_by, created_by, title, amount, category, original_amount, original_currency
  ) values (
    target_trip, target_paid_by, caller, trim(expense_title), expense_amount,
    expense_category, target_original_amount, upper(trim(target_original_currency))
  ) returning id into new_expense;

  insert into public.expense_splits (expense_id, user_id, amount_owed, settled)
  select new_expense, s.user_id, s.amount_owed, s.settled
  from jsonb_to_recordset(split_rows) as s(user_id uuid, amount_owed numeric, settled boolean);
  return new_expense;
end;
$$;
revoke all on function public.add_trip_expense(uuid,text,numeric,text,uuid,numeric,text,jsonb) from public, anon, service_role;
grant execute on function public.add_trip_expense(uuid,text,numeric,text,uuid,numeric,text,jsonb) to authenticated;

-- Separate persistent quota for Groq-backed cost estimates: 5 requests/minute
-- and 30 requests/day per signed-in user.
create table public.cost_estimate_request_usage (
  user_id uuid primary key references auth.users(id) on delete cascade,
  usage_day date not null,
  day_count integer not null default 0 check (day_count between 0 and 30),
  recent_requests timestamptz[] not null default '{}'::timestamptz[]
);
alter table public.cost_estimate_request_usage enable row level security;
revoke all on table public.cost_estimate_request_usage from public, anon, authenticated, service_role;

create function public.consume_cost_estimate_request()
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  caller uuid := auth.uid();
  current_time_utc timestamptz;
  current_day date;
  usage public.cost_estimate_request_usage%rowtype;
  recent timestamptz[];
begin
  if caller is null then return false; end if;
  insert into public.cost_estimate_request_usage(user_id, usage_day)
  values (caller, (clock_timestamp() at time zone 'UTC')::date)
  on conflict (user_id) do nothing;

  select * into usage from public.cost_estimate_request_usage
  where user_id = caller for update;
  current_time_utc := clock_timestamp();
  current_day := (current_time_utc at time zone 'UTC')::date;
  select coalesce(array_agg(request_time), '{}'::timestamptz[]) into recent
  from unnest(usage.recent_requests) as requests(request_time)
  where request_time > current_time_utc - interval '1 minute';
  if usage.usage_day <> current_day then usage.day_count := 0; end if;
  if cardinality(recent) >= 5 or usage.day_count >= 30 then return false; end if;

  update public.cost_estimate_request_usage
  set usage_day = current_day, day_count = usage.day_count + 1,
      recent_requests = array_append(recent, current_time_utc)
  where user_id = caller;
  return true;
end;
$$;
revoke all on function public.consume_cost_estimate_request() from public, anon, authenticated, service_role;
grant execute on function public.consume_cost_estimate_request() to authenticated;

commit;
