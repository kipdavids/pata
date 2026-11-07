"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import HowToPlay from "./HowToPlay";
import SoundToggle from "./SoundToggle";

export default function SiteHeader() {
  const pathname = usePathname();
  const onRanks = pathname?.startsWith("/leaderboard") ?? false;

  const linkClass = (active: boolean) =>
    `rounded-lg px-2.5 py-1.5 text-xs font-semibold transition sm:px-3 ${
      active
        ? "bg-emerald-400/15 text-emerald-300"
        : "text-zinc-400 hover:bg-white/5 hover:text-white"
    }`;

  return (
    <header className="sticky top-0 z-40 pt-[calc(var(--safe-top)+0.5rem)] pb-2">
      <div className="glass flex items-center justify-between gap-2 rounded-2xl px-2.5 py-2 shadow-arena">
        <Link href="/" className="group flex items-center gap-2.5">
          <span className="relative grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-emerald-300 to-emerald-500 text-base font-black text-emerald-950 shadow-[0_0_24px_rgba(52,211,153,0.45)] transition group-hover:scale-105">
            P
            <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-cyan-300 ring-2 ring-[#07070b]" />
          </span>
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
          <SoundToggle />
          <HowToPlay variant="icon" />
        </nav>
      </div>
    </header>
  );
}
