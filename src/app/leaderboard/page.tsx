"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import LeaderboardTable from "@/components/LeaderboardTable";
import RankBadge from "@/components/RankBadge";
import SetupNotice from "@/components/SetupNotice";
import SiteHeader from "@/components/SiteHeader";
import { formatMicros } from "@/lib/game";
import { RANKS, rankFor } from "@/lib/gamification";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import type { LeaderboardRow, RecentMatch } from "@/lib/types";

const MEDALS = ["🥇", "🥈", "🥉"];

export default function LeaderboardPage() {
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [recent, setRecent] = useState<RecentMatch[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/leaderboard", {
          cache: "no-store",
        });
        const payload = (await response.json()) as {
          leaderboard?: LeaderboardRow[];
          recent?: RecentMatch[];
          error?: string;
        };
        if (!response.ok) {
          throw new Error(payload.error ?? "Could not load rankings.");
        }
        if (!cancelled) {
          setRows(payload.leaderboard ?? []);
          setRecent(payload.recent ?? []);
        }
      } catch (caught) {
        if (!cancelled) {
          setError(
            caught instanceof Error ? caught.message : "Could not load rankings.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const totalMatches = Math.round(
    rows.reduce((sum, row) => sum + Number(row.matches_played), 0) / 2,
  );
  const totalPlayers = rows.length;
  const totalPoints = rows.reduce(
    (sum, row) => sum + Number(row.total_points),
    0,
  );
  const top3 = rows.slice(0, 3);

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 pb-10">
      <SiteHeader />

      <section className="mt-6 space-y-3 sm:mt-8">
        <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-emerald-400">
          Community
        </p>
        <h1 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Rankings
        </h1>
        <p className="max-w-xl text-sm leading-relaxed text-zinc-400">
          Every match is recorded. Players are ranked by wins, then by total
          points collected — where points are the microseconds your opponents
          spent hunting.
        </p>
      </section>

      {!isSupabaseConfigured ? (
        <div className="mt-6">
          <SetupNotice />
        </div>
      ) : (
        <>
          <div className="mt-5 grid grid-cols-3 gap-2 sm:gap-3">
            <Stat label="Players" value={String(totalPlayers)} tone="emerald" />
            <Stat label="Matches" value={String(totalMatches)} tone="cyan" />
            <Stat
              label="Total points"
              value={formatMicros(totalPoints)}
              tone="amber"
            />
          </div>

          {error ? (
            <div
              role="alert"
              className="mt-4 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200"
            >
              {error}
            </div>
          ) : null}

          {loading ? (
            <div className="mt-6 space-y-3">
              {[0, 1, 2, 3].map((index) => (
                <div
                  key={index}
                  className="h-16 animate-pulse rounded-2xl bg-white/[0.04]"
                />
              ))}
            </div>
          ) : (
            <>
              {top3.length ? (
                <section className="mt-6">
                  <div className="grid gap-3 sm:grid-cols-3 sm:items-end">
                    {top3.map((row, index) => {
                      const tier = rankFor(Number(row.wins));
                      const first = index === 0;
                      return (
                        <div
                          key={row.id}
                          className={`animate-fade-up relative overflow-hidden rounded-3xl border p-4 text-center ${
                            first
                              ? "border-amber-300/40 bg-gradient-to-b from-amber-400/[0.12] to-white/[0.02] shadow-[0_0_40px_-12px_rgba(251,191,36,0.5)] sm:order-2 sm:py-7"
                              : index === 1
                                ? "border-white/10 bg-white/[0.03] sm:order-1"
                                : "border-orange-300/20 bg-white/[0.03] sm:order-3"
                          }`}
                          style={{ animationDelay: `${index * 80}ms` }}
                        >
                          <span className="text-2xl" aria-hidden>
                            {MEDALS[index]}
                          </span>
                          <p className="mt-1 truncate font-display text-base font-bold text-white">
                            {row.display_name}
                          </p>
                          <div className="mt-1.5 flex justify-center">
                            <RankBadge wins={Number(row.wins)} />
                          </div>
                          <p className="mt-2 font-mono text-sm font-semibold text-emerald-300">
                            {formatMicros(row.total_points)}
                            <span className="ml-0.5 text-[10px] font-normal text-zinc-500">
                              s
                            </span>
                          </p>
                          <p className="mt-0.5 text-[10px] uppercase tracking-wider text-zinc-500">
                            {Number(row.wins)}W · {Number(row.draws)}D ·{" "}
                            {Number(row.losses)}L
                          </p>
                          <span
                            aria-hidden
                            className="pointer-events-none absolute inset-x-0 -bottom-10 h-16 rounded-full opacity-40 blur-2xl"
                            style={{ background: tier.glow }}
                          />
                        </div>
                      );
                    })}
                  </div>
                </section>
              ) : null}

              <section className="mt-6 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-base font-bold text-white">
                    The board
                  </h2>
                  <span className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">
                    Wins → points
                  </span>
                </div>
                <LeaderboardTable rows={rows} />
              </section>

              <section className="mt-8 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-base font-bold text-white">
                    Rank ladder
                  </h2>
                  <span className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">
                    Wins to climb
                  </span>
                </div>
                <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                  {RANKS.map((tier) => (
                    <div
                      key={tier.key}
                      className={`shrink-0 rounded-2xl px-3 py-2 ring-1 ${tier.badge}`}
                    >
                      <p className={`text-xs font-bold ${tier.text}`}>
                        <span aria-hidden>{tier.emoji}</span> {tier.name}
                      </p>
                      <p className="mt-0.5 text-[10px] text-zinc-500">
                        {tier.minWins === 0 ? "Start" : `${tier.minWins}+ wins`}
                      </p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="mt-8 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-base font-bold text-white">
                    Recent results
                  </h2>
                  <span className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">
                    Last 12
                  </span>
                </div>

                {recent.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-6 text-center text-sm text-zinc-500">
                    No finished matches yet.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {recent.map((game) => {
                      const p1Won = game.winner === game.player1;
                      const p2Won = game.winner === game.player2;
                      const verdict =
                        game.winner === null
                          ? "Draw"
                          : p1Won
                            ? `${game.player1_name} won`
                            : `${game.player2_name ?? "Opponent"} won`;

                      return (
                        <Link
                          key={game.id}
                          href={`/match/${game.code}`}
                          className="group flex items-center justify-between gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.025] px-4 py-3 transition hover:border-emerald-400/25 hover:bg-white/[0.04]"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm">
                              <span
                                className={
                                  p1Won
                                    ? "font-semibold text-emerald-300"
                                    : "text-zinc-200"
                                }
                              >
                                {game.player1_name}
                              </span>
                              <span className="mx-1.5 text-[10px] uppercase tracking-wider text-zinc-600">
                                vs
                              </span>
                              <span
                                className={
                                  p2Won
                                    ? "font-semibold text-emerald-300"
                                    : "text-zinc-200"
                                }
                              >
                                {game.player2_name ?? "—"}
                              </span>
                            </p>
                            <p className="mt-0.5 text-[11px] text-zinc-500">
                              {verdict}
                              {game.finished_at
                                ? ` · ${new Date(game.finished_at).toLocaleDateString()}`
                                : ""}
                            </p>
                          </div>
                          <p className="shrink-0 text-right font-mono text-[11px] text-zinc-400">
                            <span className="block">
                              {formatMicros(game.player1_score)}
                            </span>
                            <span className="block text-zinc-600">
                              {formatMicros(game.player2_score)}
                            </span>
                          </p>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </section>
            </>
          )}
        </>
      )}

      <footer className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-white/5 pt-5 text-[11px] text-zinc-600">
        <Link href="/" className="transition hover:text-zinc-300">
          ← Back to lobby
        </Link>
        <span>Ranked by wins, then total points</span>
      </footer>
    </main>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "emerald" | "cyan" | "amber";
}) {
  const tones = {
    emerald: "text-emerald-300",
    cyan: "text-cyan-300",
    amber: "text-amber-300",
  } as const;

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] px-3 py-3 text-center">
      <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-zinc-500">
        {label}
      </p>
      <p className={`mt-1 truncate font-mono text-sm font-semibold ${tones[tone]}`}>
        {value}
      </p>
    </div>
  );
}
