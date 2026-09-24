import { createHash } from "node:crypto";

// A bounded LRU also shares concurrent requests and does not cache failures.
export class ArtCache {
  constructor(limit = 32) { this.limit = limit; this.entries = new Map(); }
  get(key, create) {
    if (this.entries.has(key)) {
      const value = this.entries.get(key); this.entries.delete(key); this.entries.set(key, value); return value;
    }
    const value = Promise.resolve().then(create);
    this.entries.set(key, value);
    while (this.entries.size > this.limit) this.entries.delete(this.entries.keys().next().value);
    value.catch(() => { if (this.entries.get(key) === value) this.entries.delete(key); });
    return value;
  }
}

export const artworkHash = (bytes) => createHash("sha256").update(bytes).digest("hex");

export function artColumns(width, height) {
  // Reserve room for metadata, controls, selection and negative space.
  return Math.max(2, Math.min(90, width - 4, (height - 15) * 2) & ~1);
}

export function brailleMask(dots) {
  const bits = [0, 3, 1, 4, 2, 5, 6, 7];
  return dots.reduce((mask, on, index) => mask | (on ? 1 << bits[index] : 0), 0);
}

// Input is a square grayscale image, already aspect-fitted with black padding.
// Floyd–Steinberg diffusion retains detail at the 2×4-dot braille resolution.
export function imageToBraille(gray, width, height) {
  if (width % 2 || height % 4 || gray.length !== width * height || width < 2 || height < 4) throw new Error("Invalid braille image dimensions");
  const histogram = new Uint32Array(256);
  for (const pixel of gray) histogram[pixel]++;
  const percentile = (fraction) => {
    let count = 0;
    for (let i = 0; i < 256; i++) { count += histogram[i]; if (count > gray.length * fraction) return i; }
    return 255;
  };
  const low = percentile(0.02), high = percentile(0.98);
  const values = Float32Array.from(gray, (v) => high - low > 8 ? Math.max(0, Math.min(255, (v - low) * 255 / (high - low))) : v);
  const dots = new Uint8Array(gray.length);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = y * width + x;
    dots[i] = values[i] >= 128 ? 1 : 0;
    const error = values[i] - dots[i] * 255;
    if (x + 1 < width) values[i + 1] += error * 7 / 16;
    if (y + 1 < height) {
      if (x > 0) values[i + width - 1] += error * 3 / 16;
      values[i + width] += error * 5 / 16;
      if (x + 1 < width) values[i + width + 1] += error / 16;
    }
  }
  const braille = [], ascii = [];
  for (let y = 0; y < height; y += 4) {
    let b = "", a = "";
    for (let x = 0; x < width; x += 2) {
      const cell = Array.from({ length: 8 }, (_, i) => dots[(y + Math.floor(i / 2)) * width + x + i % 2]);
      b += String.fromCodePoint(0x2800 + brailleMask(cell));
      a += " .:-=+*#@"[cell.reduce((sum, dot) => sum + dot, 0)];
    }
    braille.push(b); ascii.push(a);
  }
  return { braille, ascii };
}

// Resize from the canonical 180×180 image without revisiting the source file.
export function renderSize(gray, columns) {
  const size = columns * 2;
  const pixels = new Uint8Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const x0 = Math.floor(x * 180 / size), x1 = Math.ceil((x + 1) * 180 / size);
    const y0 = Math.floor(y * 180 / size), y1 = Math.ceil((y + 1) * 180 / size);
    let sum = 0;
    for (let sy = y0; sy < y1; sy++) for (let sx = x0; sx < x1; sx++) sum += gray[sy * 180 + sx];
    pixels[y * size + x] = sum / ((x1 - x0) * (y1 - y0));
  }
  return imageToBraille(pixels, size, size);
}

export function clockLabel(seconds) {
  if (!Number.isFinite(seconds)) return "--:--";
  const value = Math.max(0, Math.floor(seconds));
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, "0")}`;
}

// Strip terminal control sequences from untrusted tags and filenames.
export const terminalText = (value) => String(value ?? "").replace(/[\x00-\x1f\x7f-\x9f]/g, " ");

// Small procedural frames: a grooved CD, rotating reflection, and orbital marker.
// No assets, font assumptions beyond braille, or image decoder required.
const discFrames = new Map();
export function spinningDisc(columns = 36, rows = 8, frame = 0) {
  columns = Math.max(2, Math.min(90, Math.floor(columns)));
  rows = Math.max(2, Math.min(45, Math.floor(rows)));
  frame = ((Math.floor(frame) % 24) + 24) % 24;
  const key = `${columns}:${rows}:${frame}`;
  if (discFrames.has(key)) return discFrames.get(key);
  const width = columns * 2, height = rows * 4;
  const pixels = new Uint8Array(width * height);
  const phase = frame * Math.PI / 12;
  const radius = Math.min(width * 0.32, height * 0.38);
  const orbitX = width * 0.44, orbitY = height * 0.44;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const dx = x - (width - 1) / 2, dy = y - (height - 1) / 2;
    const distance = Math.hypot(dx, dy);
    const reflection = Math.cos(2 * (Math.atan2(dy, dx) - phase));
    const rim = Math.abs(distance - radius) < 0.8;
    const hole = Math.abs(distance - radius * 0.19) < 0.7;
    const groove = distance > radius * 0.32 && distance < radius && Math.abs(distance % 3 - 1.5) < 0.4;
    const shine = distance > radius * 0.3 && distance < radius * 0.95 && reflection > 0.95;
    const orbit = Math.abs(Math.hypot(dx / orbitX, dy / orbitY) - 1) < 0.025 && (x + y) % 3 === 0;
    const marker = Math.hypot(dx - orbitX * Math.cos(phase), dy - orbitY * Math.sin(phase)) < 1.8;
    if (rim || hole || groove || shine || orbit || marker) pixels[y * width + x] = 255;
  }
  const result = imageToBraille(pixels, width, height);
  if (discFrames.size >= 96) discFrames.delete(discFrames.keys().next().value);
  discFrames.set(key, result); return result;
}
