/**
 * Stacks of T1 markers (PLAN 2.7s1): markers of one nation that stand on each other are one
 * marker. Formations of a nation often stand on one spot, and their markers, each on its
 * formation's centre, covered each other's numbers.
 *
 * A marker that is more than `STACK_UNDER` of its box under a stronger marker of its nation goes
 * into that one: the stronger shows the men of all it stands for, and how many they are.
 * Nothing is dropped: every formation is stood for by one marker. Markers of two nations are
 * never stacked: who faces whom is what this tier shows.
 *
 * A change is a fade in place over FADE_MS, and a marker in a stack stays there until it is
 * under its lead by less than `STACK_HOLD`: the armies move every tick, and a marker at the edge
 * must not go in and out. In place: a box that stood off its formation (below) fades there
 * (PLAN 2.7w).
 *
 * What is then still on each other, markers of two nations that face each other across a front
 * at the far end of T1 (a cell is 10 px there and a marker 26), moves apart (PLAN 2.7s2): each
 * box by a few px, never further than `NUDGE_MAX_PX` from its formation, until neither is more
 * than a quarter under the other. Where the boxes stand is a function of where the formations
 * stand and of nothing else (PLAN 2.7v); a box eases to a new place over NUDGE_MS.
 */
import { FADE_MS, progress, running, smooth, SwitchBank } from '../timing';

/** A marker for stacking: its centre in px (cells × scale: the camera's place does not matter) and what it holds. */
export interface StackItem {
  id: number;
  nation: number;
  x: number;
  y: number;
  strength: number;
}

/** A marker after stacking. */
export interface Stack {
  /** The marker this one is in; null: it is shown. */
  into: number | null;
  /** Shown markers: the men of all they stand for, and those formations (itself first). */
  total: number;
  members: number[];
}

/** More than this share of its box under a stronger marker of its nation: it goes into that one. */
export const STACK_UNDER = 0.25;
/** A marker in a stack comes out once it is under its lead by less than this share. */
export const STACK_HOLD = 0.1;

/** The share of a box `w` × `h` at centre `a` that lies under one at centre `b`. */
export function shareUnder(a: { x: number; y: number }, b: { x: number; y: number }, w: number, h: number): number {
  const ox = w - Math.abs(a.x - b.x);
  const oy = h - Math.abs(a.y - b.y);
  return ox <= 0 || oy <= 0 ? 0 : (ox * oy) / (w * h);
}

/**
 * Stacks `items`, whose boxes are `w` × `h` px. The strongest first: a marker goes into the
 * shown marker of its nation that it is most under, when that is more than STACK_UNDER (more
 * than STACK_HOLD for one that `held`: it is in a stack already). A stack's box does not grow,
 * so one pass settles it.
 */
export function stackMarkers(items: readonly StackItem[], w: number, h: number, held: (id: number) => boolean = () => false): Map<number, Stack> {
  const out = new Map<number, Stack>();
  // The shown markers by the cell of a grid of boxes: a marker can only be under one in its own
  // cell or a neighbouring one. Every formation of the world is here, in every frame at T1: for
  // the 1,054 of the 1938 start this is 0.4 ms (0.5 ms against every shown marker, and that
  // grows with the square of their number).
  const leads = new Map<number, StackItem[]>();
  const cellOf = (x: number, y: number): number => (Math.floor(x / w) + 0x8000) * 0x10000 + Math.floor(y / h) + 0x8000;
  for (const it of [...items].sort((a, b) => b.strength - a.strength || a.id - b.id)) {
    const limit = held(it.id) ? STACK_HOLD : STACK_UNDER;
    let lead: StackItem | null = null;
    let most = limit;
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++)
        for (const l of leads.get(cellOf(it.x + dx * w, it.y + dy * h)) ?? []) {
          if (l.nation !== it.nation) continue;
          const share = shareUnder(it, l, w, h);
          // The most under; of two it is as much under, the stronger (they come in that order).
          if (share > most) {
            most = share;
            lead = l;
          }
        }
    if (!lead) {
      const cell = cellOf(it.x, it.y);
      const there = leads.get(cell);
      if (there) there.push(it);
      else leads.set(cell, [it]);
      out.set(it.id, { into: null, total: it.strength, members: [it.id] });
      continue;
    }
    const s = out.get(lead.id)!;
    s.total += it.strength;
    s.members.push(it.id);
    out.set(it.id, { into: lead.id, total: 0, members: [] });
  }
  return out;
}

/** No shown box is moved further than this from its formation, px. */
export const NUDGE_MAX_PX = 6;
/** A box eases to a new place over this long. */
export const NUDGE_MS = 150;
/** Boxes are moved until neither is under the other by more than this (a little under the quarter, for room). */
const NUDGE_TO = 0.24;

/** The markers that a move of at most NUDGE_MAX_PX each could bring onto each one of `items`, by id. */
function withinReach(items: readonly StackItem[], w: number, h: number): Map<number, StackItem[]> {
  // By the cell of a grid of boxes, where the formations stand: a box moved by at most
  // NUDGE_MAX_PX can only meet one from its own cell or a neighbouring one.
  const cells = new Map<number, StackItem[]>();
  const cellOf = (x: number, y: number): number => (Math.floor(x / w) + 0x8000) * 0x10000 + Math.floor(y / h) + 0x8000;
  for (const it of items) {
    const there = cells.get(cellOf(it.x, it.y));
    if (there) there.push(it);
    else cells.set(cellOf(it.x, it.y), [it]);
  }
  const reach = w + 2 * NUDGE_MAX_PX;
  const span = Math.ceil(reach / w);
  const near = new Map<number, StackItem[]>();
  for (const it of items) {
    const list: StackItem[] = [];
    for (let dx = -span; dx <= span; dx++)
      for (let dy = -span; dy <= span; dy++) for (const o of cells.get(cellOf(it.x + dx * w, it.y + dy * h)) ?? []) if (o.id !== it.id && Math.abs(o.x - it.x) < reach && Math.abs(o.y - it.y) < h + 2 * NUDGE_MAX_PX) list.push(o);
    near.set(it.id, list);
  }
  return near;
}

/**
 * The way a pair that is too much on each other moves apart.
 * - `shorter`: along x or along y, whichever needs the shorter move.
 * - `between`: along the line between the two centres.
 */
export type PartingWay = 'shorter' | 'between';

/**
 * The moves of `items` by one way: every pair that is more than STACK_UNDER on each other moves
 * apart by half each, to NUDGE_TO; no box further than NUDGE_MAX_PX from its formation. Every
 * box starts on its formation. `near`: `withinReach` of these items or of more.
 */
export function partAlong(items: readonly StackItem[], w: number, h: number, way: PartingWay, near: ReadonlyMap<number, readonly StackItem[]> = withinReach(items, w, h)): Map<number, [number, number]> {
  const out = new Map<number, [number, number]>();
  for (const it of items) out.set(it.id, [0, 0]);
  const at = (it: StackItem): { x: number; y: number } => {
    const o = out.get(it.id)!;
    return { x: it.x + o[0], y: it.y + o[1] };
  };
  const clamp = (o: [number, number]): void => {
    const d = Math.hypot(o[0], o[1]);
    if (d > NUDGE_MAX_PX) {
      o[0] *= NUDGE_MAX_PX / d;
      o[1] *= NUDGE_MAX_PX / d;
    }
  };
  for (let round = 0; round < 8; round++) {
    let any = false;
    for (const a of items) {
      for (const b of near.get(a.id)!) {
        if (b.id < a.id) continue; // each pair once
        const [pa, pb] = [at(a), at(b)];
        if (shareUnder(pa, pb, w, h) <= STACK_UNDER) continue;
        any = true;
        const ox = w - Math.abs(pa.x - pb.x);
        const oy = h - Math.abs(pa.y - pb.y);
        const area = NUDGE_TO * w * h;
        const [oa, ob] = [out.get(a.id)!, out.get(b.id)!];
        const sx = pa.x < pb.x || (pa.x === pb.x && a.id < b.id) ? -1 : 1;
        const sy = pa.y < pb.y || (pa.y === pb.y && a.id < b.id) ? -1 : 1;
        if (way === 'shorter') {
          const needX = ox - area / oy;
          const needY = oy - area / ox;
          if (needX <= needY) {
            oa[0] += (sx * needX) / 2;
            ob[0] -= (sx * needX) / 2;
          } else {
            oa[1] += (sy * needY) / 2;
            ob[1] -= (sy * needY) / 2;
          }
        } else {
          // The step t along the unit vector (ux, uy) between the centres (two on one spot:
          // along x) that leaves `area` under: (ox − t ux)(oy − t uy) = area, the lesser root.
          const len = Math.hypot(pa.x - pb.x, pa.y - pb.y);
          const ux = len > 0 ? Math.abs(pa.x - pb.x) / len : 1;
          const uy = len > 0 ? Math.abs(pa.y - pb.y) / len : 0;
          const qa = ux * uy;
          const qb = ox * uy + oy * ux;
          const qc = ox * oy - area;
          const t = qa < 1e-9 ? qc / qb : (qb - Math.sqrt(qb * qb - 4 * qa * qc)) / (2 * qa);
          oa[0] += (sx * t * ux) / 2;
          ob[0] -= (sx * t * ux) / 2;
          oa[1] += (sy * t * uy) / 2;
          ob[1] -= (sy * t * uy) / 2;
        }
        clamp(oa);
        clamp(ob);
      }
    }
    if (!any) break;
  }
  return out;
}

/**
 * How far each of the shown markers `items` (boxes `w` × `h` at their centres) stands from its
 * formation so that none is more than STACK_UNDER under another: [dx, dy] by id, in px.
 * - A pair that is too much on each other moves apart by half each, along the axis that needs
 *   the shorter move; no box further than NUDGE_MAX_PX from its formation.
 * - Every box starts on its formation, in every call: the same markers give the same moves.
 *   (It started from the moves of the frame before, so that a box kept its move while it
 *   served. Three markers crowded beyond what the limit can part then never came to rest: fed
 *   its own result, the passes below went round a cycle, and the view drew for ever. PLAN 2.7v.)
 *   Where the limit leaves boxes on each other, they are left so.
 * - Where the shorter way leaves boxes on each other, the group of markers within reach of
 *   each other that they are in is parted along the lines between the centres instead, if
 *   that leaves less on each other (PLAN 3.5h). A chain of boxes that falls across the screen
 *   moved along x alone, pair by pair, until its ends stood at the limit with pairs in its
 *   middle still on each other; along the lines between them each box uses its 6 px both ways.
 *   The groups the shorter way parts stand as before.
 */
export function nudgeApart(items: readonly StackItem[], w: number, h: number): Map<number, [number, number]> {
  const near = withinReach(items, w, h);
  const out = partAlong(items, w, h, 'shorter', near);
  /** By how much the pairs among `group` are over the quarter, summed, with the moves `moves`. */
  const over = (group: readonly StackItem[], moves: Map<number, [number, number]>): number => {
    let sum = 0;
    for (const a of group) {
      const oa = moves.get(a.id)!;
      for (const b of near.get(a.id)!) {
        if (b.id < a.id) continue;
        const ob = moves.get(b.id)!;
        sum += Math.max(0, shareUnder({ x: a.x + oa[0], y: a.y + oa[1] }, { x: b.x + ob[0], y: b.y + ob[1] }, w, h) - STACK_UNDER);
      }
    }
    return sum;
  };
  const seen = new Set<number>();
  for (const first of items) {
    if (seen.has(first.id) || over([first], out) === 0) continue;
    // The group: every marker within reach of one in it. No move outside it can touch it.
    const group = [first];
    seen.add(first.id);
    for (let i = 0; i < group.length; i++)
      for (const o of near.get(group[i]!.id)!)
        if (!seen.has(o.id)) {
          seen.add(o.id);
          group.push(o);
        }
    // By id: the same markers give the same moves, however the group was found.
    group.sort((a, b) => a.id - b.id);
    const other = partAlong(group, w, h, 'between', near);
    if (over(group, other) < over(group, out)) for (const it of group) out.set(it.id, other.get(it.id)!);
  }
  return out;
}

/** A marker in a frame: its opacity in the stacking, the number it shows and what it stands for. */
export interface StackedMarker {
  /** 1 shown, 0 in a stack; between while it goes in or comes out. */
  alpha: number;
  /** Shown: the men of all it stands for. In a stack, or on its way in: its own. */
  strength: number;
  /** The formations a shown marker stands for, itself first (one: no stack). Empty for one in a stack. */
  members: number[];
  /** How far its box stands from its formation in this frame, px (PLAN 2.7s2). */
  dx: number;
  dy: number;
}

/**
 * The stacks over time: which markers are in one, and the fade of a change. A marker new to the
 * view takes its place at once.
 */
export class MarkerStacks {
  private readonly shown = new SwitchBank<number>(FADE_MS);
  private inStack = new Set<number>();
  /**
   * The move of each box that is drawn: from where to where, since when. A box that fades into
   * a stack keeps the place it had, for as long as anything of it shows.
   */
  private moves = new Map<number, { from: [number, number]; to: [number, number]; start: number }>();
  private moved = -Infinity;

  /**
   * The markers of a frame at `now`. `still`: the boxes keep the moves they have (the morph into
   * T2 shrinks each box about its place, and the one back grows it there: ADR-72); a box with
   * none stands where it will rest.
   */
  frame(items: readonly StackItem[], w: number, h: number, now: number, still = false): Map<number, StackedMarker> {
    this.shown.frame(now);
    const stacks = stackMarkers(items, w, h, (id) => this.inStack.has(id));
    const leads = items.filter((it) => stacks.get(it.id)!.into === null);
    let to: Map<number, [number, number]>;
    if (still) {
      // A box with no move to keep stands where it will rest. On the way back from T2 that is
      // every box: the layer was cleared there. (They stood on their formations for the whole
      // morph, markers of two nations on each other, and eased apart when it ended: PLAN 2.7z.)
      let rest: Map<number, [number, number]> | null = null;
      to = new Map();
      for (const it of leads) {
        const m = this.moves.get(it.id);
        to.set(it.id, m ? m.to : ((rest ??= nudgeApart(leads, w, h)).get(it.id) ?? [0, 0]));
      }
    } else to = nudgeApart(leads, w, h);
    const moves = new Map<number, { from: [number, number]; to: [number, number]; start: number }>();
    const out = new Map<number, StackedMarker>();
    const inStack = new Set<number>();
    const eased = (v: { from: [number, number]; to: [number, number]; start: number }): [number, number] => {
      const p = smooth(progress(now, v.start, NUDGE_MS));
      return [v.from[0] + (v.to[0] - v.from[0]) * p, v.from[1] + (v.to[1] - v.from[1]) * p];
    };
    for (const it of items) {
      const s = stacks.get(it.id)!;
      const alpha = this.shown.value(it.id, s.into === null);
      let at: [number, number] = [0, 0];
      let m = this.moves.get(it.id);
      if (s.into !== null) {
        inStack.add(it.id);
        // On its way in: the box stays where it is drawn until nothing of it shows (it stood on
        // its formation in the frame it went in, and jumped there: PLAN 2.7w). Then it has no
        // place: one that comes out later is new among the shown.
        if (m && alpha > 0) {
          at = eased(m);
          moves.set(it.id, { from: at, to: at, start: -Infinity });
        }
      } else {
        const want = to.get(it.id) ?? [0, 0];
        // A marker new among the shown stands where it should at once; a new move starts from where the box is.
        if (!m) m = { from: want, to: want, start: -Infinity };
        else if (Math.abs(m.to[0] - want[0]) > 0.01 || Math.abs(m.to[1] - want[1]) > 0.01) {
          m = { from: eased(m), to: want, start: now };
          this.moved = now;
        }
        moves.set(it.id, m);
        at = eased(m);
      }
      // The lead shows the sum at once; one on its way in shows its own number where it stands.
      out.set(it.id, { alpha, strength: s.into === null ? s.total : it.strength, members: s.members, dx: at[0], dy: at[1] });
    }
    this.shown.end();
    this.inStack = inStack;
    this.moves = moves;
    return out;
  }

  /** True while a marker goes into a stack or comes out of one, or a box moves (the view keeps redrawing). */
  animating(now: number): boolean {
    return this.shown.animating(now) || running(now, this.moved, NUDGE_MS);
  }

  /** No markers are drawn: the next ones take their places at once. */
  clear(): void {
    this.shown.clear();
    this.inStack.clear();
    this.moves.clear();
  }
}
