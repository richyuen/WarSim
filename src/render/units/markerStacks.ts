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
 * must not go in and out.
 *
 * What is then still on each other, markers of two nations that face each other across a front
 * at the far end of T1 (a cell is 10 px there and a marker 26), moves apart (PLAN 2.7s2): each
 * box by a few px, never further than `NUDGE_MAX_PX` from its formation, until neither is more
 * than a quarter under the other. A box keeps its move while it is needed, and eases to a new
 * one over NUDGE_MS.
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

/**
 * How far each of the shown markers `items` (boxes `w` × `h` at their centres) stands from its
 * formation so that none is more than STACK_UNDER under another: [dx, dy] by id, in px.
 * - A pair that is too much on each other moves apart by half each, along the axis that needs
 *   the shorter move; no box further than NUDGE_MAX_PX from its formation.
 * - `before`: the moves of the frame before. A box starts from its move and keeps it while it
 *   still serves; a box that touches no other where its formation stands goes back there.
 */
export function nudgeApart(items: readonly StackItem[], w: number, h: number, before: ReadonlyMap<number, readonly [number, number]> = new Map()): Map<number, [number, number]> {
  const out = new Map<number, [number, number]>();
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
  const neighbours = (it: StackItem): StackItem[] => {
    const near: StackItem[] = [];
    for (let dx = -span; dx <= span; dx++)
      for (let dy = -span; dy <= span; dy++) for (const o of cells.get(cellOf(it.x + dx * w, it.y + dy * h)) ?? []) if (o.id !== it.id && Math.abs(o.x - it.x) < reach && Math.abs(o.y - it.y) < h + 2 * NUDGE_MAX_PX) near.push(o);
    return near;
  };
  const near = new Map<number, StackItem[]>();
  for (const it of items) {
    const n = neighbours(it);
    near.set(it.id, n);
    // On no other box where its formation stands: it stands there.
    const alone = !n.some((o) => shareUnder(it, o, w, h) > 0);
    const b = before.get(it.id);
    out.set(it.id, alone || !b ? [0, 0] : [b[0], b[1]]);
  }
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
        const needX = ox - area / oy;
        const needY = oy - area / ox;
        const [oa, ob] = [out.get(a.id)!, out.get(b.id)!];
        if (needX <= needY) {
          const s = pa.x < pb.x || (pa.x === pb.x && a.id < b.id) ? -1 : 1;
          oa[0] += (s * needX) / 2;
          ob[0] -= (s * needX) / 2;
        } else {
          const s = pa.y < pb.y || (pa.y === pb.y && a.id < b.id) ? -1 : 1;
          oa[1] += (s * needY) / 2;
          ob[1] -= (s * needY) / 2;
        }
        clamp(oa);
        clamp(ob);
      }
    }
    if (!any) break;
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
  /** The move of each shown box: from where to where, since when. */
  private moves = new Map<number, { from: [number, number]; to: [number, number]; start: number }>();
  private moved = -Infinity;
  private zoom = NaN;

  /**
   * The markers of a frame at `now`.
   * - `still`: the boxes keep the moves they have (the morph into T2 shrinks each box about its
   *   place: ADR-72).
   * - `zoom`: the camera's scale. A box keeps its move from frame to frame while the armies
   *   move under a camera at rest. At another zoom the moves are found afresh, so that what
   *   stands at rest after a zoom does not depend on the frames of the way there (ADR-75's
   *   lesson); they are small, and a box eases to its new one.
   */
  frame(items: readonly StackItem[], w: number, h: number, now: number, still = false, zoom = 1): Map<number, StackedMarker> {
    this.shown.frame(now);
    const stacks = stackMarkers(items, w, h, (id) => this.inStack.has(id));
    const leads = items.filter((it) => stacks.get(it.id)!.into === null);
    const before = new Map<number, [number, number]>();
    for (const it of leads) {
      const m = this.moves.get(it.id);
      if (m) before.set(it.id, m.to);
    }
    const to = still ? before : nudgeApart(leads, w, h, zoom === this.zoom ? before : undefined);
    this.zoom = zoom;
    const moves = new Map<number, { from: [number, number]; to: [number, number]; start: number }>();
    const out = new Map<number, StackedMarker>();
    const inStack = new Set<number>();
    for (const it of items) {
      const s = stacks.get(it.id)!;
      let at: [number, number] = [0, 0];
      if (s.into !== null) inStack.add(it.id);
      else {
        const want = to.get(it.id) ?? [0, 0];
        let m = this.moves.get(it.id);
        const eased = (v: { from: [number, number]; to: [number, number]; start: number }): [number, number] => {
          const p = smooth(progress(now, v.start, NUDGE_MS));
          return [v.from[0] + (v.to[0] - v.from[0]) * p, v.from[1] + (v.to[1] - v.from[1]) * p];
        };
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
      out.set(it.id, { alpha: this.shown.value(it.id, s.into === null), strength: s.into === null ? s.total : it.strength, members: s.members, dx: at[0], dy: at[1] });
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
