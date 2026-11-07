import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

if (!url || !anonKey) fail("NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY is missing.");
if (!serviceKey || serviceKey === "your-service-role-key") {
  fail("SUPABASE_SERVICE_ROLE_KEY is still the placeholder in .env.local.");
}

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { error: tableError } = await admin.from("matches").select("id").limit(1);
if (tableError) fail(`service role / schema check failed: ${tableError.message}`);
console.log("SERVICE_ROLE_OK: matches table reachable");

const { error: viewError } = await admin.from("leaderboard").select("*").limit(1);
if (viewError) fail(`leaderboard view check failed: ${viewError.message}`);
console.log("LEADERBOARD_VIEW_OK");

const { error: fnError } = await admin.rpc("select_number", {
  p_match_id: "00000000-0000-0000-0000-000000000000",
  p_player: "00000000-0000-0000-0000-000000000000",
  p_number: 1,
});
if (fnError && !/match_not_found/i.test(fnError.message)) {
  fail(`game function check failed: ${fnError.message}`);
}
console.log("GAME_FUNCTIONS_OK");

const client = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data, error } = await client.auth.signInAnonymously();
if (error) fail(`anonymous sign-in failed: ${error.message}`);
console.log(`ANONYMOUS_SIGNIN_OK: user ${data.user?.id ?? "created"}`);

if (data.user?.id) {
  const { error: deleteError } = await admin.auth.admin.deleteUser(data.user.id);
  if (deleteError) {
    console.log(`NOTE: test user could not be removed: ${deleteError.message}`);
  } else {
    console.log("TEST_USER_REMOVED");
  }
}

console.log("ALL_CHECKS_PASSED");
