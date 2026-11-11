import Link from "next/link";
import LogoMark from "@/components/LogoMark";

export const metadata = {
  title: "Offline",
};

export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
      <LogoMark className="h-20 w-20 rounded-3xl shadow-[0_0_40px_rgba(52,211,153,0.25)]" title="PATA" />
      <div className="space-y-2">
        <h1 className="font-display text-2xl font-bold text-white">
          You&apos;re offline
        </h1>
        <p className="text-sm leading-relaxed text-zinc-400">
          PATA needs a connection to reach the arena. Reconnect and jump back
          in — your match will still be there.
        </p>
      </div>
      <Link
        href="/"
        className="rounded-2xl bg-emerald-400 px-6 py-3 text-sm font-bold text-emerald-950 transition hover:bg-emerald-300"
      >
        Try again
      </Link>
    </main>
  );
}
