"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import Confetti from "@/components/Confetti";
import NumberGrid, { type GridMode } from "@/components/NumberGrid";
import ScoreBar from "@/components/ScoreBar";
import SiteHeader from "@/components/SiteHeader";
import TurnPips from "@/components/TurnPips";
import ActionPanel from "@/components/match/ActionPanel";
import MatchResult from "@/components/match/MatchResult";
import PlayerCard from "@/components/match/PlayerCard";
import ReactionBar from "@/components/match/ReactionBar";
import { api, clientErrorMessage, ensureSession } from "@/lib/client/api";
import { formatElapsed, toMillis } from "@/lib/game";
import { HAPTIC, vibrate } from "@/lib/haptics";
import { playSound } from "@/lib/sound";
import { getSupabase } from "@/lib/supabase/client";
import type { MatchRow, MatchStateResponse, TurnRow } from "@/lib/types";

const NAME_KEY = "pata:displayName";

interface Toast {
  id: string;
  number: number;
  elapsed: number;
  chooserName: string;
}

interface FloatingReaction {
  id: string;
  emoji: string;
  left: number;
}

export default function MatchClient({ code }: { code: string }) {
  const normalized = code.toUpperCase();
  const router = useRouter();

  const [match, setMatch] = useState<MatchRow | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [clockOffset, setClockOffset] = useState(0);
  const [wrong, setWrong] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [lastTurn, setLastTurn] = useState<TurnRow | null>(null);
  const [joining, setJoining] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [reactions, setReactions] = useState<FloatingReaction[]>([]);
  const [onlineCount, setOnlineCount] = useState(1);
  const [celebrate, setCelebrate] = useState(false);
  const [player1Avatar, setPlayer1Avatar] = useState<string | null>(null);
  const [player2Avatar, setPlayer2Avatar] = useState<string | null>(null);

  const wrongTimer = useRef<number | null>(null);
  const toastTimer = useRef<number | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const userIdRef = useRef<string | null>(null);
  const seenTurnRef = useRef<string | null>(null);
  const prevStatusRef = useRef<string | null>(null);
  const prevTurnRef = useRef<number | null>(null);

  const addReaction = useCallback((emoji: string) => {
    const id = Math.random().toString(36).slice(2);
    setReactions((prev) => [
      ...prev.slice(-8),
      { id, emoji, left: 8 + Math.random() * 76 },
    ]);
    window.setTimeout(() => {
      setReactions((prev) => prev.filter((item) => item.id !== id));
    }, 2300);
  }, []);

  const applyState = useCallback((payload: MatchStateResponse) => {
    setMatch(payload.match);
    setClockOffset(toMillis(payload.serverNow) - Date.now());
    if (payload.player1Avatar !== undefined) setPlayer1Avatar(payload.player1Avatar ?? null);
    if (payload.player2Avatar !== undefined) setPlayer2Avatar(payload.player2Avatar ?? null);
    setError(null);

    const turn = payload.lastTurn ?? null;
    if (turn) {
      setLastTurn(turn);
      if (seenTurnRef.current !== turn.id) {
        const firstSight = seenTurnRef.current === null;
        seenTurnRef.current = turn.id;
        if (!firstSight) {
          const chooserName =
            turn.chooser === payload.match.player1
              ? payload.match.player1_name
              : (payload.match.player2_name ?? "Opponent");
          setToast({
            id: turn.id,
            number: turn.chosen_number,
            elapsed: Number(turn.elapsed_us ?? 0),
            chooserName,
          });
          playSound("found");
          vibrate(HAPTIC.found);
          if (toastTimer.current) window.clearTimeout(toastTimer.current);
          toastTimer.current = window.setTimeout(() => {
            setToast((current) => (current?.id === turn.id ? null : current));
          }, 3400);
        }
      }
    }

    if (
      prevStatusRef.current === "active" &&
      payload.match.status === "finished"
    ) {
      setCelebrate(true);
      playSound("win");
      vibrate(HAPTIC.win);
    }
    prevStatusRef.current = payload.match.status;

    if (
      payload.match.status === "active" &&
      prevTurnRef.current !== null &&
      prevTurnRef.current !== payload.match.turn_index &&
      payload.match.chooser === userIdRef.current
    ) {
      playSound("turn");
      vibrate(HAPTIC.turn);
    }
    prevTurnRef.current = payload.match.turn_index;
  }, []);

  const refresh = useCallback(async () => {
    try {
      const payload = await api<MatchStateResponse>(
        `/api/matches/${normalized}`,
      );
      applyState(payload);
    } catch (caught) {
      setError(clientErrorMessage(caught));
    }
  }, [applyState, normalized]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const session = await ensureSession();
        if (cancelled) return;
        userIdRef.current = session.user.id;
        setUserId(session.user.id);
        await refresh();
      } catch (caught) {
        if (!cancelled) setError(clientErrorMessage(caught));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  // Live updates through Supabase Realtime, with polling as a safety net.
  useEffect(() => {
    if (!userId) return;

    const interval = window.setInterval(() => {
      void refresh();
    }, 2500);

    let channel: RealtimeChannel | null = null;
    try {
      const supabase = getSupabase();
      channel = supabase
        .channel(`match:${normalized}`, {
          config: {
            broadcast: { self: false },
            presence: { key: userId },
          },
        })
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "matches",
            filter: `code=eq.${normalized}`,
          },
          () => {
            void refresh();
          },
        )
        .on("broadcast", { event: "reaction" }, (message) => {
          const payload = message.payload as { emoji?: string } | undefined;
          if (payload?.emoji) addReaction(payload.emoji);
        })
        .on("presence", { event: "sync" }, () => {
          const state = channel?.presenceState() ?? {};
          setOnlineCount(Object.keys(state).length);
        })
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            void channel?.track({ userId, at: Date.now() });
          }
        });
      channelRef.current = channel;
    } catch {
      // Polling keeps the match in sync if realtime is unavailable.
    }

    return () => {
      window.clearInterval(interval);
      channelRef.current = null;
      if (channel) {
        try {
          void getSupabase().removeChannel(channel);
        } catch {
          // ignore teardown errors
        }
      }
    };
  }, [addReaction, normalized, refresh, userId]);

  // Discourage find-in-page cheating while a hunt is in progress.
  useEffect(() => {
    if (!match || match.status !== "active") return;
    const handler = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if ((event.ctrlKey || event.metaKey) && key === "f") {
        event.preventDefault();
        event.stopPropagation();
      }
      if (key === "f3") {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("keydown", handler, { capture: true });
    return () => window.removeEventListener("keydown", handler, { capture: true });
  }, [match?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => {
      if (wrongTimer.current) window.clearTimeout(wrongTimer.current);
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    };
  }, []);

  const isPlayer1 = match?.player1 === userId;
  const isPlayer2 = match?.player2 === userId;
  const isSpectator = Boolean(match) && !isPlayer1 && !isPlayer2;
  const isChooser = Boolean(match && match.chooser === userId);
  const isFinder = Boolean(match && match.finder === userId);

  const opponentName = isPlayer1
    ? (match?.player2_name ?? "Opponent")
    : (match?.player1_name ?? "Opponent");

  function roleFor(id: string): string {
    if (!match) return "Waiting";
    if (match.status === "waiting") {
      return id === match.player1 ? "Ready" : "Waiting";
    }
    if (match.status === "finished") {
      if (match.winner === null) return "Draw";
      return match.winner === id ? "Winner" : "Finished";
    }
    if (match.chooser === id) {
      return match.target_number == null ? "Choosing" : "Waiting";
    }
    if (match.finder === id) {
      return match.target_number == null ? "Waiting" : "Hunting";
    }
    return "Spectating";
  }

  async function chooseNumber(value: number) {
    if (!match || busy) return;
    setBusy(true);
    setError(null);
    playSound("select");
    vibrate(HAPTIC.select);
    try {
      const payload = await api<MatchStateResponse>(
        `/api/matches/${normalized}/select`,
        { method: "POST", body: { number: value } },
      );
      applyState(payload);
    } catch (caught) {
      setError(clientErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function submitFound(value: number) {
    if (!match || busy) return;
    setBusy(true);
    setError(null);
    try {
      const payload = await api<MatchStateResponse>(
        `/api/matches/${normalized}/found`,
        { method: "POST", body: { number: value } },
      );
      applyState(payload);
    } catch (caught) {
      setError(clientErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  function handleCellClick(value: number) {
    if (!match || busy || match.status !== "active") return;
    if (match.used_numbers.includes(value)) return;

    if (isFinder && match.target_number != null) {
      if (value !== match.target_number) {
        setWrong(value);
        playSound("wrong");
        vibrate(HAPTIC.wrong);
        if (wrongTimer.current) window.clearTimeout(wrongTimer.current);
        wrongTimer.current = window.setTimeout(() => {
          setWrong((current) => (current === value ? null : current));
        }, 550);
        return;
      }
      void submitFound(value);
      return;
    }

    if (isChooser && match.target_number == null) {
      void chooseNumber(value);
    }
  }

  async function copyInvite() {
    const url = `${window.location.origin}/match/${normalized}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      playSound("tap");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError(`Could not copy the link. The match code is ${normalized}.`);
    }
  }

  async function shareInvite() {
    const url = `${window.location.origin}/match/${normalized}`;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: "PATA — Number Hunt",
          text: `Join my PATA match (${normalized})`,
          url,
        });
        return;
      } catch {
        // Fall back to copying.
      }
    }
    await copyInvite();
  }

  function sendReaction(emoji: string) {
    playSound("tap");
    vibrate(HAPTIC.tap);
    addReaction(emoji);
    const channel = channelRef.current;
    if (channel) {
      void channel.send({
        type: "broadcast",
        event: "reaction",
        payload: { emoji },
      });
    }
  }

  async function joinThisMatch() {
    const savedName = localStorage.getItem(NAME_KEY);
    if (!savedName) {
      router.push("/");
      return;
    }
    setJoining(true);
    setError(null);
    playSound("join");
    vibrate(HAPTIC.join);
    try {
      const payload = await api<{ match: MatchRow }>("/api/matches/join", {
        method: "POST",
        body: { code: normalized, displayName: savedName },
      });
      setMatch(payload.match);
      await refresh();
    } catch (caught) {
      setError(clientErrorMessage(caught));
    } finally {
      setJoining(false);
    }
  }

  let gridMode: GridMode = "watch";
  if (match?.status === "active") {
    if (isChooser && match.target_number == null) {
      gridMode = "choose";
    } else if (isFinder && match.target_number != null) {
      gridMode = "hunt";
    } else {
      gridMode = "locked";
    }
  }

  const isHunting =
    match?.status === "active" &&
    match.target_number != null &&
    match.target_since != null;

  const winnerName: string | null = match
    ? match.winner === match.player1
      ? match.player1_name
      : match.winner === match.player2
        ? (match.player2_name ?? null)
        : null
    : null;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-3 px-3 pb-8 sm:gap-4 sm:px-4">
      <SiteHeader />

      <div className="flex items-center justify-between gap-2">
        <Link
          href="/"
          className="rounded-xl border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-xs text-zinc-400 transition hover:border-white/20 hover:text-white"
        >
          ← Lobby
        </Link>
        <div className="flex items-center gap-1.5">
          <span className="rounded-lg border border-white/10 bg-black/30 px-2 py-1 font-mono text-xs tracking-[0.22em] text-white">
            {normalized}
          </span>
          <button
            type="button"
            onClick={copyInvite}
            aria-label="Copy invite link"
            className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 text-zinc-300 transition hover:border-emerald-400/40 hover:text-white"
          >
            {copied ? "✓" : "⧉"}
          </button>
          <button
            type="button"
            onClick={shareInvite}
            aria-label="Share invite"
            className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 text-zinc-300 transition hover:border-emerald-400/40 hover:text-white"
          >
            ↗
          </button>
        </div>
      </div>

      {error ? (
        <div
          role="alert"
          className="animate-slide-down rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-2.5 text-sm text-rose-200"
        >
          {error}
        </div>
      ) : null}

      {!match ? (
        <div className="grid flex-1 place-items-center py-24">
          <div className="flex flex-col items-center gap-3 text-zinc-500">
            <span className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-emerald-400" />
            <p className="text-sm">Entering the arena…</p>
          </div>
        </div>
      ) : match.status === "waiting" ? (
        <section className="glass-strong relative overflow-hidden rounded-3xl p-5 text-center shadow-arena sm:p-7">
          <span
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-0 h-40 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-400/15 blur-3xl"
          />
          <div className="relative">
            <p className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.32em] text-emerald-300">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
              Waiting for opponent
            </p>

            <div className="mt-4 flex justify-center gap-1.5">
              {normalized.split("").map((character, index) => (
                <span
                  key={`${character}-${index}`}
                  className="animate-pop grid h-12 w-9 place-items-center rounded-xl border border-white/10 bg-black/40 font-mono text-2xl font-bold text-white shadow-arena"
                  style={{ animationDelay: `${index * 60}ms` }}
                >
                  {character}
                </span>
              ))}
            </div>

            <p className="mt-3 text-xs leading-relaxed text-zinc-400">
              Share the code or invite link. The board unlocks the moment they
              join.
            </p>

            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={shareInvite}
                className="rounded-xl bg-emerald-400 px-4 py-2.5 text-sm font-bold text-emerald-950 transition hover:bg-emerald-300 active:scale-95"
              >
                {copied ? "Invite copied" : "Share invite"}
              </button>
              <button
                type="button"
                onClick={copyInvite}
                className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-semibold text-white transition hover:border-emerald-400/50 hover:bg-emerald-400/10"
              >
                Copy link
              </button>
              {isSpectator ? (
                <button
                  type="button"
                  onClick={joinThisMatch}
                  disabled={joining}
                  className="rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-2.5 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-400/20 disabled:opacity-60"
                >
                  {joining ? "Joining…" : "Join this match"}
                </button>
              ) : null}
            </div>

            <div className="mt-6 opacity-25">
              <NumberGrid
                board={match.board}
                usedNumbers={match.used_numbers}
                targetNumber={null}
                mode="watch"
                wrongNumber={null}
                onCellClick={() => {}}
              />
            </div>
          </div>
        </section>
      ) : (
        <>
          <div className="flex gap-2">
            <PlayerCard
              name={match.player1_name}
              avatar={player1Avatar}
              score={match.player1_score}
              role={roleFor(match.player1)}
              isMe={Boolean(isPlayer1)}
              winner={match.winner === match.player1}
              tone="emerald"
            />
            <PlayerCard
              name={match.player2_name ?? "Opponent"}
              avatar={player2Avatar}
              score={match.player2_score}
              role={match.player2 ? roleFor(match.player2) : "Waiting"}
              isMe={Boolean(isPlayer2)}
              winner={match.player2 != null && match.winner === match.player2}
              tone="cyan"
            />
          </div>

          <ScoreBar
            left={Number(match.player1_score)}
            right={Number(match.player2_score)}
          />

          {match.status === "finished" ? (
            <MatchResult match={match} winnerName={winnerName} />
          ) : (
            <ActionPanel
              isChooser={isChooser}
              isFinder={isFinder}
              isSpectator={isSpectator}
              isHunting={Boolean(isHunting)}
              targetNumber={match.target_number}
              targetSince={match.target_since}
              clockOffset={clockOffset}
              opponentName={opponentName}
              wrong={wrong}
            />
          )}

          <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
            <span>
              Turn {Math.min(match.turn_index + 1, match.total_turns)} of{" "}
              {match.total_turns}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  onlineCount > 1
                    ? "animate-pulse bg-emerald-400"
                    : "bg-zinc-600"
                }`}
              />
              {onlineCount > 1 ? "Opponent online" : "Solo in arena"}
            </span>
          </div>

          <TurnPips total={match.total_turns} current={match.turn_index} />

          <div className="relative rounded-3xl border border-white/10 bg-black/25 p-2.5 shadow-arena sm:p-3.5">
            <NumberGrid
              board={match.board}
              usedNumbers={match.used_numbers}
              targetNumber={match.target_number}
              mode={gridMode}
              wrongNumber={wrong}
              highlightTarget={isChooser}
              disabled={busy}
              onCellClick={handleCellClick}
            />

            {reactions.length > 0 ? (
              <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl">
                {reactions.map((reaction) => (
                  <span
                    key={reaction.id}
                    className="animate-rise-fade absolute bottom-3 text-2xl"
                    style={{ left: `${reaction.left}%` }}
                    aria-hidden
                  >
                    {reaction.emoji}
                  </span>
                ))}
              </div>
            ) : null}
          </div>

          <ReactionBar onReact={sendReaction} disabled={!userId} />

          {lastTurn?.elapsed_us != null ? (
            <p className="text-center text-[11px] text-zinc-500">
              Last hunt:{" "}
              <span className="font-mono text-zinc-300">
                {lastTurn.chosen_number}
              </span>{" "}
              found in{" "}
              <span className="font-mono text-emerald-300">
                {formatElapsed(lastTurn.elapsed_us)} s
              </span>
            </p>
          ) : null}

          {busy ? (
            <p className="text-center text-[11px] text-zinc-500">Sending…</p>
          ) : null}
        </>
      )}

      <Confetti active={celebrate} />

      {toast ? (
        <div className="animate-slide-down fixed inset-x-3 top-[calc(var(--safe-top)+4.6rem)] z-50 mx-auto max-w-sm">
          <div className="glass-strong flex items-center gap-2.5 rounded-2xl px-3 py-2.5 shadow-arena">
            <span className="text-lg" aria-hidden>
              ⚡
            </span>
            <p className="min-w-0 text-[11px] leading-snug text-zinc-200">
              <span className="font-mono font-semibold text-white">
                {toast.number}
              </span>{" "}
              found in{" "}
              <span className="font-mono font-semibold text-emerald-300">
                {formatElapsed(toast.elapsed)}s
              </span>
              <span className="text-zinc-500">
                {" "}
                · +{formatElapsed(toast.elapsed)}s to {toast.chooserName}
              </span>
            </p>
          </div>
        </div>
      ) : null}
    </main>
  );
}
