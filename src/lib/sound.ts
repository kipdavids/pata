"use client";

export type SoundName =
  | "tap"
  | "select"
  | "found"
  | "wrong"
  | "win"
  | "turn"
  | "join";

type Note = [freq: number, offset: number, duration: number, type: OscillatorType, gain: number];

const MUTE_KEY = "pata:muted";
const PRESETS: Record<SoundName, Note[]> = {
  tap: [[660, 0, 0.06, "sine", 0.05]],
  select: [
    [440, 0, 0.12, "sine", 0.06],
    [660, 0.08, 0.16, "sine", 0.05],
  ],
  found: [
    [660, 0, 0.1, "triangle", 0.07],
    [880, 0.09, 0.1, "triangle", 0.06],
    [1320, 0.18, 0.2, "triangle", 0.05],
  ],
  wrong: [
    [200, 0, 0.14, "square", 0.05],
    [150, 0.1, 0.18, "square", 0.04],
  ],
  win: [
    [523, 0, 0.16, "triangle", 0.07],
    [659, 0.12, 0.16, "triangle", 0.07],
    [784, 0.24, 0.16, "triangle", 0.06],
    [1046, 0.36, 0.45, "triangle", 0.06],
  ],
  turn: [
    [880, 0, 0.1, "sine", 0.05],
    [1174, 0.09, 0.16, "sine", 0.045],
  ],
  join: [
    [392, 0, 0.12, "sine", 0.05],
    [523, 0.1, 0.12, "sine", 0.05],
    [659, 0.2, 0.2, "sine", 0.045],
  ],
};

let context: AudioContext | null = null;
let muted: boolean | null = null;

function loadMuted(): boolean {
  if (muted !== null) return muted;
  if (typeof window === "undefined") return false;
  muted = window.localStorage.getItem(MUTE_KEY) === "1";
  return muted;
}

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (context) return context;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return null;
  try {
    context = new Ctor();
  } catch {
    context = null;
  }
  return context;
}

export function isMuted(): boolean {
  return loadMuted();
}

export function setMuted(next: boolean): void {
  muted = next;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(MUTE_KEY, next ? "1" : "0");
  }
}

export function toggleMuted(): boolean {
  const next = !loadMuted();
  setMuted(next);
  return next;
}

export function playSound(name: SoundName): void {
  if (loadMuted()) return;
  const ctx = getContext();
  if (!ctx) return;

  if (ctx.state === "suspended") {
    void ctx.resume().catch(() => {});
  }

  const now = ctx.currentTime + 0.01;
  for (const [freq, offset, duration, type, gain] of PRESETS[name]) {
    try {
      const osc = ctx.createOscillator();
      const envelope = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now + offset);
      envelope.gain.setValueAtTime(0.0001, now + offset);
      envelope.gain.exponentialRampToValueAtTime(gain, now + offset + 0.012);
      envelope.gain.exponentialRampToValueAtTime(
        0.0001,
        now + offset + duration,
      );
      osc.connect(envelope);
      envelope.connect(ctx.destination);
      osc.start(now + offset);
      osc.stop(now + offset + duration + 0.03);
    } catch {
      // Audio is a nicety; never break the game over it.
    }
  }
}
