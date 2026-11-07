\set ON_ERROR_STOP on

truncate public.turns, public.matches, public.profiles, auth.users cascade;

insert into auth.users (id) values
  ('11111111-1111-1111-1111-111111111111'),
  ('22222222-2222-2222-2222-222222222222');

insert into public.profiles (id, display_name) values
  ('11111111-1111-1111-1111-111111111111', 'Alice'),
  ('22222222-2222-2222-2222-222222222222', 'Bob');

do $$
declare
  m public.matches;
  chooser uuid;
  finder uuid;
  first_chooser uuid;
  i int;
  elapsed bigint;
  expected bigint;
  p1_choices int;
  p2_choices int;
begin
  insert into public.matches (
    code, status, turns_per_player, total_turns, board, player1, player1_name
  )
  values (
    'TEST01',
    'waiting',
    5,
    10,
    (select jsonb_agg(n order by n) from generate_series(1, 100) as n),
    '11111111-1111-1111-1111-111111111111',
    'Alice'
  )
  returning * into m;

  m := public.join_match('TEST01', '22222222-2222-2222-2222-222222222222', 'Bob');

  assert m.status = 'active', 'match should be active after join';
  assert m.player2 = '22222222-2222-2222-2222-222222222222', 'player2 should join';
  assert m.total_turns = 10, 'total turns should be 10';
  assert m.turn_index = 0, 'turn index should start at 0';

  chooser := m.chooser;
  finder := m.finder;
  first_chooser := chooser;

  for i in 0..9 loop
    -- Chooser picks a fresh number.
    m := public.select_number(m.id, chooser, i + 1);
    assert m.target_number = i + 1, 'target should be recorded';
    assert m.turn_index = i, 'turn index should match the loop';
    assert not ((i + 1) = any (m.used_numbers)),
      'a new target should not already be used';

    -- The wrong player cannot resolve the hunt.
    begin
      perform public.resolve_found(m.id, chooser, i + 2);
      raise exception 'expected not_your_hunt';
    exception
      when others then
        if sqlerrm <> 'not_your_hunt' then
          raise;
        end if;
    end;

    -- The finder cannot resolve with the wrong number.
    begin
      perform public.resolve_found(m.id, finder, i + 2);
      raise exception 'expected wrong_number';
    exception
      when others then
        if sqlerrm <> 'wrong_number' then
          raise;
        end if;
    end;

    perform pg_sleep(0.05);
    m := public.resolve_found(m.id, finder, i + 1);

    select t.elapsed_us into elapsed
    from public.turns t
    where t.match_id = m.id and t.turn_index = i;

    assert elapsed >= 40000, 'elapsed should be at least 40ms, got ' || elapsed;
    assert elapsed < 2000000, 'elapsed should be under 2s, got ' || elapsed;

    if i < 9 then
      assert m.status = 'active', 'match should still be active';
      assert m.turn_index = i + 1, 'turn should advance';
      assert m.chooser = finder, 'roles should swap (chooser)';
      assert m.finder = chooser, 'roles should swap (finder)';
      assert m.target_number is null, 'target should clear';
      assert (i + 1) = any (m.used_numbers), 'chosen number should be used';

      -- The same number can no longer be chosen.
      begin
        perform public.select_number(m.id, m.chooser, i + 1);
        raise exception 'expected number_used';
      exception
        when others then
          if sqlerrm <> 'number_used' then
            raise;
          end if;
      end;

      chooser := m.chooser;
      finder := m.finder;
    else
      assert m.status = 'finished', 'match should finish after 10 turns';
      assert m.turn_index = 10, 'all turns should be complete';
      assert m.finished_at is not null, 'finish timestamp should be set';
      assert m.chooser is null and m.finder is null, 'roles should clear at finish';
    end if;
  end loop;

  -- Scores must equal the sum of the recorded turn times for each chooser.
  select coalesce(sum(t.elapsed_us) filter (
    where t.chooser = '11111111-1111-1111-1111-111111111111'
  ), 0) into expected
  from public.turns t
  where t.match_id = m.id;

  assert m.player1_score = expected,
    'player1 score should equal summed elapsed time';

  select coalesce(sum(t.elapsed_us) filter (
    where t.chooser = '22222222-2222-2222-2222-222222222222'
  ), 0) into expected
  from public.turns t
  where t.match_id = m.id;

  assert m.player2_score = expected,
    'player2 score should equal summed elapsed time';

  select
    count(*) filter (where t.chooser = '11111111-1111-1111-1111-111111111111'),
    count(*) filter (where t.chooser = '22222222-2222-2222-2222-222222222222')
  into p1_choices, p2_choices
  from public.turns t
  where t.match_id = m.id;

  assert p1_choices = 5, 'player1 should choose 5 times';
  assert p2_choices = 5, 'player2 should choose 5 times';
  assert m.winner = case
    when m.player1_score > m.player2_score then m.player1
    when m.player2_score > m.player1_score then m.player2
    else null
  end, 'winner should follow the score';

  raise notice 'GAME_FLOW_OK first_chooser=% p1=% p2=% winner=%',
    first_chooser, m.player1_score, m.player2_score, m.winner;
end
$$;

select 'LEADERBOARD_OK' as result, display_name, wins, draws, losses, total_points
from public.leaderboard
order by display_name;
