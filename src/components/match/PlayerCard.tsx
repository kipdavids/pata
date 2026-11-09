"use client";

import AnimatedNumber from "@/components/AnimatedNumber";
import { formatElapsed } from "@/lib/game";

export default function PlayerCard({
  name,
  avatar,
  score,
  role,
  isMe,
  winner,
  tone,
}: {
  name: string;
  avatar?: string | null;
  score: number;
  role: string;
  isMe: boolean;
  winner: boolean;
  tone: "emerald" | "cyan";
}) {
  const active = role === "Choosing" || role === "Hunting" || role === "Winner";
  const accent =
    tone === "emerald"
      ? {
          border: "border-emerald-400/50",
          bg: "bg-emerald-400/[0.09]",
          text: "text-emerald-300",
          line: "via-emerald-300",
        }
      : {
          border: "border-cyan-400/50",
          bg: "bg-cyan-400/[0.09]",
          text: "text-cyan-300",
          line: "via-cyan-300",
        };

  return (
    <div
      className={`relative min-w-0 flex-1 overflow-hidden rounded-2xl border p-3 transition-all duration-500 sm:p-3.5 ${
        winner
          ? "border-amber-300/60 bg-amber-400/[0.1] shadow-[0_0_30px_-10px_rgba(251,191,36,0.6)]"
          : active
            ? `${accent.border} ${accent.bg}`
            : "border-white/10 bg-white/[0.03]"
      }`}
    >
      {active ? (
        <span
          aria-hidden
          className={`absolute inset-x-3 top-0 h-px bg-gradient-to-r from-transparent ${accent.line} to-transparent`}
        />
      ) : null}

      <div className="flex items-center justify-between gap-1.5">
        <p className="flex min-w-0 items-center gap-1.5 truncate text-xs font-semibold text-white">
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatar} alt="" className="h-5 w-5 shrink-0 rounded-md object-cover ring-1 ring-white/10" />
          ) : (
            <span className="grid h-5 w-5 shrink-0 place-items-center rounded-md bg-white/[0.08] text-[9px] font-bold text-zinc-300">
              {name.charAt(0).toUpperCase() || "?"}
            </span>
          )}
          <span className="truncate">{name}</span>
          {isMe ? (
            <span className="shrink-0 rounded bg-white/10 px-1 py-0.5 text-[8px] font-bold uppercase tracking-wider text-zinc-300">
              You
            </span>
          ) : null}
        </p>
        {active ? (
          <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-emerald-400" />
        ) : null}
      </div>

      <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
        {role}
      </p>

      <p
        className={`mt-1.5 font-mono text-base font-bold sm:text-lg ${
          winner ? "text-amber-300" : accent.text
        }`}
      >
        <AnimatedNumber
          value={Number(score)}
          format={(value) => formatElapsed(value)}
        />
        <span className="ml-0.5 text-[9px] font-normal text-zinc-500">s</span>
      </p>
    </div>
  );
}
