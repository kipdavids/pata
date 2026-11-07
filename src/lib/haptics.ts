"use client";

type Pattern = number | number[];

export const HAPTIC: Record<string, Pattern> = {
  tap: 8,
  select: 12,
  found: [10, 35, 16],
  wrong: [28, 40, 28],
  win: [18, 55, 18, 55, 70],
  turn: [9, 45, 9],
  join: [12, 30, 12],
};

export function vibrate(pattern: Pattern): void {
  if (typeof navigator === "undefined") return;
  try {
    if (typeof navigator.vibrate === "function") {
      navigator.vibrate(pattern);
    }
  } catch {
    // Haptics are optional.
  }
}
