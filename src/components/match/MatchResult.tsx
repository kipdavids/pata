import Link from "next/link";
import { formatElapsed } from "@/lib/game";
import type { MatchRow } from "@/lib/types";

export default function MatchResult({
  match,
  winnerName,
}: {
  match: MatchRow;
  winnerName: string | null;
}) {
  const draw = match.winner === null;
  const p1Won = match.winner === match.player1;
  const p2Won = match.player2 != null && match.winner === match.player2;
  const gap = Math.abs(
    Number(match.player1_score) - Number(match.player2_score),
  );

  return (
    <section className="animate-pop relative overflow-hidden rounded-3xl border border-amber-300/30 bg-gradient-to-b from-amber-400/[0.12] to-white/[0.02] p-5 text-center shadow-arena">
      <span
        aria-hidden
        className="pointer-events-none absolute -top-16 left-1/2 h-32 w-64 -translate-x-1/2 rounded-full bg-amber-400/20 blur-3xl"
      />
      <div className="relative">
        <span className="text-3xl" aria-hidden>
          {draw ? "🤝" : "🏆"}
        </span>
        <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.32em] text-amber-300">
          Match complete
        </p>
        <h2 className="font-display mt-1 text-2xl font-bold text-white">
          {draw ? "It's a draw" : `${winnerName ?? "Winner"} wins`}
        </h2>
        <p className="mt-0.5 text-[11px] text-zinc-400">
          {draw ? "Perfectly matched." : `Won by ${formatElapsed(gap)} s`}
        </p>

        <div className="mt-4 grid grid-cols-2 gap-2 text-left">
          <ScoreRow
            name={match.player1_name}
            score={match.player1_score}
            won={p1Won}
          />
          <ScoreRow
            name={match.player2_name ?? "Opponent"}
            score={match.player2_score}
            won={p2Won}
          />
        </div>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Link
            href="/"
            className="flex-1 rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-bold text-emerald-950 transition hover:bg-emerald-300"
          >
            Play again
          </Link>
          <Link
            href="/leaderboard"
            className="flex-1 rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:border-white/25 hover:bg-white/5"
          >
            See rankings
          </Link>
        </div>
      </div>
    </section>
  );
}

function ScoreRow({
  name,
  score,
  won,
}: {
  name: string;
  score: number;
  won: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border px-3 py-2.5 ${
        won
          ? "border-emerald-400/40 bg-emerald-400/10"
          : "border-white/10 bg-white/[0.03]"
      }`}
    >
      <p className="truncate text-[11px] font-semibold text-zinc-300">
        {name}
      </p>
      <p
        className={`mt-0.5 font-mono text-sm font-bold ${
          won ? "text-emerald-300" : "text-zinc-400"
        }`}
      >
        {formatElapsed(Number(score))}
        <span className="ml-0.5 text-[9px] font-normal text-zinc-600">s</span>
      </p>
    </div>
  );
}
