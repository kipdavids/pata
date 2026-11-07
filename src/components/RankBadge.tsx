import { rankFor } from "@/lib/gamification";

export default function RankBadge({
  wins,
  showName = true,
  className = "",
}: {
  wins: number;
  showName?: boolean;
  className?: string;
}) {
  const tier = rankFor(wins);

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1 ${tier.badge} ${tier.text} ${className}`}
      title={`${tier.name} · ${wins} ${wins === 1 ? "win" : "wins"}`}
    >
      <span aria-hidden>{tier.emoji}</span>
      {showName ? tier.name : null}
    </span>
  );
}
