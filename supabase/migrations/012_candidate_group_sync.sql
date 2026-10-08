-- Run after migrations 001 through 011. Reads candidate data and all votes
-- in one database snapshot; only the leader can change published status.
begin;
create or replace function public.read_trip_candidate_snapshot(target_trip uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if not public.is_trip_member(target_trip) then raise exception 'Trip membership required'; end if;
  select jsonb_build_object('pool', to_jsonb(p), 'votes', coalesce((
    select jsonb_agg(jsonb_build_object('candidate_id', v.candidate_id, 'user_id', v.user_id, 'vote', v.vote))
    from public.trip_candidate_votes v where v.trip_id = target_trip
  ), '[]'::jsonb)) into result from public.trip_candidate_pools p where p.trip_id = target_trip;
  return result;
end;
$$;
revoke all on function public.read_trip_candidate_snapshot(uuid) from public, anon;
grant execute on function public.read_trip_candidate_snapshot(uuid) to authenticated;
create or replace function public.guard_candidate_published_status()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.published is distinct from old.published and not public.is_trip_owner(old.trip_id) then
    raise exception 'Only the Group Leader can publish the draft';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_candidate_published_status() from public, anon, authenticated;
create trigger guard_candidate_published_status before update on public.trip_candidate_pools
for each row execute function public.guard_candidate_published_status();
alter table public.trip_candidate_pools replica identity full;
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'trip_candidate_pools') then
      alter publication supabase_realtime add table public.trip_candidate_pools;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'trip_candidate_votes') then
      alter publication supabase_realtime add table public.trip_candidate_votes;
    end if;
  end if;
end;
$$;
commit;
