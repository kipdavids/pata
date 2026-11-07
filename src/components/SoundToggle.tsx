"use client";

import { useEffect, useState } from "react";
import { isMuted, playSound, toggleMuted } from "@/lib/sound";

export default function SoundToggle({ className = "" }: { className?: string }) {
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => setMuted(isMuted()), 0);
    return () => window.clearTimeout(id);
  }, []);

  function toggle() {
    const next = toggleMuted();
    setMuted(next);
    if (!next) playSound("tap");
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={muted ? "Enable sound" : "Mute sound"}
      aria-pressed={muted}
      title={muted ? "Sound off" : "Sound on"}
      className={`grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-zinc-300 transition hover:border-white/20 hover:text-white ${className}`}
    >
      {muted ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M11 5 6.5 9H3v6h3.5L11 19V5Z"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
          <path
            d="M16 9l5 6M21 9l-5 6"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M11 5 6.5 9H3v6h3.5L11 19V5Z"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
          <path
            d="M15.5 8.5a5 5 0 0 1 0 7M18.5 6a9 9 0 0 1 0 12"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        </svg>
      )}
    </button>
  );
}
