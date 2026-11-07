import Link from "next/link";

export const metadata = {
  title: "Offline",
};

export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="grid h-20 w-20 place-items-center rounded-3xl bg-white/[0.05] text-4xl ring-1 ring-white/10">
        📡
      </div>
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
