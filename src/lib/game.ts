export const GRID_SIZE = 100;

export const TURN_OPTIONS = [5, 10, 20] as const;
export type TurnOption = (typeof TURN_OPTIONS)[number];

export function isTurnOption(value: unknown): value is TurnOption {
  return value === 5 || value === 10 || value === 20;
}

/**
 * Convert a Postgres timestamptz (which may carry microseconds) into epoch ms.
 * JS `Date.parse` only guarantees millisecond precision, so trim extra digits.
 */
export function toMillis(iso: string | null | undefined): number {
  if (!iso) return 0;
  return Date.parse(iso.replace(/(\.\d{3})\d+/, "$1"));
}

/** Microseconds → seconds, always shown with microsecond precision. */
export function formatMicros(us: number | string | null | undefined): string {
  const value = Number(us ?? 0);
  if (!Number.isFinite(value) || value <= 0) return "0.000000";
  return (value / 1_000_000).toFixed(6);
}

/** Format an elapsed microsecond value as a live seconds string. */
export function formatElapsed(us: number): string {
  return formatMicros(Math.max(0, us));
}

export function formatCompactMicros(us: number | string | null | undefined): string {
  const value = Number(us ?? 0);
  if (!Number.isFinite(value) || value <= 0) return "0";
  const seconds = value / 1_000_000;
  if (seconds >= 1000) return seconds.toFixed(0);
  if (seconds >= 100) return seconds.toFixed(1);
  return seconds.toFixed(3);
}
