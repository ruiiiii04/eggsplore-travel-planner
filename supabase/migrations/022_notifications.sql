-- 022_notifications.sql
-- In-app notifications. Users can read their own and mark them read, but
-- never create them: only the triggers below (and later server code) can.
begin;

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  trip_id uuid references public.trips(id) on delete cascade,
  type text not null check (type in
    ('expense_added','debt_paid','flight_delay','note_reminder','budget_alert')),
  title text not null,
  body text,
  data jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.notifications(user_id, created_at desc);

alter table public.notifications enable row level security;

create policy notifications_read on public.notifications
  for select to authenticated using (user_id = (select auth.uid()));
create policy notifications_mark_read on public.notifications
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

-- Someone added an expense that includes you.
create function public.notify_expense_split() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_exp public.expenses%rowtype;
  creator_name text;
  payer_name text;
begin
  select * into v_exp from public.expenses where id = new.expense_id;
  if not found then return new; end if;
  if new.settled or v_exp.paid_by is null
     or v_exp.paid_by = new.user_id or v_exp.created_by = new.user_id then
    return new;
  end if;
  select display_name into creator_name from public.profiles
    where id = coalesce(v_exp.created_by, v_exp.paid_by);
  select display_name into payer_name from public.profiles where id = v_exp.paid_by;
  insert into public.notifications (user_id, trip_id, type, title, body, data)
  values (
    new.user_id, v_exp.trip_id, 'expense_added',
    coalesce(creator_name, 'Someone') || ' added ' || v_exp.title,
    'You owe ' || coalesce(payer_name, 'them') || ' RM '
      || to_char(new.amount_owed, 'FM999999990.00'),
    jsonb_build_object('expense_id', v_exp.id)
  );
  return new;
end;
$$;
revoke all on function public.notify_expense_split() from public, anon, authenticated;
create trigger expense_split_notify after insert on public.expense_splits
  for each row execute function public.notify_expense_split();

-- Someone marked a debt to you as paid (one notification per update statement).
create function public.notify_splits_settled() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.notifications (user_id, trip_id, type, title, body, data)
  select ex.paid_by, ex.trip_id, 'debt_paid',
         coalesce(max(p.display_name), 'Someone') || ' marked a payment as paid',
         'RM ' || to_char(sum(n.amount_owed), 'FM999999990.00') || ' settled',
         jsonb_build_object('from_user', n.user_id)
  from new_rows n
  join old_rows o on o.id = n.id
  join public.expenses ex on ex.id = n.expense_id
  left join public.profiles p on p.id = n.user_id
  where o.settled = false and n.settled = true
    and ex.paid_by is not null and ex.paid_by <> n.user_id
  group by ex.paid_by, ex.trip_id, n.user_id;
  return null;
end;
$$;
revoke all on function public.notify_splits_settled() from public, anon, authenticated;
create trigger expense_splits_settled_notify after update on public.expense_splits
  referencing old table as old_rows new table as new_rows
  for each statement execute function public.notify_splits_settled();

commit;