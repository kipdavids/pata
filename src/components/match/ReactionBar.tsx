"use client";

const REACTIONS = ["⚡", "🔥", "😂", "😱", "👏", "🐌"];

export default function ReactionBar({
  onReact,
  disabled = false,
}: {
  onReact: (emoji: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-center gap-1.5">
      {REACTIONS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          disabled={disabled}
          onClick={() => onReact(emoji)}
          aria-label={`Send ${emoji} reaction`}
          className="grid h-9 w-9 place-items-center rounded-full border border-white/[0.08] bg-white/[0.03] text-base transition hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.08] active:translate-y-0 active:scale-90 disabled:opacity-40"
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}
