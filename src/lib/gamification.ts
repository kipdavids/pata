export interface RankTier {
  key: string;
  name: string;
  emoji: string;
  minWins: number;
  /** Tailwind text colour for the tier name. */
  text: string;
  /** Tailwind background + ring for the badge. */
  badge: string;
  /** Glow colour used in shadows. */
  glow: string;
}

export const RANKS: RankTier[] = [
  {
    key: "rookie",
    name: "Rookie",
    emoji: "🌱",
    minWins: 0,
    text: "text-zinc-300",
    badge: "bg-zinc-500/15 ring-zinc-400/25",
    glow: "rgba(161,161,170,0.35)",
  },
  {
    key: "hunter",
    name: "Hunter",
    emoji: "🎯",
    minWins: 1,
    text: "text-emerald-300",
    badge: "bg-emerald-500/15 ring-emerald-400/30",
    glow: "rgba(52,211,153,0.45)",
  },
  {
    key: "tracker",
    name: "Tracker",
    emoji: "🧭",
    minWins: 3,
    text: "text-cyan-300",
    badge: "bg-cyan-500/15 ring-cyan-400/30",
    glow: "rgba(34,211,238,0.45)",
  },
  {
    key: "sharpshooter",
    name: "Sharpshooter",
    emoji: "🏹",
    minWins: 6,
    text: "text-violet-300",
    badge: "bg-violet-500/15 ring-violet-400/30",
    glow: "rgba(167,139,250,0.45)",
  },
  {
    key: "sniper",
    name: "Sniper",
    emoji: "🔭",
    minWins: 11,
    text: "text-amber-300",
    badge: "bg-amber-500/15 ring-amber-400/30",
    glow: "rgba(251,191,36,0.45)",
  },
  {
    key: "legend",
    name: "Legend",
    emoji: "👑",
    minWins: 20,
    text: "text-rose-300",
    badge: "bg-rose-500/15 ring-rose-400/30",
    glow: "rgba(251,113,133,0.5)",
  },
];

export function rankFor(wins: number): RankTier {
  const safe = Math.max(0, Number(wins) || 0);
  let current = RANKS[0];
  for (const tier of RANKS) {
    if (safe >= tier.minWins) current = tier;
  }
  return current;
}

export function nextRankFor(wins: number): RankTier | null {
  const safe = Math.max(0, Number(wins) || 0);
  return RANKS.find((tier) => tier.minWins > safe) ?? null;
}

/** Progress (0–100) from the current tier floor to the next tier. */
export function rankProgress(wins: number): number {
  const safe = Math.max(0, Number(wins) || 0);
  const current = rankFor(safe);
  const next = nextRankFor(safe);
  if (!next) return 100;
  const span = next.minWins - current.minWins;
  if (span <= 0) return 100;
  const into = safe - current.minWins;
  return Math.max(4, Math.min(100, Math.round((into / span) * 100)));
}

/** A light, deterministic experience score used for level flavour. */
export function xpFor(row: {
  wins: number;
  draws: number;
  matches_played: number;
  total_points: number;
}): number {
  const wins = Number(row.wins) || 0;
  const draws = Number(row.draws) || 0;
  const played = Number(row.matches_played) || 0;
  const points = Number(row.total_points) || 0;
  return Math.max(
    0,
    Math.round(wins * 120 + draws * 45 + played * 15 + points / 1_000_000),
  );
}

export function levelFor(xp: number): number {
  return Math.max(1, Math.floor(Math.sqrt(Math.max(0, xp) / 60)) + 1);
}

export function winRate(wins: number, played: number): number {
  const games = Number(played) || 0;
  if (games <= 0) return 0;
  return Math.round((Number(wins) || 0) / games * 100);
}
