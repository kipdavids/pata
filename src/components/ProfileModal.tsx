"use client";

import { useEffect, useRef, useState } from "react";
import { getSupabase } from "@/lib/supabase/client";
import { api } from "@/lib/client/api";

export default function ProfileModal({
  open,
  onClose,
  userId,
  initialName,
  initialAvatar,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  userId: string | null;
  initialName: string;
  initialAvatar: string | null;
  onSaved: (name: string, avatar: string | null) => void;
}) {
  const [name, setName] = useState(initialName);
  const [avatar, setAvatar] = useState<string | null>(initialAvatar);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Link-account fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [linking, setLinking] = useState(false);
  const [linkMessage, setLinkMessage] = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => {
      setName(initialName);
      setAvatar(initialAvatar);
      setError(null);
      setSuccess(null);
      setLinkMessage(null);
    }, 0);
    return () => window.clearTimeout(id);
  }, [open, initialName, initialAvatar]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  async function handleFile(file: File) {
    if (!userId) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError("Image must be under 2 MB.");
      return;
    }

    setUploading(true);
    setError(null);
    try {
      const supabase = getSupabase();
      const ext = (file.name.split(".").pop() || "png").toLowerCase();
      const path = `${userId}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      setAvatar(data.publicUrl);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Upload failed.",
      );
    } finally {
      setUploading(false);
    }
  }

  async function saveProfile() {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const payload = await api<{ profile: { display_name: string; avatar_url: string | null } }>(
        "/api/profile",
        {
          method: "PUT",
          body: { displayName: name, avatarUrl: avatar },
        },
      );
      onSaved(payload.profile.display_name, payload.profile.avatar_url);
      setSuccess("Profile saved.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function linkAccount() {
    setLinking(true);
    setLinkMessage(null);
    setError(null);
    try {
      const supabase = getSupabase();
      const { error: updateError } = await supabase.auth.updateUser({
        email: email.trim(),
        password,
      });
      if (updateError) throw updateError;
      setLinkMessage(
        "Check your email to confirm. Once confirmed, you can sign in from any device.",
      );
      setEmail("");
      setPassword("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Link failed.");
    } finally {
      setLinking(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="animate-fade-in fixed inset-0 z-[70] flex items-end justify-center bg-black/70 p-3 backdrop-blur-sm sm:items-center sm:p-6"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-title"
        onClick={(e) => e.stopPropagation()}
        className="animate-slide-up glass-strong w-full max-w-md rounded-3xl p-5 shadow-arena sm:p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-emerald-400">
              Your profile
            </p>
            <h2
              id="profile-title"
              className="font-display mt-1 text-2xl font-bold text-white"
            >
              Keep your name & avatar
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
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

        <div className="mt-5 flex items-center gap-4">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="group relative grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] transition hover:border-emerald-400/40"
            aria-label="Upload avatar"
          >
            {avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatar}
                alt="Avatar"
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-2xl font-black text-zinc-400">
                {name.charAt(0).toUpperCase() || "?"}
              </span>
            )}
            <span className="absolute inset-0 grid place-items-center bg-black/40 text-[10px] font-bold uppercase tracking-wider text-white opacity-0 transition group-hover:opacity-100">
              {uploading ? "…" : "Edit"}
            </span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
              e.target.value = "";
            }}
          />
          <div className="min-w-0 flex-1">
            <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
              Display name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={24}
              className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none transition focus:border-emerald-400/60 focus:ring-2 focus:ring-emerald-400/20"
            />
            <p className="mt-1 text-[10px] text-zinc-500">
              Shown on the leaderboard and in matches.
            </p>
          </div>
        </div>

        {error ? (
          <div
            role="alert"
            className="mt-4 rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200"
          >
            {error}
          </div>
        ) : null}
        {success ? (
          <div className="mt-4 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
            {success}
          </div>
        ) : null}

        <button
          type="button"
          onClick={saveProfile}
          disabled={saving || uploading}
          className="mt-4 w-full rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-bold text-emerald-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save profile"}
        </button>

        <div className="mt-6 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-cyan-300">
            Keep your account
          </p>
          <p className="mt-1 text-xs leading-relaxed text-zinc-400">
            Link an email and password so you can sign in on any device and keep
            your name, avatar and scores.
          </p>
          <div className="mt-3 space-y-2">
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
              placeholder="Password (min 6 chars)"
              autoComplete="new-password"
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-400/20"
            />
            <button
              type="button"
              onClick={linkAccount}
              disabled={linking || !email.trim() || password.length < 6}
              className="w-full rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-2.5 text-xs font-bold text-cyan-200 transition hover:bg-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {linking ? "Linking…" : "Link email & password"}
            </button>
            {linkMessage ? (
              <p className="text-[11px] leading-snug text-emerald-300">
                {linkMessage}
              </p>
            ) : null}
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full rounded-2xl border border-white/10 px-4 py-2.5 text-xs font-semibold text-zinc-300 transition hover:border-white/20 hover:text-white"
        >
          Close
        </button>
      </div>
    </div>
  );
}
