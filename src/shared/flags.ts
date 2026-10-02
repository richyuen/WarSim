/**
 * Flags (PLAN 1.6, SPEC §3.4): a flag is data (`FlagSpec`), expanded into coloured polygons that
 * feed two outputs: SVG for the UI, and a deterministic supersampled rasterizer for the GPU flag
 * atlas (unit markers, panels). All artwork is our own simplified design (ADR-10, ADR-19).
 *
 * Coordinates: x and y are fractions of the flag's (or canton's) width and height, 0..1 from the
 * top-left. Radii (`r`) and widths of crosses are fractions of the height, so discs stay round
 * at any aspect. Layers paint in order.
 */
import { rasterizePolygon } from './rasterize';

export type Color = string; // #rrggbb, or "$1".. "$9" inside presets

export type FlagLayer =
  | { t: 'stripes'; dir: 'h' | 'v'; colors: Color[]; weights?: number[] }
  | { t: 'rect'; x: number; y: number; w: number; h: number; color: Color }
  /** Nordic or centred cross; `cx` is the vertical bar's centre (0.5 = Greek/St George). */
  | { t: 'cross'; color: Color; width: number; cx?: number; cy?: number; length?: number }
  | { t: 'saltire'; color: Color; width: number }
  /** Isosceles triangle from the hoist; `depth` is a fraction of the width. */
  | { t: 'triangle'; color: Color; depth: number }
  | { t: 'disc'; cx: number; cy: number; r: number; color: Color }
  | { t: 'star'; cx: number; cy: number; r: number; color: Color; points?: number; inner?: number; rotation?: number }
  /** A disc of `color` with an offset disc of `cut` painted over it. */
  | { t: 'crescent'; cx: number; cy: number; r: number; color: Color; cut: Color; offset: number; cutR?: number }
  | { t: 'poly'; points: [number, number][]; color: Color }
  | { t: 'canton'; x: number; y: number; w: number; h: number; layers: FlagLayer[] }
  | { t: 'preset'; name: string; colors?: Color[] };

export interface FlagSpec {
  /** Width / height (AoC flags are 36×24 = 1.5). */
  aspect: number;
  layers: FlagLayer[];
}

export type FlagPresets = Readonly<Record<string, FlagLayer[]>>;

/** A filled polygon in flag pixels (x 0..aspect·H, y 0..H with H = 1 here), rgb 0xrrggbb. */
export interface FlagShape {
  points: number[];
  rgb: number;
}

interface Frame {
  x: number;
  y: number;
  w: number;
  h: number;
}

const CIRCLE_SEGMENTS = 48;

function rgbOf(c: Color, args: readonly Color[]): number {
  let v = c;
  if (v.startsWith('$')) {
    const a = args[Number(v.slice(1)) - 1];
    if (a === undefined) throw new Error(`flag preset colour ${v} not given`);
    v = a;
  }
  if (!/^#[0-9a-fA-F]{6}$/.test(v)) throw new Error(`bad flag colour ${v}`);
  return parseInt(v.slice(1), 16);
}

function circle(cx: number, cy: number, r: number): number[] {
  const p: number[] = [];
  for (let i = 0; i < CIRCLE_SEGMENTS; i++) {
    const a = (i / CIRCLE_SEGMENTS) * Math.PI * 2;
    p.push(cx + r * Math.cos(a), cy + r * Math.sin(a));
  }
  return p;
}

function rect(x: number, y: number, w: number, h: number): number[] {
  return [x, y, x + w, y, x + w, y + h, x, y + h];
}

/** Expands a spec into polygons in a frame of width `aspect` and height 1. */
export function flagShapes(spec: FlagSpec, presets: FlagPresets): FlagShape[] {
  const out: FlagShape[] = [];
  expand(spec.layers, { x: 0, y: 0, w: spec.aspect, h: 1 }, presets, [], out, 0);
  return out;
}

function expand(layers: readonly FlagLayer[], f: Frame, presets: FlagPresets, args: readonly Color[], out: FlagShape[], depth: number): void {
  if (depth > 4) throw new Error('flag presets nest too deeply');
  const X = (u: number): number => f.x + u * f.w;
  const Y = (v: number): number => f.y + v * f.h;
  const push = (points: number[], c: Color): void => {
    out.push({ points, rgb: rgbOf(c, args) });
  };
  for (const l of layers) {
    switch (l.t) {
      case 'stripes': {
        const wts = l.weights ?? l.colors.map(() => 1);
        if (wts.length !== l.colors.length) throw new Error('stripe weights and colours differ in length');
        const total = wts.reduce((a, b) => a + b, 0);
        let acc = 0;
        l.colors.forEach((c, i) => {
          const a = acc / total;
          acc += wts[i]!;
          const b = acc / total;
          push(l.dir === 'h' ? rect(f.x, Y(a), f.w, (b - a) * f.h) : rect(X(a), f.y, (b - a) * f.w, f.h), c);
        });
        break;
      }
      case 'rect':
        push(rect(X(l.x), Y(l.y), l.w * f.w, l.h * f.h), l.color);
        break;
      case 'cross': {
        const hw = (l.width * f.h) / 2;
        const cx = X(l.cx ?? 0.5);
        const cy = Y(l.cy ?? 0.5);
        const len = l.length; // Greek cross arm length (fraction of height), else full bars
        if (len === undefined) {
          push(rect(f.x, cy - hw, f.w, 2 * hw), l.color);
          push(rect(cx - hw, f.y, 2 * hw, f.h), l.color);
        } else {
          const a = (len * f.h) / 2;
          push(rect(cx - a, cy - hw, 2 * a, 2 * hw), l.color);
          push(rect(cx - hw, cy - a, 2 * hw, 2 * a), l.color);
        }
        break;
      }
      case 'saltire': {
        const hw = (l.width * f.h) / 2;
        // A band of half-width hw along each diagonal, cut exactly at the frame edges: it meets
        // the vertical edges hw·L/w off the corner and the horizontal edges hw·L/h off it.
        const len = Math.hypot(f.w, f.h);
        const dy = (hw * len) / f.w;
        const dx = (hw * len) / f.h;
        const [x0, y0, x1, y1] = [f.x, f.y, f.x + f.w, f.y + f.h];
        push([x0, y0, x0 + dx, y0, x1, y1 - dy, x1, y1, x1 - dx, y1, x0, y0 + dy], l.color);
        push([x1, y0, x1, y0 + dy, x0 + dx, y1, x0, y1, x0, y1 - dy, x1 - dx, y0], l.color);
        break;
      }
      case 'triangle':
        push([f.x, f.y, X(l.depth), f.y + f.h / 2, f.x, f.y + f.h], l.color);
        break;
      case 'disc':
        push(circle(X(l.cx), Y(l.cy), l.r * f.h), l.color);
        break;
      case 'star': {
        const n = l.points ?? 5;
        const r = l.r * f.h;
        const ri = r * (l.inner ?? 0.382);
        const rot = ((l.rotation ?? 0) * Math.PI) / 180 - Math.PI / 2;
        const p: number[] = [];
        for (let i = 0; i < 2 * n; i++) {
          const rr = i % 2 === 0 ? r : ri;
          const a = rot + (i * Math.PI) / n;
          p.push(X(l.cx) + rr * Math.cos(a), Y(l.cy) + rr * Math.sin(a));
        }
        push(p, l.color);
        break;
      }
      case 'crescent':
        push(circle(X(l.cx), Y(l.cy), l.r * f.h), l.color);
        push(circle(X(l.cx) + l.offset * f.h, Y(l.cy), (l.cutR ?? l.r * 0.8) * f.h), l.cut);
        break;
      case 'poly': {
        const p: number[] = [];
        for (const [u, v] of l.points) p.push(X(u), Y(v));
        push(p, l.color);
        break;
      }
      case 'canton':
        expand(l.layers, { x: X(l.x), y: Y(l.y), w: l.w * f.w, h: l.h * f.h }, presets, args, out, depth + 1);
        break;
      case 'preset': {
        const p = presets[l.name];
        if (!p) throw new Error(`unknown flag preset '${l.name}'`);
        const resolved = (l.colors ?? []).map((c) => (c.startsWith('$') ? `#${rgbOf(c, args).toString(16).padStart(6, '0')}` : c));
        expand(p, f, presets, resolved, out, depth + 1);
        break;
      }
    }
  }
}

const hex = (rgb: number): string => `#${rgb.toString(16).padStart(6, '0')}`;
const n3 = (v: number): string => (Math.round(v * 1000) / 1000).toString();

/** SVG markup for a flag, `heightPx` tall (viewBox in flag units). */
export function flagSvg(spec: FlagSpec, presets: FlagPresets, heightPx: number): string {
  const shapes = flagShapes(spec, presets);
  const body = shapes
    .map((s) => {
      let pts = '';
      for (let i = 0; i < s.points.length; i += 2) pts += `${i ? ' ' : ''}${n3(s.points[i]!)},${n3(s.points[i + 1]!)}`;
      return `<polygon points="${pts}" fill="${hex(s.rgb)}"/>`;
    })
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n3(spec.aspect)} 1" width="${n3(heightPx * spec.aspect)}" height="${heightPx}" shape-rendering="geometricPrecision">${body}</svg>`;
}

/**
 * Rasterizes a flag into an RGBA buffer region (w×h px at (ox, oy) in a buffer of width `stride`),
 * supersampled `ss`×`ss`, fitted inside the region with its aspect preserved (letterboxed with
 * transparency). Deterministic (scanline even-odd fill, integer accumulation).
 */
export function rasterizeFlag(spec: FlagSpec, presets: FlagPresets, out: Uint8Array, stride: number, ox: number, oy: number, w: number, h: number, ss = 4): void {
  const shapes = flagShapes(spec, presets);
  const fw = Math.min(w, Math.round(h * spec.aspect));
  const fh = Math.min(h, Math.round(fw / spec.aspect));
  const bx = Math.floor((w - fw) / 2);
  const by = Math.floor((h - fh) / 2);
  const W = fw * ss;
  const H = fh * ss;
  const scale = H; // flag units: height 1 → H samples
  const rgb = new Int32Array(W * H).fill(-1);
  for (const s of shapes) {
    const pts = new Float64Array(s.points.length);
    for (let i = 0; i < s.points.length; i++) pts[i] = s.points[i]! * scale;
    rasterizePolygon([pts], W, H, (y, x0, x1) => rgb.fill(s.rgb, y * W + x0, y * W + x1));
  }
  const n = ss * ss;
  for (let py = 0; py < fh; py++) {
    for (let px = 0; px < fw; px++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const v = rgb[(py * ss + sy) * W + px * ss + sx]!;
          if (v < 0) continue;
          r += (v >> 16) & 255;
          g += (v >> 8) & 255;
          b += v & 255;
          a++;
        }
      }
      const o = ((oy + by + py) * stride + ox + bx + px) * 4;
      if (a > 0) {
        out[o] = Math.round(r / a);
        out[o + 1] = Math.round(g / a);
        out[o + 2] = Math.round(b / a);
        out[o + 3] = Math.round((a * 255) / n);
      }
    }
  }
}

export interface FlagAtlas {
  width: number;
  height: number;
  cellW: number;
  cellH: number;
  cols: number;
  /** RGBA, row-major. */
  rgba: Uint8Array;
  /** Cell rectangle per flag key, in pixels. */
  cells: Record<string, { x: number; y: number }>;
}

/** Packs flags into a grid atlas (1 px transparent gutter). Keys keep their given order. */
export function buildFlagAtlas(flags: readonly [string, FlagSpec][], presets: FlagPresets, cellW = 48, cellH = 32, cols = 16): FlagAtlas {
  const rows = Math.max(1, Math.ceil(flags.length / cols));
  const width = cols * (cellW + 1) + 1;
  const height = rows * (cellH + 1) + 1;
  const rgba = new Uint8Array(width * height * 4);
  const cells: FlagAtlas['cells'] = {};
  flags.forEach(([key, spec], i) => {
    const x = 1 + (i % cols) * (cellW + 1);
    const y = 1 + Math.floor(i / cols) * (cellH + 1);
    rasterizeFlag(spec, presets, rgba, width, x, y, cellW, cellH);
    cells[key] = { x, y };
  });
  return { width, height, cellW, cellH, cols, rgba, cells };
}
