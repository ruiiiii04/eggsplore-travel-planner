begin;

-- Candidate content and review drafts belong to a trip. Individual votes are
-- stored separately so every member sees the same totals and their own vote.
create table public.trip_candidate_pools (
  trip_id uuid primary key references public.trips(id) on delete cascade,
  candidates jsonb not null default '[]'::jsonb check (jsonb_typeof(candidates) = 'array'),
  draft jsonb check (draft is null or jsonb_typeof(draft) = 'array'),
  draft_excluded_existing jsonb not null default '{}'::jsonb check (jsonb_typeof(draft_excluded_existing) = 'object'),
  published jsonb check (published is null or jsonb_typeof(published) = 'array'),
  updated_at timestamptz not null default clock_timestamp()
);

create table public.trip_candidate_votes (
  trip_id uuid not null references public.trips(id) on delete cascade,
  candidate_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  vote text not null check (vote in ('up', 'down')),
  updated_at timestamptz not null default clock_timestamp(),
  primary key (trip_id, candidate_id, user_id)
);
create index trip_candidate_votes_trip_candidate_idx
  on public.trip_candidate_votes(trip_id, candidate_id);

alter table public.trip_candidate_pools enable row level security;
alter table public.trip_candidate_votes enable row level security;
create policy trip_candidate_pools_read on public.trip_candidate_pools
  for select to authenticated using (public.is_trip_member(trip_id));
create policy trip_candidate_votes_read on public.trip_candidate_votes
  for select to authenticated using (public.is_trip_member(trip_id));
grant select on public.trip_candidate_pools, public.trip_candidate_votes to authenticated;

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

-- Import the owner's pool first while merging candidate additions and votes
-- made on members' old, account-private pools.
create temporary table legacy_candidate_pools on commit drop as
select p.id as user_id, t.id as trip_id, t.owner_id = p.id as is_owner, e.value as pool
from public.profiles p
cross join lateral jsonb_each(
  case when jsonb_typeof(p.preferences->'candidatePoolsV1') = 'object'
    then p.preferences->'candidatePoolsV1' else '{}'::jsonb end
) e
join public.trips t on t.id = case
  when e.key ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then e.key::uuid
  else null end
join public.trip_members tm on tm.trip_id = t.id and tm.user_id = p.id;

with candidate_rows as (
  select l.trip_id, l.is_owner, c as candidate
  from legacy_candidate_pools l
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(l.pool->'candidates') = 'array' then l.pool->'candidates' else '[]'::jsonb end
  ) c
  where coalesce(c->>'id', '') <> ''
), candidate_rollup as (
  select trip_id, candidate->>'id' as candidate_id,
    jsonb_set(
      jsonb_set(
        jsonb_set(
          (jsonb_agg(candidate order by is_owner desc)->0),
          '{confirmed}', to_jsonb(bool_or(case when candidate->>'confirmed' in ('true', 'false') then (candidate->>'confirmed')::boolean else false end)), true
        ),
        '{up}', to_jsonb(max(case when candidate->>'up' ~ '^-?[0-9]+$' then (candidate->>'up')::integer else 0 end)), true
      ),
      '{down}', to_jsonb(max(case when candidate->>'down' ~ '^-?[0-9]+$' then (candidate->>'down')::integer else 0 end)), true
    ) as candidate
  from candidate_rows
  group by trip_id, candidate->>'id'
), merged_candidates as (
  select trip_id, jsonb_agg(candidate order by candidate_id) as candidates
  from candidate_rollup group by trip_id
), owner_pool as (
  select distinct on (trip_id) trip_id, pool
  from legacy_candidate_pools where is_owner order by trip_id
), legacy_trip_ids as (
  select distinct trip_id from legacy_candidate_pools
)
insert into public.trip_candidate_pools(trip_id, candidates, draft, published)
select t.id, coalesce(m.candidates, '[]'::jsonb),
  case when jsonb_typeof(o.pool->'draft') = 'array' then o.pool->'draft' else null end,
  case when jsonb_typeof(o.pool->'published') = 'array' then o.pool->'published' else null end
from legacy_trip_ids l
join public.trips t on t.id = l.trip_id
left join owner_pool o on o.trip_id = t.id
left join merged_candidates m on m.trip_id = t.id
on conflict (trip_id) do nothing;

insert into public.trip_candidate_votes(trip_id, candidate_id, user_id, vote)
select l.trip_id, v.key, l.user_id, v.value #>> '{}'
from legacy_candidate_pools l
join public.trip_candidate_pools cp on cp.trip_id = l.trip_id
cross join lateral jsonb_each(
  case when jsonb_typeof(l.pool->'votes') = 'object' then l.pool->'votes' else '{}'::jsonb end
) v
where v.value in ('"up"'::jsonb, '"down"'::jsonb)
  and exists (select 1 from jsonb_array_elements(cp.candidates) c where c->>'id' = v.key)
on conflict (trip_id, candidate_id, user_id) do nothing;




create or replace function public.initialize_trip_candidate_pool(target_trip uuid, initial_candidates jsonb)
returns timestamptz
language plpgsql security definer set search_path = '' as $$
declare current_revision timestamptz;
begin
  if not public.is_trip_member(target_trip) then raise exception 'Trip membership required'; end if;
  if initial_candidates is null or jsonb_typeof(initial_candidates) <> 'array' then
    raise exception 'Invalid initial candidate list';
  end if;
  if jsonb_array_length(initial_candidates) > 500 then raise exception 'Invalid initial candidate list'; end if;
  insert into public.trip_candidate_pools(trip_id, candidates)
  values (target_trip, initial_candidates)
  on conflict (trip_id) do nothing;
  select updated_at into current_revision from public.trip_candidate_pools where trip_id = target_trip;
  return current_revision;
end;
$$;

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

revoke all on function public.initialize_trip_candidate_pool(uuid, jsonb) from public, anon;
revoke all on function public.save_trip_candidate_pool(uuid, timestamptz, jsonb, jsonb, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.initialize_trip_candidate_pool(uuid, jsonb) to authenticated;
grant execute on function public.save_trip_candidate_pool(uuid, timestamptz, jsonb, jsonb, jsonb, jsonb, jsonb) to authenticated;

-- Publish only if the Full Itinerary still matches the state the user reviewed.
create or replace function public.publish_candidate_draft(target_trip uuid, stops jsonb)
returns void
language plpgsql security definer set search_path = '' as $$
declare expected_existing integer;
updated_existing integer;
expected_ids jsonb;
begin
  if not public.is_trip_owner(target_trip) then raise exception 'Only the trip organiser can publish'; end if;
  perform 1 from public.trips where id = target_trip for update;
  if not found then raise exception 'Trip not found'; end if;
  lock table public.itinerary_items in share row exclusive mode;
  if stops is null or jsonb_typeof(stops) <> 'array' then
    raise exception 'Supply between 1 and 120 activities';
  end if;
  if jsonb_array_length(stops) = 0 or jsonb_array_length(stops) > 120 then
    raise exception 'Supply between 1 and 120 activities';
  end if;
  expected_ids := stops->0->'expected_existing_ids';
  if expected_ids is null or jsonb_typeof(expected_ids) <> 'array' then
    raise exception 'Reload the current itinerary and review the draft again';
  end if;
  if jsonb_array_length(expected_ids) > 500 then
    raise exception 'Reload the current itinerary and review the draft again';
  end if;
  if exists (
    select 1 from public.itinerary_items item
    where item.trip_id = target_trip and not exists (
      select 1 from jsonb_array_elements_text(expected_ids) expected(id) where expected.id = item.id::text
    )
  ) or exists (
    select 1 from jsonb_array_elements_text(expected_ids) expected(id)
    where not exists (select 1 from public.itinerary_items item where item.trip_id = target_trip and item.id::text = expected.id)
  ) then raise exception 'The Full Itinerary changed. Reload and review the plan again.'; end if;
  if exists (
    select 1 from jsonb_array_elements(stops) x
    where coalesce(length(trim(x->>'title')), 0) = 0 or length(x->>'title') > 120
       or coalesce(nullif(x->>'activity_category', ''), 'sightseeing') not in ('sightseeing', 'food', 'transport', 'stay')
  ) then raise exception 'Every activity needs a valid name and category'; end if;

  select count(*) into expected_existing from jsonb_array_elements(stops) x
  where nullif(x->>'existing_id', '') is not null;
  if exists (
    select 1 from jsonb_array_elements(stops) x
    where nullif(x->>'existing_id', '') is not null
    group by x->>'existing_id' having count(*) > 1
  ) then raise exception 'An existing activity appears more than once'; end if;
  if exists (
    select 1 from jsonb_array_elements(stops) x
    where nullif(x->>'existing_id', '') is not null
      and jsonb_typeof(x->'existing_snapshot') is distinct from 'array'
  ) then raise exception 'Reload and review each existing activity before publishing'; end if;
  if exists (
    select 1 from jsonb_array_elements(stops) x
    where nullif(x->>'existing_id', '') is not null and jsonb_array_length(x->'existing_snapshot') <> 6
  ) then raise exception 'Reload and review each existing activity before publishing'; end if;
  if exists (
    select 1
    from jsonb_array_elements(stops) x
    join public.itinerary_items item on item.id = (x->>'existing_id')::uuid and item.trip_id = target_trip
    where nullif(x->>'existing_id', '') is not null and (
      (x->'existing_snapshot'->>0) is distinct from item.title or
      (x->'existing_snapshot'->>1) is distinct from item.description or
      (x->'existing_snapshot'->>2) is distinct from item.activity_category or
      (x->'existing_snapshot'->>3) is distinct from item.location_name or
      nullif(x->'existing_snapshot'->>4, '')::timestamptz is distinct from item.start_time or
      (x->'existing_snapshot'->>5)::integer is distinct from item.position
    )
  ) then raise exception 'An existing activity changed. Reload and review the plan again'; end if;

  update public.itinerary_items item
  set title = x->>'title', description = x->>'description', location_name = x->>'location_name',
      activity_category = nullif(x->>'activity_category', ''),
      start_time = nullif(x->>'start_time', '')::timestamptz,
      position = (a.ordinality - 1)::integer
  from jsonb_array_elements(stops) with ordinality a(x, ordinality)
  where nullif(x->>'existing_id', '') is not null
    and item.id = (x->>'existing_id')::uuid and item.trip_id = target_trip;
  get diagnostics updated_existing = row_count;
  if updated_existing <> expected_existing then raise exception 'An existing activity changed. Reload and review the plan again'; end if;

  insert into public.itinerary_items(trip_id, title, description, location_name, activity_category, start_time, position)
  select target_trip, x->>'title', x->>'description', x->>'location_name', nullif(x->>'activity_category', ''),
         nullif(x->>'start_time', '')::timestamptz, (a.ordinality - 1)::integer
  from jsonb_array_elements(stops) with ordinality a(x, ordinality)
  where nullif(x->>'existing_id', '') is null;
  delete from public.itinerary_items item
  where item.trip_id = target_trip and not exists (
    select 1 from jsonb_array_elements(stops) x
    where nullif(x->>'existing_id', '') is not null and item.id = (x->>'existing_id')::uuid
  );
end;
$$;
revoke all on function public.publish_candidate_draft(uuid, jsonb) from public, anon;
grant execute on function public.publish_candidate_draft(uuid, jsonb) to authenticated;

-- Invites are persisted before the email is sent so a provider failure never
-- silently discards the address.
create table public.trip_invitations (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  email text not null check (length(email) between 3 and 254),
  invited_by uuid not null references auth.users(id),
  invited_user_id uuid references auth.users(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'accepted')),
  created_at timestamptz not null default now(),
  unique (trip_id, email)
);
alter table public.trip_invitations enable row level security;
create policy trip_invitations_owner_read on public.trip_invitations
  for select to authenticated using (public.is_trip_owner(trip_id));
grant select on public.trip_invitations to authenticated;

create or replace function public.prepare_trip_invitation(target_trip uuid, invite_email text)
returns table(invitation_id uuid, existing_user_id uuid, already_member boolean)
language plpgsql security definer set search_path = '' as $$
declare normalized_email text := lower(trim(invite_email));
found_user uuid;
invitation uuid;
member_exists boolean := false;
begin
  if not public.is_trip_owner(target_trip) then raise exception 'Only the trip organiser can invite members'; end if;
  if normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Enter a valid email address'; end if;
  select u.id into found_user from auth.users u where lower(u.email) = normalized_email limit 1;
  if found_user is not null then
    select exists(select 1 from public.trip_members m where m.trip_id = target_trip and m.user_id = found_user) into member_exists;
  end if;
  insert into public.trip_invitations(trip_id, email, invited_by, invited_user_id, status)
  values (target_trip, normalized_email, (select auth.uid()), found_user,
    case when member_exists then 'accepted' else 'pending' end)
  on conflict (trip_id, email) do update set
    invited_user_id = excluded.invited_user_id,
    invited_by = excluded.invited_by,
    status = case when public.trip_invitations.status = 'accepted' then 'accepted' else 'pending' end
  returning id into invitation;
  if found_user is not null then
    insert into public.trip_members(trip_id, user_id, role)
    values (target_trip, found_user, 'member') on conflict (trip_id, user_id) do nothing;
    update public.trip_invitations set status = 'accepted' where id = invitation;
  end if;
  return query select invitation, found_user, member_exists;
end;
$$;

create or replace function public.mark_trip_invitation_sent(target_invitation uuid, invited_user uuid)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.trip_invitations where id = target_invitation) then raise exception 'Invitation not found'; end if;
  update public.trip_invitations set invited_user_id = invited_user, status = 'sent'
  where id = target_invitation and status = 'pending';
  if not found then raise exception 'Invitation is no longer pending'; end if;
  insert into public.trip_members(trip_id, user_id, role)
  select trip_id, invited_user, 'member' from public.trip_invitations where id = target_invitation
  on conflict (trip_id, user_id) do nothing;
end;
$$;
revoke all on function public.prepare_trip_invitation(uuid, text) from public, anon;
revoke all on function public.mark_trip_invitation_sent(uuid, uuid) from public, anon, authenticated;
grant execute on function public.prepare_trip_invitation(uuid, text) to authenticated;
grant execute on function public.mark_trip_invitation_sent(uuid, uuid) to service_role;

commit;
