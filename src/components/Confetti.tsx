"use client";

import { useEffect, useRef } from "react";

const COLORS = ["#34d399", "#22d3ee", "#fbbf24", "#a78bfa", "#fb7185", "#f4f4f5"];

export default function Confetti({ active }: { active: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const width = window.innerWidth;
    const height = window.innerHeight;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const particles = Array.from({ length: 150 }, (_, index) => ({
      x: width / 2 + (Math.random() - 0.5) * width * 0.7,
      y: height * 0.32 + (Math.random() - 0.5) * 80,
      vx: (Math.random() - 0.5) * 10,
      vy: -Math.random() * 11 - 3,
      size: 4 + Math.random() * 7,
      color: COLORS[index % COLORS.length],
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.35,
    }));

    let frame = 0;
    const started = performance.now();

    const tick = (now: number) => {
      const elapsed = now - started;
      ctx.clearRect(0, 0, width, height);
      const alpha = Math.max(0, 1 - elapsed / 3200);
      for (const particle of particles) {
        particle.vy += 0.3;
        particle.vx *= 0.995;
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.rot += particle.vr;
        ctx.save();
        ctx.translate(particle.x, particle.y);
        ctx.rotate(particle.rot);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = particle.color;
        ctx.fillRect(
          -particle.size / 2,
          -particle.size / 2,
          particle.size,
          particle.size * 0.62,
        );
        ctx.restore();
      }
      if (elapsed < 3400) {
        frame = requestAnimationFrame(tick);
      } else {
        ctx.clearRect(0, 0, width, height);
      }
    };

    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      ctx.clearRect(0, 0, width, height);
    };
  }, [active]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[60]"
    />
  );
}
