-- Apply after 016. Read unchanged pools without resending photos; save votes independently.
begin;
create or replace function public.read_trip_candidate_changes(target_trip uuid, known_revision timestamptz default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if not public.is_trip_member(target_trip) then raise exception 'Trip membership required'; end if;
  select jsonb_build_object(
    'revision', p.updated_at,
    'pool', case when p.updated_at is distinct from known_revision then to_jsonb(p) else null end,
    'votes', coalesce((
      select jsonb_agg(jsonb_build_object('candidate_id', v.candidate_id, 'user_id', v.user_id, 'vote', v.vote))
      from public.trip_candidate_votes v where v.trip_id = target_trip
    ), '[]'::jsonb)
  ) into result from public.trip_candidate_pools p where p.trip_id = target_trip;
  return result;
end;
$$;
create or replace function public.set_trip_candidate_vote(target_trip uuid, target_candidate text, next_vote text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_trip_member(target_trip) then raise exception 'Trip membership required'; end if;
  perform pg_catalog.set_config('lock_timeout', '3s', true);
  -- Match publication's trip -> pool lock order.
  perform 1 from public.trips where id = target_trip for update;
  perform 1 from public.trip_candidate_pools where trip_id = target_trip for update;
  if not found then raise exception 'Candidate pool is not initialized'; end if;
  if next_vote is not null and next_vote not in ('up', 'down') then raise exception 'Invalid candidate vote'; end if;
  if not exists (
    select 1 from public.trip_candidate_pools p
    cross join lateral jsonb_array_elements(p.candidates) c
    where p.trip_id = target_trip and c->>'id' = target_candidate
  ) then raise exception 'This candidate was removed. Reload the pool before voting.'; end if;
  if next_vote is null then
    delete from public.trip_candidate_votes
    where trip_id = target_trip and candidate_id = target_candidate and user_id = (select auth.uid());
  else
    insert into public.trip_candidate_votes(trip_id, candidate_id, user_id, vote)
    values (target_trip, target_candidate, (select auth.uid()), next_vote)
    on conflict (trip_id, candidate_id, user_id) do update
      set vote = excluded.vote, updated_at = clock_timestamp()
      where public.trip_candidate_votes.vote is distinct from excluded.vote;
  end if;
end;
$$;
revoke all on function public.read_trip_candidate_changes(uuid,timestamptz) from public,anon;
revoke all on function public.set_trip_candidate_vote(uuid,text,text) from public,anon;
grant execute on function public.read_trip_candidate_changes(uuid,timestamptz) to authenticated;
grant execute on function public.set_trip_candidate_vote(uuid,text,text) to authenticated;
create or replace function public.save_trip_candidate_pool(
  target_trip uuid,
  expected_revision timestamptz,
  next_candidates jsonb,
  next_draft jsonb,
  next_draft_excluded_existing jsonb,
  next_published jsonb,
  member_votes jsonb
)
returns timestamptz
language plpgsql security definer set search_path = '' as $$
declare current_revision timestamptz;
new_revision timestamptz;
begin
  if not public.is_trip_member(target_trip) then raise exception 'Trip membership required'; end if;
  if next_draft = 'null'::jsonb then next_draft := null; end if;
  if next_published = 'null'::jsonb then next_published := null; end if;
  if next_candidates is null or jsonb_typeof(next_candidates) <> 'array' then raise exception 'Invalid candidate list'; end if;
  if jsonb_array_length(next_candidates) > 500 then raise exception 'Candidate pool is too large'; end if;
  if next_draft is not null and jsonb_typeof(next_draft) <> 'array' then raise exception 'Invalid draft data'; end if;
  if next_draft_excluded_existing is null or jsonb_typeof(next_draft_excluded_existing) <> 'object' then raise exception 'Invalid draft exclusions'; end if;
  if next_published is not null and jsonb_typeof(next_published) <> 'array' then raise exception 'Invalid published plan'; end if;
  if member_votes is null or jsonb_typeof(member_votes) <> 'object' then raise exception 'Invalid candidate votes'; end if;
  if exists (
    select 1 from jsonb_array_elements(next_candidates) c
    where coalesce(c->>'id', '') = '' or length(c->>'id') > 160
       or coalesce(length(trim(c->>'name')), 0) = 0
  ) then raise exception 'Candidate entries require an id and name'; end if;
  if exists (
    select 1 from jsonb_each_text(member_votes) v
    where v.value not in ('up', 'down')
       or not exists (select 1 from jsonb_array_elements(next_candidates) c where c->>'id' = v.key)
  ) then raise exception 'Invalid candidate vote'; end if;

  perform pg_catalog.set_config('lock_timeout', '3s', true);
  perform 1 from public.trips where id = target_trip for update;
  select updated_at into current_revision
  from public.trip_candidate_pools where trip_id = target_trip for update;
  if not found then raise exception 'Candidate pool is not initialized'; end if;
  if current_revision is distinct from expected_revision then
    raise exception 'Candidate pool changed on another device. Please retry.';
  end if;

  new_revision := clock_timestamp();
  update public.trip_candidate_pools
  set candidates = next_candidates, draft = next_draft,
      draft_excluded_existing = next_draft_excluded_existing,
      published = next_published, updated_at = new_revision
  where trip_id = target_trip;

  delete from public.trip_candidate_votes v
  where v.trip_id = target_trip and not exists (
    select 1 from jsonb_array_elements(next_candidates) c where c->>'id' = v.candidate_id
  );
  delete from public.trip_candidate_votes
  where trip_id = target_trip and user_id = (select auth.uid());
  insert into public.trip_candidate_votes(trip_id, candidate_id, user_id, vote)
  select target_trip, v.key, (select auth.uid()), v.value
  from jsonb_each_text(member_votes) v;

  return new_revision;
end;
$$;

create or replace function public.save_trip_candidate_content(
  target_trip uuid, expected_revision timestamptz, next_candidates jsonb,
  next_draft jsonb, next_draft_excluded_existing jsonb, next_published jsonb
)
returns timestamptz language plpgsql security definer set search_path = '' as $$
declare current_votes jsonb;
begin
  if not public.is_trip_member(target_trip) then raise exception 'Trip membership required'; end if;
  perform pg_catalog.set_config('lock_timeout', '3s', true);
  perform 1 from public.trips where id = target_trip for update;
  perform 1 from public.trip_candidate_pools where trip_id = target_trip for update;
  -- Content edits must retain votes saved concurrently through the separate vote RPC.
  select coalesce(jsonb_object_agg(v.candidate_id, v.vote), '{}'::jsonb) into current_votes
  from public.trip_candidate_votes v
  where v.trip_id = target_trip and v.user_id = (select auth.uid()) and exists (
    select 1 from jsonb_array_elements(next_candidates) c where c->>'id' = v.candidate_id
  );
  return public.save_trip_candidate_pool(target_trip, expected_revision, next_candidates,
    next_draft, next_draft_excluded_existing, next_published, current_votes);
end;
$$;
revoke all on function public.save_trip_candidate_content(uuid,timestamptz,jsonb,jsonb,jsonb,jsonb) from public,anon;
grant execute on function public.save_trip_candidate_content(uuid,timestamptz,jsonb,jsonb,jsonb,jsonb) to authenticated;

commit;
