"use client";

import LiveTimer from "@/components/LiveTimer";

export default function ActionPanel({
  isChooser,
  isFinder,
  isSpectator,
  isHunting,
  targetNumber,
  targetSince,
  clockOffset,
  opponentName,
  wrong,
}: {
  isChooser: boolean;
  isFinder: boolean;
  isSpectator: boolean;
  isHunting: boolean;
  targetNumber: number | null;
  targetSince: string | null;
  clockOffset: number;
  opponentName: string;
  wrong: number | null;
}) {
  const theme = isFinder
    ? {
        border: "border-cyan-400/25",
        bg: "bg-cyan-400/[0.06]",
        label: "text-cyan-300",
        glow: "bg-cyan-400/15",
        number: "text-cyan-200 text-glow-cyan",
        timer: "text-cyan-200",
      }
    : isChooser
      ? {
          border: "border-emerald-400/25",
          bg: "bg-emerald-400/[0.06]",
          label: "text-emerald-300",
          glow: "bg-emerald-400/15",
          number: "text-emerald-200 text-glow",
          timer: "text-emerald-200",
        }
      : {
          border: "border-white/10",
          bg: "bg-white/[0.03]",
          label: "text-zinc-400",
          glow: "bg-white/10",
          number: "text-white",
          timer: "text-white",
        };

  const hunting = isHunting && targetSince;

  return (
    <section
      className={`relative overflow-hidden rounded-3xl border p-4 text-center sm:p-5 ${theme.border} ${theme.bg}`}
    >
      <span
        aria-hidden
        className={`pointer-events-none absolute left-1/2 top-0 h-28 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl ${theme.glow}`}
      />

      <div className="relative">
        {hunting ? (
          <>
            <p
              className={`text-[10px] font-bold uppercase tracking-[0.32em] ${theme.label}`}
            >
              {isFinder
                ? "Hunt"
                : isChooser
                  ? "Hunt in progress"
                  : "Spectating"}
            </p>

            {isFinder ? (
              <h2 className="font-display mt-1 text-lg font-semibold text-zinc-200">
                Find{" "}
                <span className={`font-display text-3xl font-bold ${theme.number}`}>
                  {targetNumber}
                </span>
              </h2>
            ) : isChooser ? (
              <h2 className="font-display mt-1 text-lg font-semibold text-zinc-200">
                You chose{" "}
                <span className={`font-display text-3xl font-bold ${theme.number}`}>
                  {targetNumber}
                </span>
              </h2>
            ) : (
              <h2 className="font-display mt-1 text-lg font-semibold text-zinc-200">
                {opponentName || "The hunt"}
              </h2>
            )}

            <div
              className={`mt-1 flex items-baseline justify-center gap-1 font-mono text-4xl font-bold tabular-nums ${theme.timer}`}
            >
              <LiveTimer targetSince={targetSince} clockOffset={clockOffset} />
              <span className="text-xs font-normal text-zinc-500">s</span>
            </div>

            <p className="mt-1 text-[11px] leading-snug text-zinc-400">
              {isFinder
                ? "Every microsecond is a point for your opponent."
                : isChooser
                  ? `Points in play while ${opponentName || "your opponent"} searches.`
                  : "The clock is running."}
            </p>

            {isFinder && wrong != null ? (
              <p className="animate-shake mt-2 text-xs font-semibold text-rose-300">
                That&apos;s {wrong}, not {targetNumber} — keep looking.
              </p>
            ) : null}
          </>
        ) : isChooser ? (
          <>
            <p
              className={`text-[10px] font-bold uppercase tracking-[0.32em] ${theme.label}`}
            >
              Your turn
            </p>
            <h2 className="font-display mt-1 text-xl font-bold text-white">
              Pick a number to hide
            </h2>
            <p className="mt-1 text-[11px] leading-snug text-zinc-400">
              Tap any unlocked tile. {opponentName || "Your opponent"} will race
              to find it.
            </p>
          </>
        ) : isFinder ? (
          <>
            <p className="text-[10px] font-bold uppercase tracking-[0.32em] text-zinc-500">
              Stand by
            </p>
            <h2 className="font-display mt-1 text-xl font-bold text-white">
              {opponentName || "Your opponent"} is choosing…
            </h2>
            <p className="mt-1 text-[11px] leading-snug text-zinc-400">
              The clock starts the moment they pick.
            </p>
          </>
        ) : isSpectator ? (
          <>
            <p className="text-[10px] font-bold uppercase tracking-[0.32em] text-zinc-500">
              Spectating
            </p>
            <h2 className="font-display mt-1 text-xl font-bold text-white">
              Waiting for the next choice
            </h2>
            <p className="mt-1 text-[11px] leading-snug text-zinc-400">
              You are watching this match live.
            </p>
          </>
        ) : (
          <p className="py-2 text-sm text-zinc-400">Syncing with the match…</p>
        )}
      </div>
    </section>
  );
}
