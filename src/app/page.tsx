"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import HowToPlay from "@/components/HowToPlay";
import LeaderboardTable from "@/components/LeaderboardTable";
import SetupNotice from "@/components/SetupNotice";
import SiteHeader from "@/components/SiteHeader";
import { api, clientErrorMessage, ensureSession } from "@/lib/client/api";
import { TURN_OPTIONS, type TurnOption } from "@/lib/game";
import { HAPTIC, vibrate } from "@/lib/haptics";
import { playSound } from "@/lib/sound";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";
import type { LeaderboardRow, MatchRow } from "@/lib/types";

const NAME_KEY = "pata:displayName";

interface OnlineUser {
  userId: string;
  name: string;
}

interface Challenge {
  from: string;
  code: string;
  turns: number;
}

export default function Home() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [turns, setTurns] = useState<TurnOption>(10);
  const [joinCode, setJoinCode] = useState("");
  const [showJoin, setShowJoin] = useState(false);
  const [busy, setBusy] = useState<"create" | "join" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [challenge, setChallenge] = useState<Challenge | null>(null);

  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const saved = localStorage.getItem(NAME_KEY) ?? "";
      if (!cancelled) setDisplayName(saved);
      if (!isSupabaseConfigured) return;

      try {
        const session = await ensureSession();
        if (cancelled) return;
        setUserId(session.user.id);
        const response = await fetch("/api/leaderboard", { cache: "no-store" });
        if (response.ok) {
          const payload = (await response.json()) as {
            leaderboard?: LeaderboardRow[];
          };
          if (!cancelled) setLeaderboard(payload.leaderboard ?? []);
        }
      } catch {
        // The setup notice or match flow will surface configuration issues.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Lobby presence + challenge notifications.
  useEffect(() => {
    if (!userId || !isSupabaseConfigured) return;

    let channel: RealtimeChannel | null = null;
    try {
      const supabase = getSupabase();
      channel = supabase.channel("lobby", {
        config: { presence: { key: userId }, broadcast: { self: false } },
      });

      const syncPresence = () => {
        const state = channel?.presenceState() ?? {};
        const users: OnlineUser[] = [];
        for (const [key, entries] of Object.entries(state)) {
          if (key === userId) continue;
          const entry = (entries as { name?: string }[])[0];
          users.push({ userId: key, name: entry?.name ?? "Player" });
        }
        setOnlineUsers(users);
      };

      channel
        .on("presence", { event: "sync" }, syncPresence)
        .on("broadcast", { event: "challenge" }, (message) => {
          const payload = message.payload as {
            to?: string;
            from?: string;
            code?: string;
            turns?: number;
          };
          if (payload?.to !== userId) return;
          if (!payload.code || !payload.from) return;
          setChallenge({
            from: payload.from,
            code: payload.code,
            turns: Number(payload.turns) || 10,
          });
          playSound("turn");
          vibrate(HAPTIC.turn);
        })
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            void channel?.track({
              name: displayName.trim() || "Guest",
              at: Date.now(),
            });
          }
        });

      channelRef.current = channel;
    } catch {
      // Presence is a nicety; the game works without it.
    }

    return () => {
      channelRef.current = null;
      if (channel) {
        try {
          void getSupabase().removeChannel(channel);
        } catch {
          // ignore teardown errors
        }
      }
    };
  }, [userId, displayName]);

  // Keep presence name in sync when the display name changes.
  useEffect(() => {
    const channel = channelRef.current;
    if (!channel || !userId) return;
    void channel.track({ name: displayName.trim() || "Guest", at: Date.now() });
  }, [displayName, userId]);

  function rememberName() {
    const clean = displayName.trim();
    if (clean.length >= 2) localStorage.setItem(NAME_KEY, clean);
    return clean;
  }

  function pickTurns(option: TurnOption) {
    setTurns(option);
    playSound("tap");
    vibrate(HAPTIC.tap);
  }

  async function createMatch() {
    if (busy) return;
    setError(null);
    const clean = rememberName();
    if (clean.length < 2) {
      setError("Choose a display name with at least 2 characters.");
      return;
    }

    setBusy("create");
    playSound("join");
    vibrate(HAPTIC.join);
    try {
      const { match } = await api<{ match: MatchRow }>("/api/matches", {
        method: "POST",
        body: { turnsPerPlayer: turns, displayName: clean },
      });
      router.push(`/match/${match.code}`);
    } catch (caught) {
      setError(clientErrorMessage(caught));
      setBusy(null);
    }
  }

  async function invitePlayer(target: OnlineUser) {
    if (busy) return;
    setError(null);
    const clean = rememberName();
    if (clean.length < 2) {
      setError("Choose a display name with at least 2 characters.");
      return;
    }

    setBusy("create");
    playSound("join");
    vibrate(HAPTIC.join);
    try {
      const { match } = await api<{ match: MatchRow }>("/api/matches", {
        method: "POST",
        body: { turnsPerPlayer: turns, displayName: clean },
      });
      const channel = channelRef.current;
      if (channel) {
        void channel.send({
          type: "broadcast",
          event: "challenge",
          payload: {
            to: target.userId,
            from: clean,
            code: match.code,
            turns,
          },
        });
      }
      router.push(`/match/${match.code}`);
    } catch (caught) {
      setError(clientErrorMessage(caught));
      setBusy(null);
    }
  }

  async function joinMatch() {
    if (busy) return;
    setError(null);
    const clean = rememberName();
    if (clean.length < 2) {
      setError("Choose a display name with at least 2 characters.");
      return;
    }
    const code = joinCode.trim().toUpperCase();
    if (code.length < 4) {
      setError("Enter the 6-character match code.");
      return;
    }

    setBusy("join");
    playSound("join");
    vibrate(HAPTIC.join);
    try {
      const { match } = await api<{ match: MatchRow }>("/api/matches/join", {
        method: "POST",
        body: { code, displayName: clean },
      });
      router.push(`/match/${match.code}`);
    } catch (caught) {
      setError(clientErrorMessage(caught));
      setBusy(null);
    }
  }

  const totalPlayers = leaderboard.length;
  const totalMatches = Math.round(
    leaderboard.reduce((sum, row) => sum + Number(row.matches_played), 0) / 2,
  );
  const topPoints = leaderboard.length
    ? Number(leaderboard[0].total_points)
    : 0;
  const initial = displayName.trim().charAt(0).toUpperCase() || "?";

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 pb-10">
      <SiteHeader />

      {/* Hero ---------------------------------------------------------- */}
      <section className="relative mt-6 sm:mt-10">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-8 right-0 hidden select-none sm:block"
        >
          {[
            { n: 67, x: 0, y: 0, d: "0s" },
            { n: 12, x: -74, y: 54, d: "1.2s" },
            { n: 89, x: -18, y: 116, d: "2.1s" },
          ].map((tile) => (
            <span
              key={tile.n}
              className="animate-float absolute grid h-12 w-12 place-items-center rounded-xl border border-white/10 bg-white/[0.04] font-mono text-sm font-semibold text-emerald-300/80 shadow-arena backdrop-blur"
              style={{
                transform: `translate(${tile.x}px, ${tile.y}px)`,
                animationDelay: tile.d,
              }}
            >
              {tile.n}
            </span>
          ))}
        </div>

        <p className="animate-fade-up inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-400/[0.08] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.28em] text-emerald-300">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
          Live two-player number hunt
        </p>

        <h1
          className="animate-fade-up font-display mt-4 max-w-2xl text-[2.6rem] font-bold leading-[0.98] tracking-tight text-white sm:text-6xl"
          style={{ animationDelay: "60ms" }}
        >
          Spot the number.
          <br />
          <span className="animate-gradient bg-gradient-to-r from-emerald-300 via-cyan-300 to-emerald-300 bg-clip-text text-transparent">
            Steal the clock.
          </span>
        </h1>

        <p
          className="animate-fade-up mt-4 max-w-xl text-sm leading-relaxed text-zinc-400 sm:text-base"
          style={{ animationDelay: "120ms" }}
        >
          One hundred numbers, shuffled every match. Pick a target — your
          opponent races to find it. Every microsecond they take becomes your
          score. Then you swap.
        </p>

        <div
          className="animate-fade-up mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-zinc-500"
          style={{ animationDelay: "180ms" }}
        >
          <span className="inline-flex items-center gap-1.5">
            <span className="text-emerald-400">◆</span> {totalPlayers} players
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="text-cyan-400">◆</span> {totalMatches} matches
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="text-amber-400">◆</span> {topPoints.toLocaleString()}{" "}
            µs top score
          </span>
        </div>
      </section>

      {/* Play ---------------------------------------------------------- */}
      {!isSupabaseConfigured ? (
        <div className="mt-8">
          <SetupNotice />
        </div>
      ) : (
        <section className="mt-8 grid gap-4 lg:grid-cols-[1.08fr_0.92fr]">
          <div
            className="animate-fade-up glass-strong relative overflow-hidden rounded-3xl p-5 shadow-arena sm:p-6"
            style={{ animationDelay: "160ms" }}
          >
            <div
              aria-hidden
              className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-emerald-400/10 blur-3xl"
            />

            <div className="relative">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-lg font-bold text-white">
                    Create a match
                  </h2>
                  <p className="mt-0.5 text-xs text-zinc-400">
                    Roles are drawn at random when your friend joins.
                  </p>
                </div>
                <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.2em] text-emerald-300">
                  Live
                </span>
              </div>

              <label
                htmlFor="display-name"
                className="mt-5 block text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500"
              >
                Display name
              </label>
              <div className="mt-2 flex items-center gap-2.5">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-emerald-300 to-cyan-400 text-base font-black text-emerald-950 shadow-[0_0_20px_rgba(52,211,153,0.35)]">
                  {initial}
                </span>
                <input
                  id="display-name"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  maxLength={24}
                  autoComplete="nickname"
                  placeholder="e.g. Wanjiku"
                  className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-emerald-400/60 focus:ring-2 focus:ring-emerald-400/20"
                />
              </div>

              <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                Turns per player
              </p>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {TURN_OPTIONS.map((option) => {
                  const selected = turns === option;
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => pickTurns(option)}
                      aria-pressed={selected}
                      className={`relative rounded-2xl border px-2 py-3 text-center transition-all duration-200 ${
                        selected
                          ? "border-emerald-400/60 bg-emerald-400/15 shadow-[0_0_22px_rgba(52,211,153,0.18)]"
                          : "border-white/10 bg-black/20 hover:border-white/25"
                      }`}
                    >
                      <span
                        className={`block font-display text-xl font-bold ${
                          selected ? "text-emerald-200" : "text-zinc-300"
                        }`}
                      >
                        {option}
                      </span>
                      <span className="mt-0.5 block text-[9px] font-semibold uppercase tracking-[0.15em] text-zinc-500">
                        each
                      </span>
                      {selected ? (
                        <span className="absolute right-1.5 top-1.5 grid h-4 w-4 place-items-center rounded-full bg-emerald-400 text-[9px] font-black text-emerald-950">
                          ✓
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-[11px] text-zinc-500">
                {turns} choices each · {turns * 2} total turns
              </p>

              <button
                type="button"
                onClick={createMatch}
                disabled={busy !== null}
                className="group relative mt-5 w-full overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-300 via-emerald-400 to-cyan-300 px-4 py-3.5 text-sm font-black text-emerald-950 shadow-[0_10px_30px_-10px_rgba(52,211,153,0.7)] transition hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="relative z-10">
                  {busy === "create" ? "Creating arena…" : "Create match →"}
                </span>
                <span
                  aria-hidden
                  className="shimmer absolute inset-0 opacity-40"
                />
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowJoin((value) => !value);
                  playSound("tap");
                }}
                className="mt-3 w-full rounded-2xl border border-white/10 px-4 py-2.5 text-xs font-semibold text-zinc-300 transition hover:border-white/20 hover:text-white"
              >
                {showJoin ? "Hide join code" : "I have a code"}
              </button>

              {showJoin ? (
                <div className="animate-slide-down mt-3 flex gap-2">
                  <input
                    value={joinCode}
                    onChange={(event) =>
                      setJoinCode(
                        event.target.value
                          .toUpperCase()
                          .replace(/[^A-Z0-9]/g, ""),
                      )
                    }
                    maxLength={6}
                    inputMode="text"
                    autoCapitalize="characters"
                    placeholder="ABC123"
                    aria-label="Match code"
                    className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 font-mono text-lg uppercase tracking-[0.3em] text-white outline-none transition placeholder:text-zinc-500 focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-400/20"
                  />
                  <button
                    type="button"
                    onClick={joinMatch}
                    disabled={busy !== null}
                    className="shrink-0 rounded-2xl border border-cyan-400/30 bg-cyan-400/10 px-5 text-sm font-bold text-cyan-200 transition hover:bg-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {busy === "join" ? "…" : "Join"}
                  </button>
                </div>
              ) : null}
            </div>
          </div>

          {/* Right column ------------------------------------------------ */}
          <div className="flex flex-col gap-4">
            {onlineUsers.length > 0 ? (
              <div
                className="animate-fade-up glass rounded-3xl p-5 shadow-arena"
                style={{ animationDelay: "180ms" }}
              >
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="font-display text-base font-bold text-white">
                    Online now
                  </h2>
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-400">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                    {onlineUsers.length} {onlineUsers.length === 1 ? "player" : "players"}
                  </span>
                </div>
                <ul className="space-y-2">
                  {onlineUsers.map((user) => (
                    <li
                      key={user.userId}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3 py-2.5"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-cyan-300 to-cyan-500 text-xs font-black text-cyan-950">
                          {user.name.charAt(0).toUpperCase() || "?"}
                        </span>
                        <span className="truncate text-sm font-semibold text-white">
                          {user.name}
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() => invitePlayer(user)}
                        disabled={busy !== null}
                        className="shrink-0 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-3 py-1.5 text-xs font-bold text-emerald-200 transition hover:bg-emerald-400/20 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Invite
                      </button>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-[10px] leading-snug text-zinc-500">
                  Sends them a live notification with your match code.
                </p>
              </div>
            ) : null}

            <div
              className="animate-fade-up glass rounded-3xl p-5 shadow-arena"
              style={{ animationDelay: "220ms" }}
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-display text-base font-bold text-white">
                  Top players
                </h2>
                <Link
                  href="/leaderboard"
                  className="text-[11px] font-semibold text-emerald-400 transition hover:text-emerald-300"
                >
                  All ranks →
                </Link>
              </div>
              <LeaderboardTable rows={leaderboard} limit={5} />
            </div>

            <div
              className="animate-fade-up glass relative overflow-hidden rounded-3xl p-5"
              style={{ animationDelay: "280ms" }}
            >
              <div
                aria-hidden
                className="pointer-events-none absolute -bottom-14 -right-10 h-40 w-40 rounded-full bg-cyan-400/10 blur-3xl"
              />
              <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-cyan-300">
                How it plays
              </p>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                {[
                  { icon: "🎯", label: "Pick" },
                  { icon: "⚡", label: "Hunt" },
                  { icon: "🏆", label: "Score" },
                ].map((step) => (
                  <div
                    key={step.label}
                    className="rounded-2xl border border-white/[0.06] bg-white/[0.03] px-2 py-3"
                  >
                    <span className="text-xl" aria-hidden>
                      {step.icon}
                    </span>
                    <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                      {step.label}
                    </p>
                  </div>
                ))}
              </div>
              <HowToPlay variant="link" className="mt-4 inline-block" />
            </div>
          </div>
        </section>
      )}

      {error ? (
        <div
          role="alert"
          className="animate-slide-down mt-4 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200"
        >
          {error}
        </div>
      ) : null}

      {/* Feature strip ------------------------------------------------- */}
      <section className="mt-8 grid grid-cols-3 gap-2 sm:gap-3">
        {[
          { icon: "⏱️", title: "Server-timed", body: "Microsecond fair" },
          { icon: "🎲", title: "Shared board", body: "Same shuffle" },
          { icon: "🏆", title: "Ranked", body: "Every match counts" },
        ].map((item) => (
          <div
            key={item.title}
            className="rounded-2xl border border-white/[0.07] bg-white/[0.025] px-3 py-3 text-center"
          >
            <span className="text-base" aria-hidden>
              {item.icon}
            </span>
            <p className="mt-1 text-[11px] font-semibold text-zinc-300">
              {item.title}
            </p>
            <p className="text-[10px] text-zinc-500">{item.body}</p>
          </div>
        ))}
      </section>

      {challenge ? (
        <div className="animate-slide-up fixed inset-x-3 bottom-[calc(var(--safe-bottom)+0.75rem)] z-50 mx-auto max-w-md">
          <div className="glass-strong flex items-center gap-3 rounded-2xl p-3 shadow-arena">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-emerald-300 to-cyan-400 text-lg font-black text-emerald-950">
              ⚡
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white">
                {challenge.from} wants to play
              </p>
              <p className="text-xs leading-snug text-zinc-400">
                {challenge.turns} turns each · tap Join to enter the arena.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                const code = challenge.code;
                setChallenge(null);
                router.push(`/match/${code}`);
              }}
              className="shrink-0 rounded-xl bg-emerald-400 px-3.5 py-2 text-xs font-bold text-emerald-950 transition hover:bg-emerald-300"
            >
              Join
            </button>
            <button
              type="button"
              onClick={() => setChallenge(null)}
              aria-label="Dismiss challenge"
              className="shrink-0 rounded-lg p-2 text-zinc-500 transition hover:bg-white/5 hover:text-white"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M6 6l12 12M18 6L6 18"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        </div>
      ) : null}

      <footer className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-white/5 pt-5 text-[11px] text-zinc-500">
        <span>PATA · a two-player number hunt</span>
        <span>Timing measured on the server</span>
      </footer>
    </main>
  );
}
