-- PATA — two-player number hunt
-- Run this in the Supabase SQL editor (Project → SQL Editor → New query).
-- Safe to run more than once.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- matches
create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  status text not null default 'waiting'
    check (status in ('waiting', 'active', 'finished')),
  turns_per_player int not null check (turns_per_player in (5, 10, 20)),
  total_turns int not null,
  board jsonb not null,
  player1 uuid not null references auth.users (id) on delete cascade,
  player2 uuid references auth.users (id) on delete cascade,
  player1_name text not null,
  player2_name text,
  chooser uuid,
  finder uuid,
  turn_index int not null default 0,
  player1_score bigint not null default 0,
  player2_score bigint not null default 0,
  winner uuid,
  target_number int,
  target_since timestamptz,
  used_numbers int[] not null default '{}',
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);

create index if not exists matches_code_idx on public.matches (code);
create index if not exists matches_status_idx on public.matches (status);
create index if not exists matches_player1_idx on public.matches (player1);
create index if not exists matches_player2_idx on public.matches (player2);

-- ---------------------------------------------------------------- turns
create table if not exists public.turns (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade,
  turn_index int not null,
  chooser uuid not null,
  finder uuid not null,
  chosen_number int not null,
  started_at timestamptz not null,
  found_at timestamptz,
  elapsed_us bigint,
  created_at timestamptz not null default now(),
  unique (match_id, turn_index)
);

create index if not exists turns_match_idx on public.turns (match_id, turn_index);

-- ---------------------------------------------------------------- security
alter table public.profiles enable row level security;
alter table public.matches enable row level security;
alter table public.turns enable row level security;

-- Reads are allowed for the two players in a match (used by the live match
-- subscription). Every write goes through the server API using the service
-- role key.
drop policy if exists "matches readable by authenticated" on public.matches;
drop policy if exists "matches readable by participants" on public.matches;
create policy "matches readable by participants" on public.matches
  for select to authenticated
  using (player1 = auth.uid() or player2 = auth.uid());

-- Turn history is only read through the server API.
drop policy if exists "turns readable by authenticated" on public.turns;

-- ---------------------------------------------------------------- realtime
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.matches;
    exception
      when duplicate_object then null;
    end;
  end if;
end
$$;

-- ---------------------------------------------------------------- join match
create or replace function public.join_match(
  p_code text,
  p_player uuid,
  p_name text
)
returns public.matches
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.matches;
  first_chooser uuid;
begin
  select * into m
  from public.matches
  where code = upper(p_code)
  for update;

  if not found then
    raise exception 'match_not_found';
  end if;

  if m.player1 = p_player then
    return m;
  end if;

  if m.player2 is not null and m.player2 <> p_player then
    raise exception 'match_full';
  end if;

  if m.status <> 'waiting' then
    raise exception 'match_not_waiting';
  end if;

  first_chooser := case when random() < 0.5 then m.player1 else p_player end;

  update public.matches
  set
    player2 = p_player,
    player2_name = p_name,
    status = 'active',
    total_turns = turns_per_player * 2,
    chooser = first_chooser,
    finder = case when first_chooser = m.player1 then p_player else m.player1 end,
    started_at = now()
  where id = m.id
  returning * into m;

  return m;
end;
$$;

-- ---------------------------------------------------------------- select number
create or replace function public.select_number(
  p_match_id uuid,
  p_player uuid,
  p_number int
)
returns public.matches
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.matches;
begin
  select * into m
  from public.matches
  where id = p_match_id
  for update;

  if not found then
    raise exception 'match_not_found';
  end if;

  if m.status <> 'active' then
    raise exception 'match_not_active';
  end if;

  if m.chooser is distinct from p_player then
    raise exception 'not_your_turn';
  end if;

  if m.target_number is not null then
    raise exception 'already_selected';
  end if;

  if p_number < 1 or p_number > 100 then
    raise exception 'invalid_number';
  end if;

  if p_number = any (m.used_numbers) then
    raise exception 'number_used';
  end if;

  update public.matches
  set
    target_number = p_number,
    target_since = clock_timestamp()
  where id = p_match_id
  returning * into m;

  insert into public.turns (match_id, turn_index, chooser, finder, chosen_number, started_at)
  values (p_match_id, m.turn_index, m.chooser, m.finder, p_number, m.target_since);

  return m;
end;
$$;

-- ---------------------------------------------------------------- resolve found
create or replace function public.resolve_found(
  p_match_id uuid,
  p_player uuid,
  p_number int
)
returns public.matches
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.matches;
  found_time timestamptz;
  elapsed bigint;
  next_turn int;
  score1 bigint;
  score2 bigint;
  winner_id uuid;
begin
  select * into m
  from public.matches
  where id = p_match_id
  for update;

  if not found then
    raise exception 'match_not_found';
  end if;

  if m.status <> 'active' then
    raise exception 'match_not_active';
  end if;

  if m.finder is distinct from p_player then
    raise exception 'not_your_hunt';
  end if;

  if m.target_number is null then
    raise exception 'no_target';
  end if;

  if m.target_since is null then
    raise exception 'no_target';
  end if;

  if p_number <> m.target_number then
    raise exception 'wrong_number';
  end if;

  found_time := clock_timestamp();
  elapsed := greatest(
    0,
    round(extract(epoch from (found_time - m.target_since)) * 1000000)::bigint
  );
  next_turn := m.turn_index + 1;
  score1 := m.player1_score + case when m.chooser = m.player1 then elapsed else 0 end;
  score2 := m.player2_score + case when m.chooser = m.player2 then elapsed else 0 end;

  update public.turns
  set found_at = found_time, elapsed_us = elapsed
  where match_id = p_match_id and turn_index = m.turn_index;

  if next_turn >= m.total_turns then
    winner_id := case
      when score1 > score2 then m.player1
      when score2 > score1 then m.player2
      else null
    end;

    update public.matches
    set
      player1_score = score1,
      player2_score = score2,
      used_numbers = array_append(used_numbers, p_number),
      target_number = null,
      target_since = null,
      turn_index = next_turn,
      status = 'finished',
      chooser = null,
      finder = null,
      winner = winner_id,
      finished_at = now()
    where id = p_match_id
    returning * into m;
  else
    update public.matches
    set
      player1_score = score1,
      player2_score = score2,
      used_numbers = array_append(used_numbers, p_number),
      target_number = null,
      target_since = null,
      turn_index = next_turn,
      chooser = m.finder,
      finder = m.chooser
    where id = p_match_id
    returning * into m;
  end if;

  return m;
end;
$$;

-- ---------------------------------------------------------------- leaderboard
create or replace view public.leaderboard as
select
  p.id,
  p.display_name,
  count(m.id) filter (where m.status = 'finished') as matches_played,
  count(m.id) filter (where m.status = 'finished' and m.winner = p.id) as wins,
  count(m.id) filter (where m.status = 'finished' and m.winner is null) as draws,
  count(m.id) filter (
    where m.status = 'finished' and m.winner is not null and m.winner <> p.id
  ) as losses,
  coalesce(
    sum(
      case
        when m.status = 'finished' and m.player1 = p.id then m.player1_score
        when m.status = 'finished' and m.player2 = p.id then m.player2_score
        else 0
      end
    ),
    0
  )::bigint as total_points
from public.profiles p
left join public.matches m on (m.player1 = p.id or m.player2 = p.id)
group by p.id, p.display_name;

-- ---------------------------------------------------------------- privileges
-- The game functions bypass RLS by design, so only the server (service role)
-- may call them. This prevents direct RPC calls from the browser.
revoke all on function public.join_match(text, uuid, text) from public, anon, authenticated;
revoke all on function public.select_number(uuid, uuid, int) from public, anon, authenticated;
revoke all on function public.resolve_found(uuid, uuid, int) from public, anon, authenticated;

grant execute on function public.join_match(text, uuid, text) to service_role;
grant execute on function public.select_number(uuid, uuid, int) to service_role;
grant execute on function public.resolve_found(uuid, uuid, int) to service_role;

grant select on public.leaderboard to service_role;
