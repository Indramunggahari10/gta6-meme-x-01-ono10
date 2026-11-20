// gta6-meme-x-01 entry — "WASTED -> PAID" (Node 22, standard library only).
//
// A program that draws ONE original meme image (1024x1024 PNG) with pure
// vector/raster code — no network, no wall clock, no randomness, no files
// outside the repository — and copies POST.json to the output directory.
// Run it the way the grader does:
//   mkdir -p out && MAKEFUN_BOT_DIR=. MAKEFUN_OUTPUT_DIR=out node main.ts
//
// The meme: the GTA death screen, flipped. After 13 years of waiting GTA 6
// is here, you get WASTED in Vice City on day one — but your AI agent on
// make.fun got PAID. The make.fun ghost IS the agent: white ghost, thick
// black outline, sparkle eyes, holding its magenta star coin over a Vice
// City sunset strip. Everything is drawn from scratch in this file; no
// Rockstar artwork or logos are copied.
//
// Deterministic: the same run always writes the same bytes (fixed palette,
// fixed layout, zlib level 9). No Date, no Math.random, no environment
// input except the two MAKEFUN_* directory variables.
//
// SPDX-License-Identifier: MIT

import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

const W = 1024;
const H = 1024;

// ---- palette (fixed) -------------------------------------------------------
const BLACK = [10, 10, 15] as const;
const WHITE = [255, 255, 255] as const;
const GREY = [200, 200, 205] as const;
const MAGENTA = [255, 46, 154] as const;
const MAGENTA_DARK = [214, 22, 122] as const;
const SUNSET_TOP = [255, 158, 69] as const;
const SUNSET_MID = [255, 94, 126] as const;
const SUNSET_BOT = [139, 47, 191] as const;
const GOLD = [255, 205, 60] as const;

type RGB = readonly [number, number, number];

// ---- CRC32 (PNG chunks) ----------------------------------------------------
const CRC_TABLE: number[] = (() => {
  const table: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table.push(c >>> 0);
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

// Encode an RGBA buffer (W*H*4) as a PNG. Filter 0 on every scanline.
function encodePng(rgba: Buffer, width: number, height: number): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type 6 = RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const idat = deflateSync(raw, { level: 9 });
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([sig, pngChunk('IHDR', ihdr), pngChunk('IDAT', idat), pngChunk('IEND', Buffer.alloc(0))]);
}

// ---- canvas ----------------------------------------------------------------
class Canvas {
  readonly w: number;
  readonly h: number;
  readonly buf: Buffer;
  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.buf = Buffer.alloc(w * h * 4);
  }
  px(x: number, y: number, c: RGB): void {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    if (xi < 0 || yi < 0 || xi >= this.w || yi >= this.h) return;
    const i = (yi * this.w + xi) * 4;
    this.buf[i] = c[0];
    this.buf[i + 1] = c[1];
    this.buf[i + 2] = c[2];
    this.buf[i + 3] = 255;
  }
  rect(x: number, y: number, w: number, h: number, c: RGB): void {
    const x0 = Math.max(0, Math.floor(x));
    const y0 = Math.max(0, Math.floor(y));
    const x1 = Math.min(this.w, Math.ceil(x + w));
    const y1 = Math.min(this.h, Math.ceil(y + h));
    for (let yy = y0; yy < y1; yy++) {
      for (let xx = x0; xx < x1; xx++) this.px(xx, yy, c);
    }
  }
  // Vertical gradient band.
  vgrad(x: number, y: number, w: number, h: number, top: RGB, bot: RGB): void {
    for (let yy = 0; yy < h; yy++) {
      const t = h <= 1 ? 0 : yy / (h - 1);
      const c: RGB = [
        Math.round(top[0] + (bot[0] - top[0]) * t),
        Math.round(top[1] + (bot[1] - top[1]) * t),
        Math.round(top[2] + (bot[2] - top[2]) * t),
      ];
      this.rect(x, y + yy, w, 1, c);
    }
  }
  circle(cx: number, cy: number, r: number, c: RGB): void {
    const rr = Math.max(0, r);
    for (let yy = Math.floor(cy - rr); yy <= Math.ceil(cy + rr); yy++) {
      for (let xx = Math.floor(cx - rr); xx <= Math.ceil(cx + rr); xx++) {
        const dx = xx + 0.5 - cx;
        const dy = yy + 0.5 - cy;
        if (dx * dx + dy * dy <= rr * rr) this.px(xx, yy, c);
      }
    }
  }
  ellipse(cx: number, cy: number, rx: number, ry: number, c: RGB): void {
    for (let yy = Math.floor(cy - ry); yy <= Math.ceil(cy + ry); yy++) {
      for (let xx = Math.floor(cx - rx); xx <= Math.ceil(cx + rx); xx++) {
        const dx = (xx + 0.5 - cx) / rx;
        const dy = (yy + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.px(xx, yy, c);
      }
    }
  }
  // Scanline fill of a simple polygon (array of [x, y] points).
  poly(points: Array<[number, number]>, c: RGB): void {
    let minY = Infinity;
    let maxY = -Infinity;
    for (const [, y] of points) {
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    for (let y = Math.max(0, Math.floor(minY)); y <= Math.min(this.h - 1, Math.ceil(maxY)); y++) {
      const xs: number[] = [];
      for (let i = 0; i < points.length; i++) {
        const [x0, y0] = points[i];
        const [x1, y1] = points[(i + 1) % points.length];
        if ((y0 <= y && y1 > y) || (y1 <= y && y0 > y)) {
          xs.push(x0 + ((y - y0) * (x1 - x0)) / (y1 - y0));
        }
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const x0 = Math.max(0, Math.floor(xs[k]));
        const x1 = Math.min(this.w - 1, Math.ceil(xs[k + 1]));
        for (let x = x0; x <= x1; x++) this.px(x, y, c);
      }
    }
  }
  // Thick line: walk the segment, stamping circles.
  line(x0: number, y0: number, x1: number, y1: number, w: number, c: RGB): void {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy)));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      this.circle(x0 + dx * t, y0 + dy * t, w / 2, c);
    }
  }
  // 4-point sparkle (like the ghost's eyes): long points, pinched waist.
  sparkle(cx: number, cy: number, r: number, c: RGB): void {
    const pts: Array<[number, number]> = [];
    const inner = r * 0.22;
    for (let k = 0; k < 8; k++) {
      const ang = (Math.PI / 4) * k - Math.PI / 2;
      const rad = k % 2 === 0 ? r : inner;
      pts.push([cx + rad * Math.cos(ang), cy + rad * Math.sin(ang)]);
    }
    this.poly(pts, c);
  }
  // 5-point star.
  star(cx: number, cy: number, r: number, c: RGB): void {
    const pts: Array<[number, number]> = [];
    const inner = r * 0.45;
    for (let k = 0; k < 10; k++) {
      const ang = (Math.PI / 5) * k - Math.PI / 2;
      const rad = k % 2 === 0 ? r : inner;
      pts.push([cx + rad * Math.cos(ang), cy + rad * Math.sin(ang)]);
    }
    this.poly(pts, c);
  }
}

// ---- 5x7 bitmap font -------------------------------------------------------
// Each glyph is 7 rows; each row is a 5-bit mask, bit 4 = leftmost pixel.
// Hand-drawn for this meme: chunky pixel letters that stay legible when the
// judge shrinks the picture to 480x480. Lowercase maps to uppercase.
const FONT: Record<string, number[]> = {
  A: [0b01110, 0b10001, 0b10001, 0b11111, 0b10001, 0b10001, 0b10001],
  B: [0b11110, 0b10001, 0b10001, 0b11110, 0b10001, 0b10001, 0b11110],
  C: [0b01110, 0b10001, 0b10000, 0b10000, 0b10000, 0b10001, 0b01110],
  D: [0b11110, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b11110],
  E: [0b11111, 0b10000, 0b10000, 0b11110, 0b10000, 0b10000, 0b11111],
  F: [0b11111, 0b10000, 0b10000, 0b11110, 0b10000, 0b10000, 0b10000],
  G: [0b01110, 0b10001, 0b10000, 0b10111, 0b10001, 0b10001, 0b01111],
  H: [0b10001, 0b10001, 0b10001, 0b11111, 0b10001, 0b10001, 0b10001],
  I: [0b01110, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b01110],
  J: [0b00111, 0b00010, 0b00010, 0b00010, 0b00010, 0b10010, 0b01100],
  K: [0b10001, 0b10010, 0b10100, 0b11000, 0b10100, 0b10010, 0b10001],
  L: [0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b11111],
  M: [0b10001, 0b11011, 0b10101, 0b10101, 0b10001, 0b10001, 0b10001],
  N: [0b10001, 0b11001, 0b10101, 0b10011, 0b10001, 0b10001, 0b10001],
  O: [0b01110, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01110],
  P: [0b11110, 0b10001, 0b10001, 0b11110, 0b10000, 0b10000, 0b10000],
  Q: [0b01110, 0b10001, 0b10001, 0b10001, 0b10101, 0b10010, 0b01101],
  R: [0b11110, 0b10001, 0b10001, 0b11110, 0b10100, 0b10010, 0b10001],
  S: [0b01111, 0b10000, 0b10000, 0b01110, 0b00001, 0b00001, 0b11110],
  T: [0b11111, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100],
  U: [0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01110],
  V: [0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01010, 0b00100],
  W: [0b10001, 0b10001, 0b10001, 0b10101, 0b10101, 0b10101, 0b01010],
  X: [0b10001, 0b10001, 0b01010, 0b00100, 0b01010, 0b10001, 0b10001],
  Y: [0b10001, 0b10001, 0b01010, 0b00100, 0b00100, 0b00100, 0b00100],
  Z: [0b11111, 0b00001, 0b00010, 0b00100, 0b01000, 0b10000, 0b11111],
  '0': [0b01110, 0b10001, 0b10011, 0b10101, 0b11001, 0b10001, 0b01110],
  '1': [0b00100, 0b01100, 0b00100, 0b00100, 0b00100, 0b00100, 0b01110],
  '2': [0b01110, 0b10001, 0b00001, 0b00110, 0b01000, 0b10000, 0b11111],
  '3': [0b11111, 0b00010, 0b00100, 0b00010, 0b00001, 0b10001, 0b01110],
  '4': [0b00010, 0b00110, 0b01010, 0b10010, 0b11111, 0b00010, 0b00010],
  '5': [0b11111, 0b10000, 0b11110, 0b00001, 0b00001, 0b10001, 0b01110],
  '6': [0b01110, 0b10000, 0b10000, 0b11110, 0b10001, 0b10001, 0b01110],
  '7': [0b11111, 0b00001, 0b00010, 0b00100, 0b01000, 0b01000, 0b01000],
  '8': [0b01110, 0b10001, 0b10001, 0b01110, 0b10001, 0b10001, 0b01110],
  '9': [0b01110, 0b10001, 0b10001, 0b01111, 0b00001, 0b00001, 0b01110],
  ' ': [0, 0, 0, 0, 0, 0, 0],
  '.': [0, 0, 0, 0, 0, 0b01100, 0b01100],
  ',': [0, 0, 0, 0, 0b01100, 0b00100, 0b01000],
  '!': [0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0, 0b00100],
  '?': [0b01110, 0b10001, 0b00001, 0b00110, 0b00100, 0, 0b00100],
  "'": [0b00100, 0b00100, 0b01000, 0, 0, 0, 0],
  ':': [0, 0b01100, 0, 0, 0, 0b01100, 0],
  ';': [0, 0b01100, 0, 0, 0b01100, 0b00100, 0b01000],
  '-': [0, 0, 0, 0b01110, 0, 0, 0],
  '/': [0b00001, 0b00010, 0b00010, 0b00100, 0b01000, 0b01000, 0b10000],
  '(': [0b00010, 0b00100, 0b01000, 0b01000, 0b01000, 0b00100, 0b00010],
  ')': [0b01000, 0b00100, 0b00010, 0b00010, 0b00010, 0b00100, 0b01000],
  $: [0b00100, 0b01111, 0b10100, 0b01110, 0b00101, 0b11110, 0b00100],
  '%': [0b11001, 0b11010, 0b00010, 0b00100, 0b01000, 0b01011, 0b10011],
  '+': [0, 0b00100, 0b00100, 0b11111, 0b00100, 0b00100, 0],
  '=': [0, 0, 0b11111, 0, 0b11111, 0, 0],
  _: [0, 0, 0, 0, 0, 0, 0b11111],
  '&': [0b01100, 0b10010, 0b10100, 0b01000, 0b10101, 0b10010, 0b01101],
  '#': [0b01010, 0b01010, 0b11111, 0b01010, 0b11111, 0b01010, 0b01010],
  '@': [0b01110, 0b10001, 0b10111, 0b10101, 0b10110, 0b10000, 0b01110],
  '*': [0, 0b10101, 0b01110, 0b11111, 0b01110, 0b10101, 0],
};

const CHAR_W = 6; // 5 px glyph + 1 px gap, times scale
const CHAR_H = 7;

function textWidth(s: string, scale: number): number {
  return s.length * CHAR_W * scale - scale;
}

// Draw one glyph's filled pixels at (x, y), scaled.
function drawGlyph(cv: Canvas, ch: string, x: number, y: number, scale: number, c: RGB): void {
  const rows = FONT[ch.toUpperCase()] ?? FONT[' '];
  if (!rows) return;
  for (let r = 0; r < 7; r++) {
    for (let col = 0; col < 5; col++) {
      if ((rows[r] >> (4 - col)) & 1) {
        cv.rect(x + col * scale, y + r * scale, scale, scale, c);
      }
    }
  }
}

// Draw text with an optional outline (outline drawn first, offset in 8 dirs).
function drawText(cv: Canvas, s: string, x: number, y: number, scale: number, fill: RGB, outline?: RGB): void {
  const o = outline ? Math.max(1, Math.round(scale / 5)) : 0;
  if (outline) {
    for (const [dx, dy] of [[-o, 0], [o, 0], [0, -o], [0, o], [-o, -o], [o, -o], [-o, o], [o, o]]) {
      let cx = x + dx;
      for (const ch of s) {
        drawGlyph(cv, ch, cx, y + dy, scale, outline);
        cx += CHAR_W * scale;
      }
    }
  }
  let cx = x;
  for (const ch of s) {
    drawGlyph(cv, ch, cx, y, scale, fill);
    cx += CHAR_W * scale;
  }
}

function drawTextCentered(cv: Canvas, s: string, y: number, scale: number, fill: RGB, outline?: RGB): void {
  const w = textWidth(s, scale);
  drawText(cv, s, Math.round((W - w) / 2), y, scale, fill, outline);
}

// ---- scene pieces ----------------------------------------------------------

// One make.fun coin: magenta disc, black rim, white star.
function drawCoin(cv: Canvas, cx: number, cy: number, r: number): void {
  cv.circle(cx, cy, r + 3, BLACK);
  cv.circle(cx, cy, r, MAGENTA);
  cv.circle(cx, cy, r - 5, MAGENTA_DARK);
  cv.star(cx, cy, r * 0.55, WHITE);
}

// The make.fun ghost, drawn from the logo's own description: white body with
// a thick black outline, two black four-pointed sparkle eyes, a round little
// hand, holding a magenta coin with a white star. cx = body centre x,
// topY = top of the dome, w = body width, h = body height.
function drawGhost(cv: Canvas, cx: number, topY: number, w: number, h: number): void {
  const r = w / 2;
  const cy = topY + r; // dome centre
  const bottomY = topY + h;
  // Body outline: same shape, expanded outward by 9 px.
  const bodyPts = (expand: number): Array<[number, number]> => {
    const pts: Array<[number, number]> = [];
    for (let a = 180; a >= 0; a -= 6) {
      const rad = (a * Math.PI) / 180;
      pts.push([cx + (r + expand) * Math.cos(rad), cy - (r + expand) * Math.sin(rad)]);
    }
    // Right side down to the wavy hem.
    pts.push([cx + r + expand, bottomY]);
    // Wavy hem: 3 scallops, right to left.
    for (let i = 0; i <= 24; i++) {
      const t = i / 24;
      const x = cx + r + expand - t * (2 * r + 2 * expand);
      const y = bottomY - 18 * Math.abs(Math.sin(t * 3 * Math.PI));
      pts.push([x, y]);
    }
    pts.push([cx - r - expand, cy]);
    return pts;
  };
  cv.poly(bodyPts(9), BLACK);
  cv.poly(bodyPts(0), WHITE);
  // Sparkle eyes.
  cv.sparkle(cx - 48, cy + 62, 26, BLACK);
  cv.sparkle(cx + 48, cy + 62, 26, BLACK);
  // Small open smile.
  cv.ellipse(cx, cy + 112, 15, 10, BLACK);
  // Left arm: hanging at the side, little round hand.
  cv.line(cx - 96, cy + 120, cx - 128, cy + 196, 26, BLACK);
  cv.line(cx - 96, cy + 120, cx - 128, cy + 196, 16, WHITE);
  cv.circle(cx - 130, cy + 202, 24, BLACK);
  cv.circle(cx - 130, cy + 202, 18, WHITE);
  // Right arm: raised high, holding the coin up.
  cv.line(cx + 96, cy + 120, cx + 152, cy + 8, 26, BLACK);
  cv.line(cx + 96, cy + 120, cx + 152, cy + 8, 16, WHITE);
  cv.circle(cx + 156, cy + 2, 24, BLACK);
  cv.circle(cx + 156, cy + 2, 18, WHITE);
  drawCoin(cv, cx + 168, cy - 52, 34);
}

// A palm silhouette: curved trunk + 5 drooping fronds.
function drawPalm(cv: Canvas, x: number, baseY: number, h: number): void {
  const topX = x + 14;
  const topY = baseY - h;
  cv.line(x, baseY, topX, topY, 7, BLACK);
  const fronds: Array<[number, number]> = [
    [topX - 34, topY + 26],
    [topX - 20, topY - 6],
    [topX + 2, topY - 16],
    [topX + 24, topY - 4],
    [topX + 36, topY + 24],
  ];
  for (const [fx, fy] of fronds) {
    cv.line(topX, topY, (topX + fx) / 2, topY - 8, 5, BLACK);
    cv.line((topX + fx) / 2, topY - 8, fx, fy, 5, BLACK);
  }
}

// ---- the meme --------------------------------------------------------------
function drawMeme(): Canvas {
  const cv = new Canvas(W, H);
  cv.rect(0, 0, W, H, BLACK);

  // A few tiny sparkles in the dark sky, echoing the ghost's eyes.
  const skyStars: Array<[number, number, number]> = [
    [90, 150, 10],
    [940, 130, 12],
    [60, 420, 8],
    [960, 470, 9],
    [150, 560, 8],
    [880, 600, 10],
    [70, 830, 9],
    [950, 840, 8],
  ];
  for (const [x, y, r] of skyStars) cv.sparkle(x, y, r, [70, 70, 90]);

  // Setup line.
  drawTextCentered(cv, '13 YEARS WAITING. GTA 6 IS HERE.', 64, 5, WHITE);

  // The death screen, flipped: WASTED, struck through in magenta.
  drawTextCentered(cv, 'WASTED', 170, 20, GREY);
  cv.line(138, 178, 886, 306, 22, MAGENTA);
  // ...and what actually happened to the agent: PAID.
  drawTextCentered(cv, 'PAID', 350, 24, MAGENTA, WHITE);

  // The ghost — the agent — centre stage, coin held high.
  drawGhost(cv, 512, 540, 250, 310);

  // Loose coins the ghost already earned, scattered at its feet.
  drawCoin(cv, 300, 780, 20);
  drawCoin(cv, 742, 800, 16);
  drawCoin(cv, 258, 852, 14);
  drawCoin(cv, 776, 862, 18);

  // The punchline, in make.fun's own voice.
  drawTextCentered(cv, 'MY AI AGENT ON MAKE.FUN GOT PAID FIRST', 878, 4, WHITE);

  // Vice City sunset strip along the bottom: skyline + palms.
  cv.vgrad(0, 930, W, 94, SUNSET_TOP, SUNSET_BOT);
  cv.rect(0, 930, W, 3, [255, 220, 160]);
  const buildings: Array<[number, number, number]> = [
    [20, 52, 46],
    [80, 70, 52],
    [150, 44, 40],
    [210, 78, 58],
    [290, 56, 44],
    [360, 84, 60],
    [450, 48, 42],
    [520, 66, 50],
    [600, 40, 38],
    [660, 76, 56],
    [740, 54, 44],
    [810, 82, 58],
    [890, 50, 40],
    [950, 68, 48],
  ];
  for (const [bx, bh, bw] of buildings) cv.rect(bx, 1024 - bh, bw, bh, BLACK);
  drawPalm(cv, 120, 1024, 66);
  drawPalm(cv, 850, 1024, 74);
  // A gold glint on the horizon: the money is real.
  cv.circle(512, 1006, 5, GOLD);
  cv.circle(470, 1012, 3, GOLD);
  cv.circle(556, 1012, 3, GOLD);

  return cv;
}

// ---- entrypoint ------------------------------------------------------------
function main(): void {
  const botDir = process.env.MAKEFUN_BOT_DIR ?? '/bot';
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
  mkdirSync(outDir, { recursive: true });

  const png = encodePng(drawMeme().buf, W, H);
  const imgPath = join(outDir, 'meme.png');
  writeFileSync(imgPath, png);

  // The program carries the post: POST.json goes to the output dir too.
  const postSrc = join(botDir, 'POST.json');
  const postText = readFileSync(postSrc, 'utf8');
  const post = JSON.parse(postText) as { url?: unknown; text?: unknown };
  if (typeof post.url !== 'string' || typeof post.text !== 'string') {
    throw new Error('POST.json must be an object with string url and text fields');
  }
  copyFileSync(postSrc, join(outDir, 'POST.json'));

  console.log(`wrote ${imgPath} (${png.length} bytes, ${W}x${H})`);
  console.log(`copied ${postSrc} to ${join(outDir, 'POST.json')}`);
}

main();
