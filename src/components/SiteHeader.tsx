"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import HowToPlay from "./HowToPlay";
import LogoMark from "./LogoMark";
import ProfileModal from "./ProfileModal";
import SoundToggle from "./SoundToggle";
import { ensureSession } from "@/lib/client/api";

const NAME_KEY = "pata:displayName";

export default function SiteHeader() {
  const pathname = usePathname();
  const onRanks = pathname?.startsWith("/leaderboard") ?? false;

  const [profileOpen, setProfileOpen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const session = await ensureSession();
        if (cancelled) return;
        setUserId(session.user.id);
        const saved = localStorage.getItem(NAME_KEY) ?? "";
        if (!cancelled) setDisplayName(saved);

        const response = await fetch("/api/profile", {
          headers: { Authorization: `Bearer ${session.access_token}` },
          cache: "no-store",
        });
        if (response.ok) {
          const payload = (await response.json()) as {
            profile?: { display_name?: string; avatar_url?: string | null };
          };
          if (cancelled) return;
          if (payload.profile?.display_name) {
            setDisplayName(payload.profile.display_name);
            localStorage.setItem(NAME_KEY, payload.profile.display_name);
          }
          setAvatar(payload.profile?.avatar_url ?? null);
        }
      } catch {
        // Profile is optional; header still works.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const linkClass = (active: boolean) =>
    `rounded-lg px-2.5 py-1.5 text-xs font-semibold transition sm:px-3 ${
      active
        ? "bg-emerald-400/15 text-emerald-300"
        : "text-zinc-400 hover:bg-white/5 hover:text-white"
    }`;

  const initial = displayName.trim().charAt(0).toUpperCase() || "?";

  return (
    <>
      <header className="sticky top-0 z-40 pt-[calc(var(--safe-top)+0.5rem)] pb-2">
        <div className="glass flex items-center justify-between gap-2 rounded-2xl px-2.5 py-2 shadow-arena">
          <Link href="/" className="group flex items-center gap-2.5">
            <LogoMark
              plate={false}
              className="h-9 w-9 shrink-0 drop-shadow-[0_0_8px_rgba(52,211,153,0.45)] transition group-hover:scale-105"
              title="PATA"
            />
            <span className="font-display text-sm font-bold tracking-[0.32em] text-white">
              PATA
            </span>
          </Link>

          <nav className="flex items-center gap-1 sm:gap-1.5">
            <Link href="/" className={linkClass(!onRanks)}>
              Play
            </Link>
            <Link href="/leaderboard" className={linkClass(onRanks)}>
              Ranks
            </Link>
            <button
              type="button"
              onClick={() => setProfileOpen(true)}
              aria-label="Open profile"
              className="grid h-9 w-9 place-items-center overflow-hidden rounded-xl border border-white/10 bg-white/[0.04] text-sm text-zinc-300 transition hover:border-white/20 hover:text-white"
            >
              {avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatar}
                  alt="Profile"
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-xs font-bold">{initial}</span>
              )}
            </button>
            <SoundToggle />
            <HowToPlay variant="icon" />
          </nav>
        </div>
      </header>

      <ProfileModal
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        userId={userId}
        initialName={displayName}
        initialAvatar={avatar}
        onSaved={(name, av) => {
          setDisplayName(name);
          setAvatar(av);
          localStorage.setItem(NAME_KEY, name);
        }}
      />
    </>
  );
}
