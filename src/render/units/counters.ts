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
import { strengthText } from './markers';
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
  /** The strength shown: with everything folded into this counter (PLAN 1.45b). */
  strength: number;
  text: string;
  /** Other nations folded into it (shown as "+n"). */
  others: number;
  /** Its box on screen, CSS px (the first copy drawn, on a looping map). */
  x: number;
  y: number;
  w: number;
  h: number;
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

const ease = (t: number): number => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

/** A counter for the declutter pass: where it is in px (cells × scale: the camera's place does not matter) and what it holds. */
export interface FoldItem {
  key: string;
  nation: number;
  x: number;
  y: number;
  strength: number;
}

/** A counter after the declutter pass. */
export interface Fold {
  /** The counter this one is folded into; null = it is shown. */
  into: string | null;
  /** Shown counters: the strength with everything folded in, and how many other nations that is. */
  total: number;
  others: number;
  /** The counter of its own nation that stands for it (itself, unless it folded into one in the first pass). */
  lead: string;
  /** What it holds of its own nation, when it is its own lead: itself and those it stands for. */
  own: number;
}

export const FOLD_MS = 250;
/** Shown boxes keep this many px between them. */
export const FOLD_GAP_PX = 2;
/** A folded counter comes out again only once it clears its neighbour by this much more (no flicker at the edge). */
export const FOLD_HOLD_PX = 6;
/** Px between a counter's strength and its "+n". */
const BADGE_GAP = 4;
/** A counter with a new key within this many px of one of its nation takes over that one's fold state. */
const INHERIT_PX = 6;

/**
 * Screen-space declutter (PLAN 1.45b): no two counter boxes overlap. A counter whose box would
 * touch a stronger one's is folded into it (the nearest, when several): the stronger counter
 * shows the sum and how many other nations it took in. Nothing is dropped, so the shown counters
 * still add up to every formation's strength. A box grows with its text, so each pass repeats
 * until no box touches another.
 *
 * Two passes. First a nation's own counters fold into each other, strongest first. Then the
 * counters left fold across nations, in the order of what they now hold. So the children of a
 * cluster, standing on its centroid at the end of a merge animation, count exactly as the
 * cluster that replaces them, and the outcome does not change with the swap.
 *
 * `boxOf(total, others)` is a box's width and height in px. `held(key)` is true for a counter that
 * is folded already: it stays so until it clears its neighbour by FOLD_HOLD_PX.
 */
export function foldOverlaps(items: readonly FoldItem[], boxOf: (total: number, others: number) => [number, number], held: (key: string) => boolean = () => false): Map<string, Fold> {
  interface Group {
    it: FoldItem;
    total: number;
    nations: Set<number>;
    members: string[];
    w: number;
    h: number;
  }
  const size = (g: Group): Group => {
    [g.w, g.h] = boxOf(g.total, g.nations.size - 1);
    return g;
  };
  /** Greedy passes over `groups` in their order, until no box touches another it may fold into. */
  const settle = (groups: Group[], sameNationOnly: boolean): Group[] => {
    let free = groups;
    for (let merged = true; merged; ) {
      merged = false;
      const placed: Group[] = [];
      for (const g of free) {
        const pad = FOLD_GAP_PX + (held(g.it.key) ? FOLD_HOLD_PX : 0);
        let hit: Group | null = null;
        let nearest = Infinity;
        for (const p of placed) {
          if (sameNationOnly && p.it.nation !== g.it.nation) continue;
          const dx = Math.abs(p.it.x - g.it.x);
          const dy = Math.abs(p.it.y - g.it.y);
          if (dx >= (p.w + g.w) / 2 + pad || dy >= (p.h + g.h) / 2 + pad) continue;
          if (dx * dx + dy * dy < nearest) {
            nearest = dx * dx + dy * dy;
            hit = p;
          }
        }
        if (!hit) {
          placed.push(g);
          continue;
        }
        hit.total += g.total;
        for (const n of g.nations) hit.nations.add(n);
        hit.members.push(g.it.key, ...g.members);
        size(hit);
        merged = true;
      }
      free = placed;
    }
    return free;
  };
  const byKey = (a: Group, b: Group): number => (a.it.key < b.it.key ? -1 : 1);
  const own = items.map((it) => size({ it, total: it.strength, nations: new Set([it.nation]), members: [], w: 0, h: 0 })).sort((a, b) => b.total - a.total || byKey(a, b));
  const nations = settle(own, true).sort((a, b) => b.total - a.total || byKey(a, b));
  const lead = new Map<string, { lead: string; own: number }>();
  for (const g of nations) {
    lead.set(g.it.key, { lead: g.it.key, own: g.total });
    for (const k of g.members) lead.set(k, { lead: g.it.key, own: 0 });
  }
  const out = new Map<string, Fold>();
  for (const g of settle(nations, false)) {
    out.set(g.it.key, { into: null, total: g.total, others: g.nations.size - 1, ...lead.get(g.it.key)! });
    for (const k of g.members) out.set(k, { into: g.it.key, total: 0, others: 0, ...lead.get(k)! });
  }
  return out;
}

export class CounterLayer {
  level: number | null = null;
  private trans: { from: number; to: number; start: number } | null = null;
  /**
   * Per counter, its place in the declutter (PLAN 1.45b): folded into a neighbour or shown, since
   * `since`. A change is a fade in place over FOLD_MS: at rest a counter is shown in full or not
   * at all.
   */
  private folds = new Map<string, { folded: boolean; since: number }>();
  /** The counters of the last frame, in cells, with their fold state and the opacity it gave. */
  private last: { nation: number; x: number; y: number; state: { folded: boolean; since: number }; alpha: number }[] = [];
  /** When the latest fold or unfold began. */
  private foldStart = -Infinity;
  /** Counters drawn last frame (tests). */
  drawn: DrawnCounter[] = [];

  /** True while a split/merge or a fold animation runs (the view keeps redrawing). */
  animating(now: number): boolean {
    return (this.trans !== null && now - this.trans.start < SPLIT_MS + 50) || (now >= this.foldStart && now - this.foldStart < FOLD_MS + 50);
  }

  /**
   * Declutters `items` (already laid out, in cells) at `scale` px per cell and returns what to
   * draw at `now`: the shown counters with their totals, and those still fading out into a
   * neighbour or back in. `boxOf` as in `foldOverlaps`.
   */
  fold(
    items: readonly { key: string; c: Cluster; x: number; y: number }[],
    scale: number,
    now: number,
    boxOf: (total: number, others: number) => [number, number],
  ): { key: string; nation: number; x: number; y: number; alpha: number; strength: number; others: number }[] {
    // A clock that ran backwards (tests draw at made-up times) leaves a fade done.
    const progress = (since: number): number => (now < since ? 1 : Math.min(1, (now - since) / FOLD_MS));
    const near = (a: { x: number; y: number }, b: { x: number; y: number }): boolean => Math.abs(a.x - b.x) * scale <= INHERIT_PX && Math.abs(a.y - b.y) * scale <= INHERIT_PX;
    // At the end of a split or merge a cluster and its children swap in the same place, under
    // new keys. A counter with a new key takes over the state of the counter of its nation that
    // stood there, the most visible one: a fade goes on through the swap.
    const at = new Map(items.map((it) => [it.key, it]));
    const fresh = new Set<string>();
    for (const it of items) {
      if (this.folds.has(it.key)) continue;
      fresh.add(it.key);
      let heir: (typeof this.last)[number] | null = null;
      for (const o of this.last) if (o.nation === it.c.nation && near(o, it) && (!heir || o.alpha > heir.alpha)) heir = o;
      if (heir) this.folds.set(it.key, { ...heir.state });
    }
    for (const key of this.folds.keys()) if (!at.has(key)) this.folds.delete(key);
    const result = foldOverlaps(
      items.map((it) => ({ key: it.key, nation: it.c.nation, x: it.x * scale, y: it.y * scale, strength: it.c.strength })),
      boxOf,
      (key) => this.folds.get(key)?.folded === true,
    );
    const out: { key: string; nation: number; x: number; y: number; alpha: number; strength: number; others: number }[] = [];
    const seen: typeof this.last = [];
    let latest = -Infinity;
    for (const it of items) {
      const f = result.get(it.key)!;
      const folded = f.into !== null;
      const lead = f.lead !== it.key ? at.get(f.lead) : undefined;
      let st = this.folds.get(it.key);
      if (!st || (fresh.has(it.key) && lead !== undefined && near(lead, it))) {
        // A counter new to the map takes its place at once. So does a new one standing on the
        // counter of its nation that stands for them both (the children of a cluster, on its
        // centroid when a split begins): it is inside that one from the start.
        st = { folded, since: -Infinity };
      } else if (st.folded !== folded) {
        // A turn in mid-fade goes on from the opacity reached.
        st = { folded, since: now - (1 - progress(st.since)) * FOLD_MS };
      }
      this.folds.set(it.key, st);
      if (st.since <= now && st.since > latest) latest = st.since;
      const p = ease(progress(st.since));
      const alpha = st.folded ? 1 - p : p;
      seen.push({ nation: it.c.nation, x: it.x, y: it.y, state: st, alpha });
      if (alpha <= 0) continue; // folded: its strength is in its neighbour's number
      // A shown counter shows all it holds; one fading out, what it holds of its own nation.
      out.push({ key: it.key, nation: it.c.nation, x: it.x, y: it.y, alpha, strength: !folded ? f.total : f.lead === it.key ? f.own : it.c.strength, others: folded ? 0 : f.others });
    }
    this.last = seen;
    this.foldStart = latest;
    return out;
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
    if (items.length === 0) {
      // Nothing on the map: the next counters take their places at once.
      this.folds.clear();
      this.last = [];
      return;
    }
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.font = '700 10px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const widths = new Map<string, number>();
    const widthOf = (text: string): number => {
      let w = widths.get(text);
      if (w === undefined) widths.set(text, (w = Math.ceil(ctx.measureText(text).width)));
      return w;
    };
    const h = 14;
    // Flag chip, the strength, and "+n" for the other nations folded in.
    const boxWidth = (strength: number, others: number): number => widthOf(strengthText(strength)) + 18 + (others > 0 ? widthOf(`+${others}`) + BADGE_GAP : 0);
    const shown = this.fold(items, cam.scale, now, (total, others) => [boxWidth(total, others) * size, h * size]);
    const offs = wrapOffsets(cam, geo, vw);
    // Small first, so the big stacks stay on top.
    shown.sort((a, b) => a.strength - b.strength || (a.key < b.key ? -1 : 1));
    for (const it of shown) {
      const a = alpha * it.alpha;
      if (a <= 0.01) continue;
      const text = strengthText(it.strength);
      const w = boxWidth(it.strength, it.others);
      let box: [number, number] | null = null;
      for (const off of offs) {
        const [sx, sy] = worldToScreen(cam, it.x + off, it.y, vw, vh);
        const x = Math.round(sx - w / 2);
        const y = Math.round(sy - h / 2);
        if (sx - (w / 2) * size > vw || sy - (h / 2) * size > vh || sx + (w / 2) * size < 0 || sy + (h / 2) * size < 0) continue;
        box ??= [sx + (x - sx) * size, sy + (y - sy) * size];
        ctx.save();
        ctx.globalAlpha = a;
        if (size !== 1) {
          ctx.translate(sx, sy);
          ctx.scale(size, size);
          ctx.translate(-sx, -sy);
        }
        ctx.fillStyle = 'rgba(16, 18, 24, 0.85)';
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = colorOf(it.nation);
        ctx.fillRect(x + 1, y + 1, 12, h - 2);
        const flag = flagOf(it.nation);
        if (flag) ctx.drawImage(flag, x + 2, y + 3, 10, 8);
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.9)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
        ctx.fillStyle = '#ffe28a';
        ctx.fillText(text, x + 15, y + h / 2 + 0.5);
        if (it.others > 0) {
          ctx.fillStyle = '#b4bdcb';
          ctx.fillText(`+${it.others}`, x + 15 + widthOf(text) + BADGE_GAP, y + h / 2 + 0.5);
        }
        ctx.restore();
      }
      if (box) this.drawn.push({ key: it.key, nation: it.nation, wx: it.x, wy: it.y, alpha: a, strength: it.strength, text, others: it.others, x: box[0], y: box[1], w: w * size, h: h * size });
    }
    ctx.restore();
  }
}
