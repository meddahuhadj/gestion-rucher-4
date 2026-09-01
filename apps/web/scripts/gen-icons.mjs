// Génère les icônes PWA (PNG) + favicon.ico à partir d'un tracé vectoriel simple.
// Aucune dépendance : encodage PNG maison (zlib natif). Lancer : `pnpm gen:icons`.
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), "../public");
mkdirSync(OUT, { recursive: true });

const HONEY_TOP = [200, 137, 42];
const HONEY_BOT = [154, 95, 12];
const CREAM = [247, 244, 237];

const lerp = (a, b, t) => a + (b - a) * t;
const mix = (c1, c2, t) => [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];

// Hexagone régulier pointe en haut, centré en (0,0), circonrayon R. */
function insideHex(x, y, R) {
  const q2x = Math.abs(x);
  const q2y = Math.abs(y);
  if (q2y > R * Math.sqrt(3) / 2) return false;
  return R * Math.sqrt(3) / 2 * R - (R / 2) * q2y - (Math.sqrt(3) / 2 * R) * q2x >= -1e-9;
}

function roundedSquare(x, y, half, radius) {
  const dx = Math.abs(x) - (half - radius);
  const dy = Math.abs(y) - (half - radius);
  if (dx <= 0 || dy <= 0) return Math.abs(x) <= half && Math.abs(y) <= half;
  return dx * dx + dy * dy <= radius * radius;
}

// Rendu d'une icône `size`x`size` avec supersampling SS. `pad` = marge (0..1)
// autour du carré arrondi (plus grande pour les icônes maskables).
function render(size, { pad = 0.06, ss = 3 } = {}) {
  const buf = Buffer.alloc(size * size * 4);
  const c = size / 2;
  const half = c * (1 - pad);
  const corner = half * 0.42;
  const hexR = half * 0.62;
  const hexInnerR = hexR * 0.6;
  const dotR = half * 0.14;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const px = x + (sx + 0.5) / ss - c;
          const py = y + (sy + 0.5) / ss - c;
          let col = null;
          let alpha = 0;
          if (roundedSquare(px, py, half, corner)) {
            const t = (py + half) / (2 * half);
            col = mix(HONEY_TOP, HONEY_BOT, Math.min(1, Math.max(0, t)));
            alpha = 255;
            const d2 = px * px + py * py;
            if (insideHex(px, py, hexR) && !insideHex(px, py, hexInnerR)) col = CREAM;
            if (d2 <= dotR * dotR) col = CREAM;
          }
          if (col) {
            r += col[0]; g += col[1]; b += col[2]; a += alpha;
          }
        }
      }
      const n = ss * ss;
      const i = (y * size + x) * 4;
      buf[i] = Math.round(r / n);
      buf[i + 1] = Math.round(g / n);
      buf[i + 2] = Math.round(b / n);
      buf[i + 3] = Math.round(a / n);
    }
  }
  return buf;
}

// ── encodeur PNG (RGBA, 8 bits) ──
function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}
function chunk(type, data) {
  const t = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}
function encodePng(rgba, size) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filtre None
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const targets = [
  { file: "pwa-192.png", size: 192, opts: { pad: 0.06 } },
  { file: "pwa-512.png", size: 512, opts: { pad: 0.06 } },
  { file: "pwa-512-maskable.png", size: 512, opts: { pad: 0.18 } },
  { file: "apple-touch-icon-180.png", size: 180, opts: { pad: 0.0 } },
  { file: "favicon-32.png", size: 32, opts: { pad: 0.04 } },
];

for (const { file, size, opts } of targets) {
  writeFileSync(resolve(OUT, file), encodePng(render(size, opts), size));
  console.log("✓", file);
}

// favicon.ico = conteneur ICO avec le PNG 32×32 embarqué.
const png32 = encodePng(render(32, { pad: 0.04 }), 32);
const ico = Buffer.alloc(22);
ico.writeUInt16LE(0, 0);
ico.writeUInt16LE(1, 2); // type ICO
ico.writeUInt16LE(1, 4); // 1 image
ico[6] = 32; ico[7] = 32; // largeur / hauteur
ico[8] = 0; ico[9] = 0;
ico.writeUInt16LE(1, 10);
ico.writeUInt16LE(32, 12);
ico.writeUInt32LE(png32.length, 14);
ico.writeUInt32LE(22, 18);
writeFileSync(resolve(OUT, "favicon.ico"), Buffer.concat([ico, png32]));
console.log("✓ favicon.ico");
