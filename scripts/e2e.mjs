import { createClient } from "@supabase/supabase-js";

const base = process.env.BASE_URL ?? "http://localhost:3100";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function fail(message) {
  throw new Error(message);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

async function signIn() {
  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signInAnonymously();
  if (error) fail(`anonymous sign-in failed: ${error.message}`);
  return {
    client,
    token: data.session.access_token,
    userId: data.user.id,
  };
}

async function api(path, token, options = {}) {
  const response = await fetch(`${base}${path}`, {
    method: options.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    fail(`${path} -> ${response.status}: ${JSON.stringify(payload)}`);
  }
  return payload;
}

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let alice;
let bob;
let code;

try {
  alice = await signIn();
  bob = await signIn();
  console.log("SIGNIN_OK: two anonymous players");

  const created = await api("/api/matches", alice.token, {
    method: "POST",
    body: { turnsPerPlayer: 5, displayName: "Alice E2E" },
  });
  code = created.match.code;
  assert(created.match.status === "waiting", "new match should be waiting");
  console.log(`CREATE_OK: code ${code}`);

  const joined = await api("/api/matches/join", bob.token, {
    method: "POST",
    body: { code, displayName: "Bob E2E" },
  });
  let match = joined.match;
  assert(match.status === "active", "match should be active after join");
  assert(match.total_turns === 10, "total turns should be 10");
  console.log("JOIN_OK: match active with 10 turns");

  const tokenFor = (userId) => {
    if (userId === alice.userId) return alice.token;
    if (userId === bob.userId) return bob.token;
    fail(`unexpected player ${userId}`);
  };

  const scores = { [alice.userId]: 0, [bob.userId]: 0 };

  for (let i = 0; i < 10; i += 1) {
    const chooserId = match.chooser;
    const finderId = match.finder;
    assert(chooserId && finderId, `turn ${i}: both roles should be set`);

    const target = i + 1;
    const selected = await api(`/api/matches/${code}/select`, tokenFor(chooserId), {
      method: "POST",
      body: { number: target },
    });
    assert(
      selected.match.target_number === target,
      `turn ${i}: target should be ${target}`,
    );

    const found = await api(`/api/matches/${code}/found`, tokenFor(finderId), {
      method: "POST",
      body: { number: target },
    });

    assert(
      found.lastTurn?.elapsed_us != null,
      `turn ${i}: elapsed time should be recorded`,
    );
    scores[chooserId] += found.lastTurn.elapsed_us;
    match = found.match;

    if (i < 9) {
      assert(match.status === "active", `turn ${i}: match should still be active`);
      assert(match.chooser === finderId, `turn ${i}: roles should swap`);
      assert(match.finder === chooserId, `turn ${i}: roles should swap`);
      assert(match.used_numbers.length === i + 1, `turn ${i}: used count`);
    } else {
      assert(match.status === "finished", "match should finish after 10 turns");
      assert(match.chooser === null && match.finder === null, "roles clear");
    }
  }

  const aliceScore =
    match.player1 === alice.userId ? match.player1_score : match.player2_score;
  const bobScore =
    match.player1 === bob.userId ? match.player1_score : match.player2_score;

  assert(
    aliceScore === scores[alice.userId],
    `Alice score ${aliceScore} != ${scores[alice.userId]}`,
  );
  assert(
    bobScore === scores[bob.userId],
    `Bob score ${bobScore} != ${scores[bob.userId]}`,
  );

  const expectedWinner =
    aliceScore > bobScore
      ? alice.userId
      : bobScore > aliceScore
        ? bob.userId
        : null;
  assert(match.winner === expectedWinner, "winner should follow the scores");

  console.log(
    `GAME_OK: Alice ${aliceScore}us vs Bob ${bobScore}us, winner ${
      expectedWinner === null
        ? "draw"
        : expectedWinner === alice.userId
          ? "Alice"
          : "Bob"
    }`,
  );

  const leaderboardResponse = await fetch(`${base}/api/leaderboard`, {
    cache: "no-store",
  });
  const leaderboard = await leaderboardResponse.json();
  assert(leaderboardResponse.ok, "leaderboard request should succeed");
  assert(
    leaderboard.leaderboard.some((row) => row.display_name === "Alice E2E"),
    "leaderboard should include Alice E2E",
  );
  assert(
    leaderboard.leaderboard.some((row) => row.display_name === "Bob E2E"),
    "leaderboard should include Bob E2E",
  );
  assert(
    leaderboard.recent.some((row) => row.code === code),
    "recent results should include the match",
  );

  console.log("LEADERBOARD_OK: players and recent result present");
  console.log("E2E_ALL_PASSED");
} finally {
  if (code) {
    await admin.from("matches").delete().eq("code", code);
  }
  if (alice?.userId) {
    await admin.auth.admin.deleteUser(alice.userId).catch(() => {});
  }
  if (bob?.userId) {
    await admin.auth.admin.deleteUser(bob.userId).catch(() => {});
  }
  console.log("CLEANUP_DONE");
}
