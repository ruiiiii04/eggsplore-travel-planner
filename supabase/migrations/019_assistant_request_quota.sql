-- Apply after 018. Persistent per-user Ask AI quota; clients can only consume via RPC.
begin;
create table public.assistant_request_usage (
 user_id uuid primary key references auth.users(id) on delete cascade,
 usage_day date not null,
 day_count integer not null default 0 check (day_count between 0 and 30),
 recent_requests timestamptz[] not null default '{}'::timestamptz[]
);
alter table public.assistant_request_usage enable row level security;
revoke all on table public.assistant_request_usage from public, anon, authenticated, service_role;

create or replace function public.consume_assistant_request()
returns boolean language plpgsql security definer set search_path = '' as $$
declare
 caller uuid := auth.uid();
 current_time_utc timestamptz;
 current_day date;
 usage public.assistant_request_usage%rowtype;
 recent timestamptz[];
begin
 if caller is null then return false; end if;
 insert into public.assistant_request_usage(user_id, usage_day)
 values (caller, (clock_timestamp() at time zone 'UTC')::date)
 on conflict (user_id) do nothing;
 -- Serialize concurrent requests for the same user before checking either limit.
 select * into usage from public.assistant_request_usage where user_id = caller for update;
 current_time_utc := clock_timestamp();
 current_day := (current_time_utc at time zone 'UTC')::date;
 select coalesce(array_agg(request_time), '{}'::timestamptz[]) into recent
 from unnest(usage.recent_requests) as requests(request_time)
 where request_time > current_time_utc - interval '1 minute';
 if usage.usage_day <> current_day then usage.day_count := 0; end if;
 if cardinality(recent) >= 5 or usage.day_count >= 30 then return false; end if;
 update public.assistant_request_usage
 set usage_day = current_day, day_count = usage.day_count + 1,
     recent_requests = array_append(recent, current_time_utc)
 where user_id = caller;
 return true;
end;
$$;
revoke all on function public.consume_assistant_request() from public, anon, authenticated, service_role;
grant execute on function public.consume_assistant_request() to authenticated;
commit;
