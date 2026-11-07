"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Animates a numeric value between renders. The formatter receives the
 * interpolated number, so callers can decide the precision.
 */
export default function AnimatedNumber({
  value,
  format,
  className,
  duration = 700,
}: {
  value: number;
  format: (value: number) => string;
  className?: string;
  duration?: number;
}) {
  const [display, setDisplay] = useState(value);
  const currentRef = useRef(value);

  useEffect(() => {
    const from = currentRef.current;
    const to = Number(value) || 0;
    if (from === to) return;

    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      currentRef.current = to;
      const id = window.setTimeout(() => setDisplay(to), 0);
      return () => window.clearTimeout(id);
    }

    let frame = 0;
    const started = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - started) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const next = from + (to - from) * eased;
      currentRef.current = next;
      setDisplay(next);
      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        currentRef.current = to;
      }
    };
    frame = requestAnimationFrame(tick);

    // Background tabs throttle requestAnimationFrame. Make sure the final
    // value still lands so a score never appears stuck at an old number.
    const settle = window.setTimeout(() => {
      currentRef.current = to;
      setDisplay(to);
    }, duration + 150);

    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(settle);
    };
  }, [value, duration]);

  return <span className={className}>{format(display)}</span>;
}
