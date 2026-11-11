"use client";

import { useId } from "react";

/**
 * The PATA mark: a 3×3 board with the target tile lit up, ringed by a
 * reticle. Same geometry as the favicon and app icons, so the brand stays
 * consistent from 16px to the app store.
 */
export default function LogoMark({
  className = "",
  reticle = false,
  plate = true,
  title,
}: {
  className?: string;
  reticle?: boolean;
  plate?: boolean;
  title?: string;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const bgId = `pata-bg-${uid}`;
  const haloId = `pata-halo-${uid}`;
  const hotId = `pata-hot-${uid}`;

  // Board geometry, in the 64-unit viewBox.
  const size = 64;
  const board = size * 0.76;
  const tile = board * 0.28;
  const gap = board * 0.058;
  const step = tile + gap;
  const total = tile * 3 + gap * 2;
  const start = (size - total) / 2;
  const center = start + step;

  const bracket = tile * 0.32;
  const pad = gap * 0.42;
  const x0 = center - pad;
  const y0 = center - pad;
  const x1 = center + tile + pad;
  const y1 = center + tile + pad;

  // Without the plate the mark sits straight on the dark UI, so the tiles and
  // the ring need heavier strokes to stay visible at 36px.
  const tileStroke = plate ? 0.22 : 0.75;
  const ringStroke = plate ? 0.42 : 1.15;
  const reticleStroke = plate ? 0.42 : 0.8;

  const tiles = [];
  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < 3; col += 1) {
      if (row === 1 && col === 1) continue;
      tiles.push(
        <rect
          key={`${row}-${col}`}
          x={start + col * step}
          y={start + row * step}
          width={tile}
          height={tile}
          rx={tile * 0.26}
          fill={
            plate ? "rgba(255,255,255,0.055)" : "rgba(255,255,255,0.02)"
          }
          stroke={
            plate ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.28)"
          }
          strokeWidth={tileStroke}
        />,
      );
    }
  }

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className={className}
      role={title ? "img" : "presentation"}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={bgId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#0d2f26" />
          <stop offset="0.55" stopColor="#0a1014" />
          <stop offset="1" stopColor="#07070b" />
        </linearGradient>
        <radialGradient id={haloId} cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#34d399" stopOpacity="0.42" />
          <stop offset="1" stopColor="#34d399" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={hotId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6ee7b7" />
          <stop offset="0.5" stopColor="#34d399" />
          <stop offset="1" stopColor="#22d3ee" />
        </linearGradient>
      </defs>

      {plate ? (
        <>
          <rect
            width={size}
            height={size}
            rx={size * 0.22}
            fill={`url(#${bgId})`}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={board * 0.62}
            fill={`url(#${haloId})`}
          />
        </>
      ) : null}
      {tiles}

      {reticle ? (
        <g
          fill="none"
          stroke="#34d399"
          strokeWidth={reticleStroke}
          strokeLinecap="round"
          strokeOpacity={0.85}
        >
          <path d={`M${x0} ${y0 + bracket}V${y0}H${x0 + bracket}`} />
          <path d={`M${x1 - bracket} ${y0}H${x1}V${y0 + bracket}`} />
          <path d={`M${x1} ${y1 - bracket}V${y1}H${x1 - bracket}`} />
          <path d={`M${x0 + bracket} ${y1}H${x0}V${y1 - bracket}`} />
        </g>
      ) : null}

      <rect
        x={center}
        y={center}
        width={tile}
        height={tile}
        rx={tile * 0.26}
        fill={`url(#${hotId})`}
      />
      <rect
        x={center + tile * 0.17}
        y={center + tile * 0.17}
        width={tile * 0.66}
        height={tile * 0.66}
        rx={tile * 0.17}
        fill="none"
        stroke="#ecfdf5"
        strokeOpacity={0.92}
        strokeWidth={ringStroke}
      />
    </svg>
  );
}
