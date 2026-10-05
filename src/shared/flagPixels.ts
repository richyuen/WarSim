/**
 * Pixel flags (PLAN 1.37b): AoC-style 36×24 flags, edited pixel by pixel. A custom flag replaces
 * a nation's vector flag (FlagSpec) everywhere it is drawn. Pixels are 0xRRGGBB.
 */
import { rasterizeFlag, type FlagPresets, type FlagSpec } from './flags';

export const FLAG_W = 36;
export const FLAG_H = 24;

/** Rasterizes a vector flag to FLAG_W×FLAG_H pixels (stretched to 3:2, as AoC flags are). */
export function specToPixels(spec: FlagSpec, presets: FlagPresets): Uint32Array {
  const rgba = new Uint8Array(FLAG_W * FLAG_H * 4);
  rasterizeFlag({ ...spec, aspect: FLAG_W / FLAG_H }, presets, rgba, FLAG_W, 0, 0, FLAG_W, FLAG_H);
  const out = new Uint32Array(FLAG_W * FLAG_H);
  for (let i = 0; i < out.length; i++) out[i] = (rgba[i * 4]! << 16) | (rgba[i * 4 + 1]! << 8) | rgba[i * 4 + 2]!;
  return out;
}

const hex = (c: number): string => `#${(c & 0xffffff).toString(16).padStart(6, '0')}`;

/** Editor presets (our own simple patterns): three colours c1..c3 fill the pattern. */
export const FLAG_PRESETS = ['tricolourH', 'tricolourV', 'bicolourH', 'bicolourV', 'nordic', 'cross', 'saltire', 'triangle', 'canton', 'disc', 'star'] as const;
export type FlagPreset = (typeof FLAG_PRESETS)[number];

export function presetSpec(p: FlagPreset, c1: number, c2: number, c3: number): FlagSpec {
  const [a, b, c] = [hex(c1), hex(c2), hex(c3)];
  const base = (layers: FlagSpec['layers']): FlagSpec => ({ aspect: FLAG_W / FLAG_H, layers });
  switch (p) {
    case 'tricolourH':
      return base([{ t: 'stripes', dir: 'h', colors: [a, b, c] }]);
    case 'tricolourV':
      return base([{ t: 'stripes', dir: 'v', colors: [a, b, c] }]);
    case 'bicolourH':
      return base([{ t: 'stripes', dir: 'h', colors: [a, b] }]);
    case 'bicolourV':
      return base([{ t: 'stripes', dir: 'v', colors: [a, b] }]);
    case 'nordic':
      return base([{ t: 'stripes', dir: 'h', colors: [a] }, { t: 'cross', color: b, width: 0.2, cx: 0.36 }]);
    case 'cross':
      return base([{ t: 'stripes', dir: 'h', colors: [a] }, { t: 'cross', color: b, width: 0.2 }]);
    case 'saltire':
      return base([{ t: 'stripes', dir: 'h', colors: [a] }, { t: 'saltire', color: b, width: 0.18 }]);
    case 'triangle':
      return base([{ t: 'stripes', dir: 'h', colors: [a, b] }, { t: 'triangle', color: c, depth: 0.4 }]);
    case 'canton':
      return base([{ t: 'stripes', dir: 'h', colors: [a] }, { t: 'rect', x: 0, y: 0, w: 0.45, h: 0.5, color: b }, { t: 'star', cx: 0.225, cy: 0.25, r: 0.17, color: c }]);
    case 'disc':
      return base([{ t: 'stripes', dir: 'h', colors: [a] }, { t: 'disc', cx: 0.5, cy: 0.5, r: 0.3, color: b }]);
    case 'star':
      return base([{ t: 'stripes', dir: 'h', colors: [a] }, { t: 'star', cx: 0.5, cy: 0.5, r: 0.35, color: b }]);
  }
}

/** Dark and pale, for the second colour: whichever stands off from the nation's own. */
const FLAG_DARK = 0x1c1c28;
const FLAG_PALE = 0xf2efe4;
/** Third colours (our own choice of plain heraldic ones); the first far enough from the other two is taken. */
const FLAG_ACCENTS = [0xe0b020, 0xb82020, 0x1c3c78, 0x1e6a3a, FLAG_DARK, FLAG_PALE] as const;
/** Two colours nearer than this (the sum of the channels' differences) read as one on a 36×24 flag. */
const FLAG_APART = 150;

const luma = (c: number): number => (((c >> 16) & 255) * 299 + ((c >> 8) & 255) * 587 + (c & 255) * 114) / 1000;
const apart = (a: number, b: number): number => Math.abs(((a >> 16) & 255) - ((b >> 16) & 255)) + Math.abs(((a >> 8) & 255) - ((b >> 8) & 255)) + Math.abs((a & 255) - (b & 255));

/** A 32-bit mix of two numbers (murmur3's finalizer): the same everywhere, no seed, no state. */
function mix(a: number, b: number): number {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ b;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

/**
 * The flag of a nation no scenario gives one (PLAN 2.15c): a founded nation, or a nation of a
 * scenario without flags. Made from the nation's id and colour and nothing else, so the same
 * nation flies the same flag in every view, save and session. The pattern is one of the
 * editor's presets; the nation's own colour is the field (or the first stripe), the second
 * colour is dark or pale, whichever stands off from it, and the third a plain accent.
 */
export function foundedFlag(id: number, colour: number): FlagSpec {
  const c1 = colour & 0xffffff;
  const h = mix(id, c1);
  const c2 = luma(c1) > 140 ? FLAG_DARK : FLAG_PALE;
  let c3: number = c2 === FLAG_DARK ? FLAG_PALE : FLAG_DARK;
  for (let i = 0; i < FLAG_ACCENTS.length; i++) {
    const a = FLAG_ACCENTS[((h >>> 8) + i) % FLAG_ACCENTS.length]!;
    if (apart(a, c1) >= FLAG_APART && apart(a, c2) >= FLAG_APART) {
      c3 = a;
      break;
    }
  }
  return presetSpec(FLAG_PRESETS[h % FLAG_PRESETS.length]!, c1, c2, c3);
}

/** 4-connected flood fill of pixel (x, y)'s colour with `rgb` (in place). */
export function fillFlag(px: Uint32Array, x: number, y: number, rgb: number): void {
  const from = px[y * FLAG_W + x];
  if (from === undefined || from === rgb) return;
  const stack = [y * FLAG_W + x];
  while (stack.length > 0) {
    const i = stack.pop()!;
    if (px[i] !== from) continue;
    px[i] = rgb;
    const cx = i % FLAG_W;
    if (cx > 0) stack.push(i - 1);
    if (cx < FLAG_W - 1) stack.push(i + 1);
    if (i >= FLAG_W) stack.push(i - FLAG_W);
    if (i < FLAG_W * (FLAG_H - 1)) stack.push(i + FLAG_W);
  }
}
