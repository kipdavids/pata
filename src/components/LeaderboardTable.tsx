import Link from "next/link";
import RankBadge from "@/components/RankBadge";
import { formatMicros } from "@/lib/game";
import { levelFor, rankProgress, xpFor } from "@/lib/gamification";
import type { LeaderboardRow } from "@/lib/types";

const PODIUM = [
  "from-amber-300 to-amber-500 text-amber-950",
  "from-zinc-200 to-zinc-400 text-zinc-900",
  "from-orange-300 to-orange-500 text-orange-950",
];

export default function LeaderboardTable({
  rows,
  limit,
}: {
  rows: LeaderboardRow[];
  limit?: number;
}) {
  const visible = typeof limit === "number" ? rows.slice(0, limit) : rows;

  if (!visible.length) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-5 py-8 text-center">
        <p className="text-2xl" aria-hidden>
          🏁
        </p>
        <p className="mt-2 text-sm font-medium text-zinc-300">
          No matches yet.
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          Be the first name on the board.
        </p>
        <Link
          href="/"
          className="mt-4 inline-block rounded-xl bg-emerald-400 px-4 py-2 text-xs font-bold text-emerald-950 transition hover:bg-emerald-300"
        >
          Play the first match
        </Link>
      </div>
    );
  }

  return (
    <ul className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
      {visible.map((row, index) => {
        const wins = Number(row.wins);
        const draws = Number(row.draws);
        const losses = Number(row.losses);
        const played = Number(row.matches_played);
        const progress = rankProgress(wins);
        const level = levelFor(xpFor(row));
        const medal = PODIUM[index];

        return (
          <li
            key={row.id}
            className="group flex items-center gap-3 border-t border-white/[0.05] px-3 py-3 transition-colors first:border-t-0 hover:bg-white/[0.03]"
          >
            <span
              className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl text-xs font-black ${
                medal
                  ? `bg-gradient-to-br ${medal} shadow-lg`
                  : "bg-white/[0.06] text-zinc-400"
              }`}
            >
              {index + 1}
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-semibold text-white">
                  {row.display_name}
                </span>
                <RankBadge wins={wins} showName={false} />
                <span className="shrink-0 rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-zinc-400">
                  Lv {level}
                </span>
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                <div className="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-300 transition-[width] duration-700"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <span className="shrink-0 font-mono text-[10px] text-zinc-500">
                  {wins}-{draws}-{losses}
                </span>
              </div>
            </div>

            <div className="shrink-0 text-right">
              <p className="font-mono text-xs font-semibold text-emerald-300">
                {formatMicros(row.total_points)}
                <span className="ml-0.5 text-[9px] font-normal text-zinc-600">
                  s
                </span>
              </p>
              <p className="text-[10px] uppercase tracking-wider text-zinc-600">
                {played} {played === 1 ? "match" : "matches"}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
