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
 */
import { FADE_MS, SwitchBank } from '../timing';

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

/** A marker in a frame: its opacity in the stacking, the number it shows and what it stands for. */
export interface StackedMarker {
  /** 1 shown, 0 in a stack; between while it goes in or comes out. */
  alpha: number;
  /** Shown: the men of all it stands for. In a stack, or on its way in: its own. */
  strength: number;
  /** The formations a shown marker stands for, itself first (one: no stack). Empty for one in a stack. */
  members: number[];
}

/**
 * The stacks over time: which markers are in one, and the fade of a change. A marker new to the
 * view takes its place at once.
 */
export class MarkerStacks {
  private readonly shown = new SwitchBank<number>(FADE_MS);
  private inStack = new Set<number>();

  /** The markers of a frame at `now`. */
  frame(items: readonly StackItem[], w: number, h: number, now: number): Map<number, StackedMarker> {
    this.shown.frame(now);
    const stacks = stackMarkers(items, w, h, (id) => this.inStack.has(id));
    const out = new Map<number, StackedMarker>();
    const inStack = new Set<number>();
    for (const it of items) {
      const s = stacks.get(it.id)!;
      if (s.into !== null) inStack.add(it.id);
      // The lead shows the sum at once; one on its way in shows its own number where it stands.
      out.set(it.id, { alpha: this.shown.value(it.id, s.into === null), strength: s.into === null ? s.total : it.strength, members: s.members });
    }
    this.shown.end();
    this.inStack = inStack;
    return out;
  }

  /** True while a marker goes into a stack or comes out of one (the view keeps redrawing). */
  animating(now: number): boolean {
    return this.shown.animating(now);
  }

  /** No markers are drawn: the next ones take their places at once. */
  clear(): void {
    this.shown.clear();
    this.inStack.clear();
  }
}
