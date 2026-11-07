export default function SetupNotice() {
  return (
    <div className="rounded-3xl border border-amber-400/25 bg-amber-400/[0.06] p-6 text-sm text-amber-100">
      <h2 className="text-lg font-semibold text-amber-200">
        Supabase setup required
      </h2>
      <ol className="mt-3 list-decimal space-y-2 pl-5 text-amber-100/80">
        <li>
          Create a free project at{" "}
          <a
            className="underline decoration-amber-400/50 underline-offset-2 hover:text-white"
            href="https://supabase.com"
            target="_blank"
            rel="noreferrer"
          >
            supabase.com
          </a>
          .
        </li>
        <li>
          In <strong>Authentication → Providers</strong>, enable{" "}
          <strong>Anonymous Sign-Ins</strong>.
        </li>
        <li>
          Run <code className="rounded bg-black/30 px-1.5 py-0.5">supabase/schema.sql</code>{" "}
          in the SQL editor (it also enables realtime and leaderboard).
        </li>
        <li>
          Copy <code className="rounded bg-black/30 px-1.5 py-0.5">.env.example</code> to{" "}
          <code className="rounded bg-black/30 px-1.5 py-0.5">.env.local</code> and fill in
          the three keys from <strong>Project Settings → API</strong>.
        </li>
        <li>Restart <code className="rounded bg-black/30 px-1.5 py-0.5">npm run dev</code>.</li>
      </ol>
    </div>
  );
}
