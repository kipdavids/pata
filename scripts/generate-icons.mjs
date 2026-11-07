import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const OUT = path.join(process.cwd(), "public", "icons");
const APP = path.join(process.cwd(), "src", "app");

function iconSvg({ size = 512, maskable = false } = {}) {
  const pad = maskable ? 72 : 0;
  const inner = size - pad * 2;
  const radius = maskable ? 0 : Math.round(size * 0.22);
  const tile = Math.round(inner * 0.24);
  const gap = Math.round(inner * 0.065);
  const total = tile * 3 + gap * 2;
  const start = Math.round((size - total) / 2);
  const step = tile + gap;
  const center = start + step;

  const tiles = [];
  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < 3; col += 1) {
      const x = start + col * step;
      const y = start + row * step;
      const isCenter = row === 1 && col === 1;
      if (isCenter) continue;
      tiles.push(
        `<rect x="${x}" y="${y}" width="${tile}" height="${tile}" rx="${Math.round(tile * 0.26)}" fill="#ffffff" fill-opacity="0.055" stroke="#ffffff" stroke-opacity="0.09" stroke-width="${Math.max(1, size / 320)}"/>`,
      );
    }
  }

  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0d2f26"/>
      <stop offset="0.55" stop-color="#0a0f14"/>
      <stop offset="1" stop-color="#07070b"/>
    </linearGradient>
    <radialGradient id="halo" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="#34d399" stop-opacity="0.6"/>
      <stop offset="1" stop-color="#34d399" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="hot" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#6ee7b7"/>
      <stop offset="1" stop-color="#10b981"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${radius}" fill="url(#bg)"/>
  <circle cx="${size / 2}" cy="${size / 2}" r="${Math.round(inner * 0.42)}" fill="url(#halo)"/>
  ${tiles.join("\n  ")}
  <rect x="${center}" y="${center}" width="${tile}" height="${tile}" rx="${Math.round(tile * 0.26)}" fill="url(#hot)"/>
  <rect x="${center + tile * 0.18}" y="${center + tile * 0.18}" width="${tile * 0.64}" height="${tile * 0.64}" rx="${Math.round(tile * 0.16)}" fill="none" stroke="#ecfdf5" stroke-opacity="0.9" stroke-width="${Math.max(2, size / 128)}"/>
</svg>`;
}

async function render(name, size, options = {}) {
  const svg = iconSvg({ size, ...options });
  await sharp(Buffer.from(svg)).png().toFile(path.join(OUT, name));
  console.log(`wrote public/icons/${name}`);
}

await mkdir(OUT, { recursive: true });
await mkdir(APP, { recursive: true });

await render("icon-192.png", 192);
await render("icon-512.png", 512);
await render("maskable-512.png", 512, { maskable: true });
await render("apple-touch-icon.png", 180);

await sharp(path.join(OUT, "icon-512.png")).toFile(path.join(APP, "icon.png"));
await sharp(path.join(OUT, "apple-touch-icon.png")).toFile(
  path.join(APP, "apple-icon.png"),
);
await writeFile(
  path.join(OUT, "icon.svg"),
  iconSvg({ size: 512 }),
  "utf8",
);

console.log("icons generated");
