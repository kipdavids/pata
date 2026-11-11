import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const OUT = path.join(process.cwd(), "public", "icons");
const BRAND = path.join(process.cwd(), "public", "brand");
const APP = path.join(process.cwd(), "src", "app");

/**
 * PATA mark: a 3x3 number board with the target tile lit up, ringed by a
 * reticle. The whole idea of the game lives in the mark — the board, and the
 * one number someone is hunting for.
 */
function logoSvg({
  size = 512,
  maskable = false,
  transparent = false,
  light = false,
  radius,
  reticle = true,
} = {}) {
  const s = size;
  const small = s < 96;
  const bgRadius = radius ?? (maskable ? 0 : Math.round(s * 0.22));

  // Small icons get a tighter board so the lit tile stays readable at 16px.
  // Maskable icons leave room for Android's crop.
  const scale = small ? 0.9 : maskable ? 0.68 : 0.76;
  const board = s * scale;
  const tile = board * 0.28;
  const gap = board * 0.058;
  const step = tile + gap;
  const total = tile * 3 + gap * 2;
  const start = (s - total) / 2;
  const center = start + step;

  const line = small ? 1 : Math.max(1, s / 300);
  const ringWidth = Math.max(1.5, s / 96);
  const reticleWidth = Math.max(1.25, s / 150);
  const showReticle = reticle && s >= 64;

  const emptyFill = light
    ? small
      ? "rgba(7,7,11,0.10)"
      : "rgba(7,7,11,0.055)"
    : small
      ? "rgba(255,255,255,0.11)"
      : "rgba(255,255,255,0.055)";
  const emptyStroke = light
    ? small
      ? "rgba(7,7,11,0.18)"
      : "rgba(7,7,11,0.10)"
    : small
      ? "rgba(255,255,255,0.16)"
      : "rgba(255,255,255,0.09)";
  const ringColor = light ? "#ffffff" : "#ecfdf5";

  const tiles = [];
  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < 3; col += 1) {
      if (row === 1 && col === 1) continue;
      tiles.push(
        `<rect x="${(start + col * step).toFixed(2)}" y="${(start + row * step).toFixed(2)}" width="${tile.toFixed(2)}" height="${tile.toFixed(2)}" rx="${(tile * 0.26).toFixed(2)}" fill="${emptyFill}" stroke="${emptyStroke}" stroke-width="${line.toFixed(2)}"/>`,
      );
    }
  }

  // Four corner brackets in the gutter around the lit tile: the "found it"
  // moment. Kept thin so 16–32px favicons stay legible.
  const bracket = tile * 0.32;
  const pad = gap * 0.42;
  const x0 = center - pad;
  const y0 = center - pad;
  const x1 = center + tile + pad;
  const y1 = center + tile + pad;
  const reticleGroup = showReticle
    ? `<g fill="none" stroke="#34d399" stroke-width="${reticleWidth.toFixed(2)}" stroke-linecap="round" stroke-opacity="${light ? 0.9 : 0.85}">
    <path d="M${x0} ${y0 + bracket}V${y0}H${x0 + bracket}"/>
    <path d="M${x1 - bracket} ${y0}H${x1}V${y0 + bracket}"/>
    <path d="M${x1} ${y1 - bracket}V${y1}H${x1 - bracket}"/>
    <path d="M${x0 + bracket} ${y1}H${x0}V${y1 - bracket}"/>
  </g>`
    : "";

  const background = transparent
    ? ""
    : `<rect width="${s}" height="${s}" rx="${bgRadius}" fill="url(#bg)"/>
  <circle cx="${s / 2}" cy="${s / 2}" r="${(board * 0.62).toFixed(2)}" fill="url(#halo)"/>`;

  return `<svg width="${s}" height="${s}" viewBox="0 0 ${s} ${s}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0d2f26"/>
      <stop offset="0.55" stop-color="#0a1014"/>
      <stop offset="1" stop-color="#07070b"/>
    </linearGradient>
    <radialGradient id="halo" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="#34d399" stop-opacity="0.42"/>
      <stop offset="1" stop-color="#34d399" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="hot" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#6ee7b7"/>
      <stop offset="0.5" stop-color="#34d399"/>
      <stop offset="1" stop-color="#22d3ee"/>
    </linearGradient>
  </defs>
  ${background}
  ${tiles.join("\n  ")}
  ${reticleGroup}
  <rect x="${center.toFixed(2)}" y="${center.toFixed(2)}" width="${tile.toFixed(2)}" height="${tile.toFixed(2)}" rx="${(tile * 0.26).toFixed(2)}" fill="url(#hot)"/>
  <rect x="${(center + tile * 0.17).toFixed(2)}" y="${(center + tile * 0.17).toFixed(2)}" width="${(tile * 0.66).toFixed(2)}" height="${(tile * 0.66).toFixed(2)}" rx="${(tile * 0.17).toFixed(2)}" fill="none" stroke="${ringColor}" stroke-opacity="0.92" stroke-width="${ringWidth.toFixed(2)}"/>
</svg>`;
}

async function png({ size, ...opts }, target) {
  await mkdir(path.dirname(target), { recursive: true });
  await sharp(Buffer.from(logoSvg({ size, ...opts })), { density: 384 })
    .png({ compressionLevel: 9, effort: 10 })
    .toFile(target);
  console.log(`wrote ${path.relative(process.cwd(), target)}`);
}

/** Build a multi-resolution .ico with PNG-compressed entries. */
async function ico(sizes, target) {
  const images = await Promise.all(
    sizes.map((size) =>
      sharp(Buffer.from(logoSvg({ size, reticle: false })))
        .resize(size, size)
        .png()
        .toBuffer(),
    ),
  );

  const header = Buffer.alloc(6 + images.length * 16);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(images.length, 4); // image count

  let offset = header.length;
  images.forEach((buffer, index) => {
    const entry = 6 + index * 16;
    const size = sizes[index];
    header.writeUInt8(size >= 256 ? 0 : size, entry); // width
    header.writeUInt8(size >= 256 ? 0 : size, entry + 1); // height
    header.writeUInt8(0, entry + 2); // palette size
    header.writeUInt8(0, entry + 3); // reserved
    header.writeUInt16LE(1, entry + 4); // color planes
    header.writeUInt16LE(32, entry + 6); // bits per pixel
    header.writeUInt32LE(buffer.length, entry + 8); // size in bytes
    header.writeUInt32LE(offset, entry + 12); // offset
    offset += buffer.length;
  });

  await writeFile(target, Buffer.concat([header, ...images]));
  console.log(`wrote ${path.relative(process.cwd(), target)}`);
}

await mkdir(OUT, { recursive: true });
await mkdir(BRAND, { recursive: true });

// --- App icons ---------------------------------------------------------
await png({ size: 192 }, path.join(OUT, "icon-192.png"));
await png({ size: 512 }, path.join(OUT, "icon-512.png"));
await png({ size: 512, maskable: true }, path.join(OUT, "maskable-512.png"));
await png({ size: 180 }, path.join(OUT, "apple-touch-icon.png"));
await png({ size: 32 }, path.join(OUT, "favicon-32.png"));

await writeFile(path.join(OUT, "icon.svg"), logoSvg({ size: 512 }), "utf8");
console.log("wrote public/icons/icon.svg");

// Next.js file conventions: app icon + apple icon + favicon.
await writeFile(path.join(APP, "icon.png"), await sharp(path.join(OUT, "icon-512.png")).toBuffer());
await writeFile(
  path.join(APP, "apple-icon.png"),
  await sharp(path.join(OUT, "apple-touch-icon.png")).toBuffer(),
);
await ico([16, 32, 48, 64], path.join(APP, "favicon.ico"));

// --- Brand assets for stores, Product Hunt, socials ---------------------
// Square, full-bleed dark: upload this as the Product Hunt thumbnail.
await png({ size: 1024, radius: 0 }, path.join(BRAND, "pata-logo-1024.png"));
await png({ size: 512, radius: 0 }, path.join(BRAND, "pata-logo-512.png"));
// Transparent mark that sits on light backgrounds.
await png(
  { size: 1024, transparent: true, light: true },
  path.join(BRAND, "pata-mark-light-1024.png"),
);
// Transparent mark for dark backgrounds.
await png(
  { size: 1024, transparent: true },
  path.join(BRAND, "pata-mark-dark-1024.png"),
);
await writeFile(path.join(BRAND, "pata-logo.svg"), logoSvg({ size: 512 }), "utf8");
console.log("wrote public/brand/pata-logo.svg");

console.log("icons generated");
