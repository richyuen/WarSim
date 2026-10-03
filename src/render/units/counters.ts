/**
 * T0 strategic counters (SPEC §8, PLAN 2.2): formations aggregated per nation per cell of a
 * world-aligned grid, one counter each showing Σ strength.
 *
 * Clustering is stable and multi-level: level L uses a grid of 2^L cells, so the grids nest
 * and a level-L+1 cluster is exactly the union of its level-L children. The level follows the
 * zoom so that a grid cell is about CLUSTER_PX on screen, with ±0.15 hysteresis.
 *
 * When the level changes, the finer level's counters animate over SPLIT_MS: from the parent's
 * centroid to their own when splitting, and from their own to the parent's when merging. At
 * the end they are replaced by the target level, already at the same positions. No counter
 * appears or disappears anywhere except under a counter in the same place.
 */
import { strengthText, T1_MAX_M } from './markers';
import { worldToScreen, wrapOffsets, type Camera, type MapGeometry } from '../camera';

export interface CounterSource {
  x: number;
  y: number;
  nation: number;
  strength: number;
}

export interface Cluster {
  nation: number;
  gx: number;
  gy: number;
  /** Centroid in cells. */
  x: number;
  y: number;
  strength: number;
  count: number;
}

export interface DrawnCounter {
  key: string;
  nation: number;
  /** World position in cells (as drawn, after animation). */
  wx: number;
  wy: number;
  alpha: number;
  strength: number;
  text: string;
}

export const CLUSTER_PX = 64;
export const HYSTERESIS = 0.15;
export const SPLIT_MS = 250;
export const MAX_LEVEL = 14;

/** The clustering level for `scale` CSS px per cell, keeping `current` within its hysteresis band. */
export function clusterLevel(scale: number, current: number | null): number {
  const lv = Math.log2(CLUSTER_PX / scale);
  const clamp = (l: number): number => Math.max(0, Math.min(MAX_LEVEL, l));
  if (current === null) return clamp(Math.round(lv));
  if (lv > current + 0.5 + HYSTERESIS || lv < current - 0.5 - HYSTERESIS) return clamp(Math.round(lv));
  return current;
}

export const clusterKey = (nation: number, level: number, gx: number, gy: number): string => `${nation}:${level}:${gx}:${gy}`;

/** Clusters at `level`, keyed by `clusterKey`. */
export function buildClusters(src: readonly CounterSource[], level: number): Map<string, Cluster> {
  const g = 2 ** level;
  const out = new Map<string, Cluster>();
  for (const f of src) {
    const gx = Math.floor(f.x / g);
    const gy = Math.floor(f.y / g);
    const k = clusterKey(f.nation, level, gx, gy);
    let c = out.get(k);
    if (!c) out.set(k, (c = { nation: f.nation, gx, gy, x: 0, y: 0, strength: 0, count: 0 }));
    c.x += f.x;
    c.y += f.y;
    c.strength += f.strength;
    c.count++;
  }
  for (const c of out.values()) {
    c.x /= c.count;
    c.y /= c.count;
  }
  return out;
}

/** Opacity of the counter layer: full above T1, fading out as the T1 markers fade in. */
export function counterAlpha(mPerPx: number, markerAlpha: number): number {
  return mPerPx >= T1_MAX_M ? 1 - markerAlpha : 0;
}

const ease = (t: number): number => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

export class CounterLayer {
  level: number | null = null;
  private trans: { from: number; to: number; start: number } | null = null;
  /** Counters drawn last frame (tests). */
  drawn: DrawnCounter[] = [];

  /** True while a split/merge animation runs (the view keeps redrawing). */
  animating(now: number): boolean {
    return this.trans !== null && now - this.trans.start < SPLIT_MS + 50;
  }

  /** The counters to show at `now`: positions in cells, after any animation. */
  layout(src: readonly CounterSource[], scale: number, now: number, visible: boolean): { key: string; c: Cluster; x: number; y: number }[] {
    const target = clusterLevel(scale, this.level);
    if (this.trans && now - this.trans.start >= SPLIT_MS) {
      this.level = this.trans.to;
      this.trans = null;
    }
    if (!visible || this.level === null) {
      // Invisible: follow the zoom without animating.
      this.level = target;
      this.trans = null;
      if (!visible) return [];
    }
    if (!this.trans && target !== this.level) this.trans = { from: this.level!, to: target, start: now };
    if (!this.trans) {
      return [...buildClusters(src, this.level!).entries()].map(([key, c]) => ({ key, c, x: c.x, y: c.y }));
    }
    const { from, to, start } = this.trans;
    const fine = Math.min(from, to);
    const coarse = Math.max(from, to);
    const d = coarse - fine;
    const p = ease(Math.max(0, Math.min(1, (now - start) / SPLIT_MS)));
    const s = to < from ? 1 - p : p; // 1 = at the parent's centroid
    const parents = buildClusters(src, coarse);
    return [...buildClusters(src, fine).entries()].map(([key, c]) => {
      const par = parents.get(clusterKey(c.nation, coarse, Math.floor(c.gx / 2 ** d), Math.floor(c.gy / 2 ** d)))!;
      return { key, c, x: c.x + (par.x - c.x) * s, y: c.y + (par.y - c.y) * s };
    });
  }

  draw(
    ctx: CanvasRenderingContext2D,
    src: readonly CounterSource[],
    cam: Camera,
    geo: MapGeometry,
    vw: number,
    vh: number,
    alpha: number,
    now: number,
    colorOf: (nation: number) => string,
    flagOf: (nation: number) => CanvasImageSource | null,
    /** Unit-size setting (PLAN 1.39a): scales each counter about its position. */
    size = 1,
  ): void {
    const items = this.layout(src, cam.scale, now, alpha > 0.01);
    this.drawn = [];
    if (items.length === 0) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.imageSmoothingEnabled = false;
    ctx.font = '700 10px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const offs = wrapOffsets(cam, geo, vw);
    // Small first, so the big stacks stay on top.
    items.sort((a, b) => a.c.strength - b.c.strength || (a.key < b.key ? -1 : 1));
    for (const it of items) {
      const text = strengthText(it.c.strength);
      const tw = Math.ceil(ctx.measureText(text).width);
      const w = tw + 18;
      const h = 14;
      let shown = false;
      for (const off of offs) {
        const [sx, sy] = worldToScreen(cam, it.x + off, it.y, vw, vh);
        const x = Math.round(sx - w / 2);
        const y = Math.round(sy - h / 2);
        if (sx - (w / 2) * size > vw || sy - (h / 2) * size > vh || sx + (w / 2) * size < 0 || sy + (h / 2) * size < 0) continue;
        shown = true;
        ctx.save();
        if (size !== 1) {
          ctx.translate(sx, sy);
          ctx.scale(size, size);
          ctx.translate(-sx, -sy);
        }
        ctx.fillStyle = 'rgba(16, 18, 24, 0.85)';
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = colorOf(it.c.nation);
        ctx.fillRect(x + 1, y + 1, 12, h - 2);
        const flag = flagOf(it.c.nation);
        if (flag) ctx.drawImage(flag, x + 2, y + 3, 10, 8);
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.9)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
        ctx.fillStyle = '#ffe28a';
        ctx.fillText(text, x + 15, y + h / 2 + 0.5);
        ctx.restore();
      }
      if (shown) this.drawn.push({ key: it.key, nation: it.c.nation, wx: it.x, wy: it.y, alpha, strength: it.c.strength, text });
    }
    ctx.restore();
  }
}
