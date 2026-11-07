"use client";

import { useEffect, useState } from "react";

const STEPS = [
  {
    emoji: "🎲",
    title: "One board, one target",
    body: "Every match shuffles 1–100 into a shared 10×10 grid. The chooser taps a number.",
  },
  {
    emoji: "⚡",
    title: "The hunt is timed",
    body: "Your opponent races to find that number. Every microsecond they take is added to your score.",
  },
  {
    emoji: "🔄",
    title: "Roles swap",
    body: "Then it is your turn to hunt. Numbers already found lock for both players.",
  },
  {
    emoji: "👑",
    title: "Most points wins",
    body: "After 5, 10 or 20 turns each, the highest score takes it. Ties are draws.",
  },
];

export default function HowToPlay({
  variant = "pill",
  className = "",
}: {
  variant?: "pill" | "link" | "icon";
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open]);

  const trigger =
    variant === "link" ? (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`text-sm font-medium text-emerald-300 transition hover:text-emerald-200 ${className}`}
      >
        How to play →
      </button>
    ) : variant === "icon" ? (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="How to play"
        className={`grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-sm text-zinc-300 transition hover:border-white/20 hover:text-white ${className}`}
      >
        ?
      </button>
    ) : (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-emerald-400/40 hover:text-white ${className}`}
      >
        How to play
      </button>
    );

  return (
    <>
      {trigger}
      {open ? (
        <div
          className="animate-fade-in fixed inset-0 z-[70] flex items-end justify-center bg-black/70 p-3 backdrop-blur-sm sm:items-center sm:p-6"
          onClick={() => setOpen(false)}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="how-to-play-title"
            onClick={(event) => event.stopPropagation()}
            className="animate-slide-up glass-strong w-full max-w-lg rounded-3xl p-5 shadow-arena sm:p-7"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-emerald-400">
                  The rules
                </p>
                <h2
                  id="how-to-play-title"
                  className="font-display mt-1 text-2xl font-bold text-white"
                >
                  How PATA works
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="rounded-xl p-2 text-zinc-400 transition hover:bg-white/5 hover:text-white"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    d="M6 6l12 12M18 6L6 18"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>

            <ol className="mt-5 space-y-3">
              {STEPS.map((step, index) => (
                <li
                  key={step.title}
                  className="flex gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-3"
                  style={{ ["--i" as string]: index }}
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-400/10 text-lg">
                    {step.emoji}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {step.title}
                    </p>
                    <p className="mt-0.5 text-xs leading-relaxed text-zinc-400">
                      {step.body}
                    </p>
                  </div>
                </li>
              ))}
            </ol>

            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-5 w-full rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-bold text-emerald-950 transition hover:bg-emerald-300"
            >
              Got it
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
