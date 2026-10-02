/**
 * Colour helpers (PLAN 1.4): CIELAB conversion and ΔE*ab (CIE76) for the neighbour-contrast rule
 * (adjacent nations must differ by ΔE > 15) and for picking colours for spawned nations later.
 */

/** `#rrggbb` → 0xrrggbb. */
export function parseHex(hex: string): number {
  return parseInt(hex.slice(1, 7), 16);
}

function linear(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function f(t: number): number {
  return t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116;
}

/** sRGB (0xrrggbb) → CIELAB (D65). */
export function rgbToLab(rgb: number): [number, number, number] {
  const r = linear((rgb >> 16) & 255);
  const g = linear((rgb >> 8) & 255);
  const b = linear(rgb & 255);
  const x = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047;
  const y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
  const z = (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883;
  const fx = f(x);
  const fy = f(y);
  const fz = f(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/** CIE76 colour difference between two sRGB colours. */
export function deltaE(a: number, b: number): number {
  const [l1, a1, b1] = rgbToLab(a);
  const [l2, a2, b2] = rgbToLab(b);
  return Math.sqrt((l1 - l2) ** 2 + (a1 - a2) ** 2 + (b1 - b2) ** 2);
}
