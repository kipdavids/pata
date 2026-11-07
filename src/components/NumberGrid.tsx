"use client";

export type GridMode = "choose" | "hunt" | "watch" | "locked";

interface NumberGridProps {
  board: number[];
  usedNumbers: number[];
  targetNumber: number | null;
  mode: GridMode;
  wrongNumber: number | null;
  highlightTarget?: boolean;
  disabled?: boolean;
  onCellClick: (value: number) => void;
}

export default function NumberGrid({
  board,
  usedNumbers,
  targetNumber,
  mode,
  wrongNumber,
  highlightTarget = false,
  disabled = false,
  onCellClick,
}: NumberGridProps) {
  const used = new Set(usedNumbers);
  const interactive = !disabled && (mode === "choose" || mode === "hunt");

  return (
    <div
      className={`grid grid-cols-10 gap-[3px] sm:gap-1.5 ${
        mode === "hunt" ? "grid-hunt" : ""
      }`}
    >
      {board.map((value, index) => {
        const isUsed = used.has(value);
        const isTarget =
          highlightTarget && targetNumber === value && !isUsed;
        const isWrong = wrongNumber === value;
        const canClick = interactive && !isUsed;
        const row = Math.floor(index / 10);

        let classes =
          "cell-enter relative flex aspect-square touch-manipulation select-none items-center justify-center rounded-[7px] text-[10px] font-semibold tabular-nums transition-[transform,background-color,color,box-shadow] duration-150 min-[420px]:text-[11px] sm:rounded-lg sm:text-sm";

        if (isUsed) {
          classes +=
            " cursor-not-allowed bg-black/45 text-zinc-700 line-through opacity-60";
        } else if (isTarget) {
          classes +=
            " scale-[1.06] bg-emerald-400 text-emerald-950 ring-2 ring-emerald-100/90 shadow-[0_0_26px_rgba(52,211,153,0.75)] animate-pulse-glow";
        } else if (isWrong) {
          classes +=
            " animate-shake bg-rose-500/45 text-rose-50 ring-2 ring-rose-400";
        } else if (mode === "hunt") {
          classes += canClick
            ? " cursor-pointer bg-white/[0.055] text-zinc-100 ring-1 ring-inset ring-white/[0.04] hover:-translate-y-0.5 hover:bg-cyan-400/25 hover:text-white hover:ring-cyan-300/40 active:translate-y-0 active:scale-95"
            : " bg-white/[0.03] text-zinc-400";
        } else if (mode === "choose") {
          classes += canClick
            ? " cursor-pointer bg-white/[0.055] text-zinc-100 ring-1 ring-inset ring-white/[0.04] hover:-translate-y-0.5 hover:bg-emerald-400/25 hover:text-white hover:ring-emerald-300/40 active:translate-y-0 active:scale-95"
            : " bg-white/[0.03] text-zinc-400";
        } else {
          classes += " bg-white/[0.03] text-zinc-400";
        }

        return (
          <button
            key={value}
            type="button"
            disabled={!canClick}
            onClick={() => onCellClick(value)}
            aria-label={`Number ${value}${isUsed ? " (found)" : ""}`}
            style={{ ["--row" as string]: row }}
            className={classes}
          >
            {value}
            {isUsed ? (
              <span
                aria-hidden
                className="absolute inset-0 grid place-items-center text-[9px] text-emerald-500/50"
              >
                ✓
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
