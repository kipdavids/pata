"use client";

import { useState } from "react";
import { getSupabase } from "@/lib/supabase/client";

export default function SignInModal({
  open,
  onClose,
  onSignedIn,
}: {
  open: boolean;
  onClose: () => void;
  onSignedIn: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const supabase = getSupabase();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError) throw signInError;
      onSignedIn();
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="animate-fade-in fixed inset-0 z-[70] flex items-end justify-center bg-black/70 p-3 backdrop-blur-sm sm:items-center sm:p-6"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="animate-slide-up glass-strong w-full max-w-sm rounded-3xl p-5 shadow-arena sm:p-6"
      >
        <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-cyan-300">
          Welcome back
        </p>
        <h2 className="font-display mt-1 text-2xl font-bold text-white">
          Sign in
        </h2>
        <p className="mt-1 text-xs text-zinc-400">
          Use the email you linked to your profile.
        </p>

        <div className="mt-4 space-y-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-400/20"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            autoComplete="current-password"
            className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-400/20"
          />
        </div>

        {error ? (
          <div
            role="alert"
            className="mt-3 rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200"
          >
            {error}
          </div>
        ) : null}

        <button
          type="button"
          onClick={submit}
          disabled={busy || !email.trim() || !password}
          className="mt-4 w-full rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-bold text-cyan-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="mt-2 w-full rounded-2xl border border-white/10 px-4 py-2.5 text-xs font-semibold text-zinc-300 transition hover:border-white/20 hover:text-white"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
