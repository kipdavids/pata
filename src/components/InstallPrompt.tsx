"use client";

import { useEffect, useState } from "react";
import LogoMark from "./LogoMark";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "pata:install-dismissed";

export default function InstallPrompt() {
  const [mode, setMode] = useState<"none" | "android" | "ios">("none");
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null,
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(DISMISS_KEY) === "1") return;

    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone ===
        true;
    if (standalone) return;

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
      setMode("android");
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    const ua = window.navigator.userAgent;
    const isIos =
      /iPad|iPhone|iPod/.test(ua) ||
      (ua.includes("Macintosh") && "ontouchend" in window);
    const isSafari =
      /Safari/.test(ua) && !/Chrome|CriOS|FxiOS|EdgiOS/.test(ua);

    let timer: number | undefined;
    if (isIos && isSafari) {
      timer = window.setTimeout(() => setMode("ios"), 1800);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  function dismiss() {
    setMode("none");
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // ignore storage failures
    }
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === "accepted") setMode("none");
  }

  if (mode === "none") return null;

  return (
    <div className="animate-slide-up fixed inset-x-3 bottom-[calc(var(--safe-bottom)+0.75rem)] z-50 mx-auto max-w-md">
      <div className="glass-strong flex items-center gap-3 rounded-2xl p-3 shadow-arena">
        <LogoMark plate={false} className="h-11 w-11 shrink-0" title="PATA" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white">Install PATA</p>
          <p className="text-xs leading-snug text-zinc-400">
            {mode === "ios"
              ? "Tap Share, then “Add to Home Screen”."
              : "Full-screen, faster, one tap away."}
          </p>
        </div>
        {mode === "android" ? (
          <button
            type="button"
            onClick={install}
            className="shrink-0 rounded-xl bg-emerald-400 px-3.5 py-2 text-xs font-bold text-emerald-950 transition hover:bg-emerald-300"
          >
            Install
          </button>
        ) : null}
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss install prompt"
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
  );
}
