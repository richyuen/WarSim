/**
 * Starting order of battle (PLAN 1.7, SPEC §3.6): formation groups from
 * `data/scenarios/<id>/oob.json` placed on the map, with strengths from their templates.
 *
 * Placement: a nation may deploy on cells it controls, or on cells owned and controlled by one
 * of its puppets (the Kwantung Army stands in Manchukuo). A group starts at the allowed cell
 * nearest its anchor (within ANCHOR_REACH_CELLS) and floods outward over allowed land (4-way BFS),
 * taking cells that are not 8-adjacent to an already used cell. When the reachable area runs out,
 * formations stack onto the used cells in order. Deterministic: no RNG, fixed visit order.
 */
import { Terrain } from '../../shared/terrain';
import { nearestCellWhere } from './ownership';
import { cellOf } from './terrain';

export interface TemplateDef {
  id: string;
  elements: readonly { type: string; count: number }[];
}

export interface UnitTypeLite {
  id: string;
  class: string;
  domain: string;
  elementSize: number;
  cost: { manpower: number };
}

export interface OobGroup {
  nation: string;
  template: string;
  count: number;
  at: readonly [number, number];
}

export interface FormationStrength {
  /** Personnel (Σ element manpower). */
  men: number;
  /** Tanks (armour-class elements × element size). */
  tanks: number;
  /** Guns (artillery, AT and AA elements × element size). */
  guns: number;
  elements: number;
}

export interface PlacedFormation {
  nation: number;
  template: string;
  /** Position in cells (cell centre + a fixed sub-cell offset). */
  x: number;
  y: number;
  cell: number;
  /** Index of the source group. */
  group: number;
}

export const ANCHOR_REACH_CELLS = 12;
const ARMOR = new Set(['armor_l', 'armor_m', 'armor_h']);
const GUNS = new Set(['art', 'at', 'aa']);

export function templateStrength(t: TemplateDef, types: ReadonlyMap<string, UnitTypeLite>): FormationStrength {
  const s: FormationStrength = { men: 0, tanks: 0, guns: 0, elements: 0 };
  for (const e of t.elements) {
    const u = types.get(e.type);
    if (!u) throw new Error(`template ${t.id}: unknown unit type ${e.type}`);
    s.men += u.cost.manpower * e.count;
    s.elements += e.count;
    if (ARMOR.has(u.class)) s.tanks += u.elementSize * e.count;
    if (GUNS.has(u.class)) s.guns += u.elementSize * e.count;
  }
  return s;
}

export interface OobInput {
  w: number;
  h: number;
  owner: Uint16Array;
  controller: Uint16Array;
  terrain: Uint8Array;
  tags: readonly string[];
  /** Overlord tag per nation tag (puppets). */
  overlordOf: ReadonlyMap<string, string>;
  groups: readonly OobGroup[];
}

export interface OobResult {
  formations: PlacedFormation[];
  /** Groups whose anchor had no allowed cell within reach (by index). */
  unplaced: number[];
  /** Cells stacked with more than one formation, per group (diagnostics). */
  stacked: number;
}

export function placeOob(inp: OobInput): OobResult {
  const { w, h, owner, controller, terrain, tags } = inp;
  const idOf = new Map(tags.map((t, i) => [t, i + 1]));
  const puppets = new Map<number, Set<number>>();
  for (const [p, o] of inp.overlordOf) {
    const oi = idOf.get(o);
    const pi = idOf.get(p);
    if (oi === undefined || pi === undefined) continue;
    if (!puppets.has(oi)) puppets.set(oi, new Set());
    puppets.get(oi)!.add(pi);
  }
  const used = new Uint8Array(w * h);
  const formations: PlacedFormation[] = [];
  const unplaced: number[] = [];
  let stacked = 0;
  inp.groups.forEach((g, gi) => {
    const nation = idOf.get(g.nation) ?? 0;
    const mine = puppets.get(nation);
    const allowed = (c: number): boolean =>
      terrain[c]! >= Terrain.Plains && (controller[c] === nation || (mine !== undefined && mine.has(owner[c]!) && controller[c] === owner[c]));
    const [ax, ay] = cellOf(g.at[0], g.at[1], w, h);
    const start = nearestCellWhere(allowed, ax, ay, w, h, ANCHOR_REACH_CELLS, true);
    if (start < 0 || nation === 0) {
      unplaced.push(gi);
      return;
    }
    // Flood from the anchor; take spaced cells, then stack on the taken ones.
    const taken: number[] = [];
    const seen = new Uint8Array(w * h);
    const queue = [start];
    seen[start] = 1;
    for (let qi = 0; qi < queue.length && taken.length < g.count; qi++) {
      const c = queue[qi]!;
      if (!crowded(used, c, w, h)) {
        taken.push(c);
        used[c] = 1;
      }
      const x = c % w;
      const y = (c - x) / w;
      for (const n of [y > 0 ? c - w : -1, y < h - 1 ? c + w : -1, y * w + ((x + w - 1) % w), y * w + ((x + 1) % w)]) {
        if (n >= 0 && !seen[n] && allowed(n)) {
          seen[n] = 1;
          queue.push(n);
        }
      }
    }
    for (let k = 0; k < g.count; k++) {
      const cell = taken.length > 0 ? taken[k % taken.length]! : start;
      if (k >= taken.length) stacked++;
      const cx = cell % w;
      const cy = (cell - cx) / w;
      // Fixed sub-cell offset (golden-ratio sequence) so stacked formations do not coincide.
      const ox = 0.2 + 0.6 * ((k * 0.6180339887) % 1);
      const oy = 0.2 + 0.6 * ((k * 0.7548776662) % 1);
      formations.push({ nation, template: g.template, x: cx + ox, y: cy + oy, cell, group: gi });
    }
  });
  return { formations, unplaced, stacked };
}

/** True when the cell or one of its 8 neighbours is already used. */
function crowded(used: Uint8Array, c: number, w: number, h: number): boolean {
  const x = c % w;
  const y = (c - x) / w;
  for (let dy = -1; dy <= 1; dy++) {
    const yy = y + dy;
    if (yy < 0 || yy >= h) continue;
    for (let dx = -1; dx <= 1; dx++) if (used[yy * w + ((x + dx + w) % w)]) return true;
  }
  return false;
}
