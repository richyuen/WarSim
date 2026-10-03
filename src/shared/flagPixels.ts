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

/** A flag of one colour (nations without any flag, e.g. new rebels). */
export function plainFlag(rgb: number): Uint32Array {
  return new Uint32Array(FLAG_W * FLAG_H).fill(rgb & 0xffffff);
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
