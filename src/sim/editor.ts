/**
 * Map editor (SPEC §9, PLAN 1.35): brush, line and bucket over the nation layer (owner and
 * controller together) or the terrain layer, optionally limited by a target mask (only cells of
 * one terrain or one nation), with a command-pattern undo/redo stack of cell diffs.
 *
 * Edits are commands, so they replay; the stack is state (saved) so a save plus its later
 * command log, which may contain undo/redo, replays exactly. The stack keeps at most UNDO_DEPTH
 * edits and UNDO_CELLS cells (oldest dropped first), except that the two newest edit groups are
 * always kept; a new edit clears the redo side.
 *
 * Terrain edits change land into land only (plains → forest, mountains …): water ↔ land also
 * needs the fine coastline regenerated and comes with map import (PLAN 1.37). The nation layer
 * paints land cells only.
 */
import { isLand, TERRAIN_IDS } from '../shared/terrain';
import { nearestCellWhere } from './data/ownership';
import { destroyFormation } from './systems/elements';
import { takeSection, type Section } from './core/sections';
import type { Stateful } from './core/state';
import { TILE, type World } from './world';

export const UNDO_DEPTH = 50;
/** ~5 MB of diffs at most in a save (review after PLAN 1.36: 2 M cells was ~20 MB). */
export const UNDO_CELLS = 500_000;
/** Largest brush radius in cells. */
export const MAX_BRUSH = 32;

export type EditLayer = 'nation' | 'terrain';
export type EditTool = 'brush' | 'line' | 'bucket';
export interface EditMask {
  kind: 'terrain' | 'nation';
  value: number;
}

/** One edit: the changed cells with their values before and after (owner layer: also controllers). */
export interface Edit {
  layer: EditLayer;
  cells: Uint32Array;
  before: Uint16Array;
  after: Uint16Array;
  /** Nation layer only: controllers before (after = `after`). */
  beforeCtl: Uint16Array | null;
  /** Applied (and undone) together with the edit below it on the stack (PLAN 1.37a imports). */
  linked?: boolean;
}

export class EditStack implements Stateful {
  undo: Edit[] = [];
  redo: Edit[] = [];
  /**
   * The top undo edit is the brush stroke in progress (PLAN 1.44): the stroke's next segment
   * grows that edit instead of pushing one. Any other change of the stack ends the stroke.
   */
  stroke = false;

  push(e: Edit): void {
    this.undo.push(e);
    this.redo = [];
    this.stroke = false;
    this.trim();
  }

  /** Adds `more` (same layer, as `paint` builds it) to the top edit: one undo step for both. */
  extend(more: Edit): void {
    const top = this.undo[this.undo.length - 1]!;
    const join = <T extends Uint16Array | Uint32Array>(a: T, b: T): T => {
      const out = new (a.constructor as new (n: number) => T)(a.length + b.length);
      out.set(a, 0);
      out.set(b, a.length);
      return out;
    };
    top.cells = join(top.cells, more.cells);
    top.before = join(top.before, more.before);
    top.after = join(top.after, more.after);
    if (top.beforeCtl && more.beforeCtl) top.beforeCtl = join(top.beforeCtl, more.beforeCtl);
    this.trim();
  }

  /** Drops the oldest edits beyond the caps. */
  private trim(): void {
    let cells = 0;
    for (const u of this.undo) cells += u.cells.length;
    // The cell cap never evicts the last two edit groups: a terrain import followed by a nation
    // import (each up to the whole map) stays undoable (PLAN 1.37a).
    const groups = (): number => this.undo.filter((u) => !u.linked).length;
    while (this.undo.length > UNDO_DEPTH || (cells > UNDO_CELLS && groups() > 2)) {
      cells -= this.undo.shift()!.cells.length;
      // Never keep half of a linked group: its base went, so it goes too.
      while (this.undo[0]?.linked) cells -= this.undo.shift()!.cells.length;
    }
  }

  serialize(): Section[] {
    // Metadata as JSON; cell data as typed sections in stack order (undo, then redo).
    const all = [...this.undo, ...this.redo];
    // `stroke` is written only while one is open, so a world without one keeps its bytes (and hash).
    const meta = { undo: this.undo.length, edits: all.map((e) => ({ layer: e.layer, n: e.cells.length, ctl: e.beforeCtl !== null, linked: e.linked === true })), ...(this.stroke ? { stroke: true } : {}) };
    const total = all.reduce((s, e) => s + e.cells.length, 0);
    const cells = new Uint32Array(total);
    const before = new Uint16Array(total);
    const after = new Uint16Array(total);
    const ctl = new Uint16Array(all.reduce((s, e) => s + (e.beforeCtl ? e.cells.length : 0), 0));
    let o = 0;
    let c = 0;
    for (const e of all) {
      cells.set(e.cells, o);
      before.set(e.before, o);
      after.set(e.after, o);
      o += e.cells.length;
      if (e.beforeCtl) {
        ctl.set(e.beforeCtl, c);
        c += e.beforeCtl.length;
      }
    }
    return [
      { name: 'edits.json', dtype: 'u8', data: new TextEncoder().encode(JSON.stringify(meta)) },
      { name: 'edits.cells', dtype: 'u32', data: cells },
      { name: 'edits.before', dtype: 'u16', data: before },
      { name: 'edits.after', dtype: 'u16', data: after },
      { name: 'edits.ctl', dtype: 'u16', data: ctl },
    ];
  }

  deserialize(sections: readonly Section[]): void {
    this.undo = [];
    this.redo = [];
    this.stroke = false;
    if (!sections.some((s) => s.name === 'edits.json')) return; // saves from before PLAN 1.35
    const meta = JSON.parse(new TextDecoder().decode(takeSection(sections, 'edits.json', 'u8'))) as { undo: number; edits: { layer: EditLayer; n: number; ctl: boolean; linked?: boolean }[]; stroke?: boolean };
    this.stroke = meta.stroke === true;
    const cells = takeSection(sections, 'edits.cells', 'u32');
    const before = takeSection(sections, 'edits.before', 'u16');
    const after = takeSection(sections, 'edits.after', 'u16');
    const ctl = takeSection(sections, 'edits.ctl', 'u16');
    let o = 0;
    let c = 0;
    meta.edits.forEach((m, i) => {
      const e: Edit = { layer: m.layer, cells: cells.slice(o, o + m.n), before: before.slice(o, o + m.n), after: after.slice(o, o + m.n), beforeCtl: m.ctl ? ctl.slice(c, c + m.n) : null };
      if (m.linked) e.linked = true;
      o += m.n;
      if (m.ctl) c += m.n;
      (i < meta.undo ? this.undo : this.redo).push(e);
    });
  }
}

/**
 * Cells within radius r of (x, y), clipped to the map. With `wrap` (the looping map,
 * `settings.loopingMap`) x goes over the seam; without, a column beyond an edge is no cell
 * (PLAN 3.12Rse2): the page sends the point under the pointer, which is beside the map where
 * the view is wider than a map with edges.
 */
export function brushCells(w: number, h: number, x: number, y: number, r: number, wrap: boolean): number[] {
  const rr = Math.max(0, Math.min(MAX_BRUSH, r));
  const out: number[] = [];
  const cx = Math.floor(x);
  const cy = Math.floor(y);
  const ri = Math.ceil(rr);
  for (let dy = -ri; dy <= ri; dy++) {
    const yy = cy + dy;
    if (yy < 0 || yy >= h) continue;
    for (let dx = -ri; dx <= ri; dx++) {
      if (dx * dx + dy * dy > rr * rr) continue;
      const xx = cx + dx;
      if (!wrap && (xx < 0 || xx >= w)) continue;
      out.push(yy * w + (((xx % w) + w) % w));
    }
  }
  return out;
}

/**
 * The brush stamped every cell along the segment (x0, y0) → (x1, y1). The segment is not folded:
 * it goes over the seam where an end is beyond an edge and the map wraps (`wrap`, as `brushCells`).
 */
export function lineCells(w: number, h: number, x0: number, y0: number, x1: number, y1: number, r: number, wrap: boolean): number[] {
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
  const seen = new Set<number>();
  for (let i = 0; i <= steps; i++) for (const c of brushCells(w, h, x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps, r, wrap)) seen.add(c);
  return [...seen].sort((a, b) => a - b);
}

/**
 * 4-connected flood fill from (x, y) over cells whose `layer` value equals the start cell's. On
 * a map that loops x wraps; on one that does not, the first and last columns are not neighbours
 * and a point beyond an edge fills nothing (PLAN 3.12Rse2).
 */
export function bucketCells(world: World, layer: EditLayer, x: number, y: number): number[] {
  const { w, h, owner, terrain } = world.cells;
  const wrap = world.settings.loopingMap;
  const fx = Math.floor(x);
  if (!wrap && (fx < 0 || fx >= w)) return [];
  const sx = ((fx % w) + w) % w;
  const sy = Math.floor(y);
  if (sy < 0 || sy >= h) return [];
  const start = sy * w + sx;
  const grid = layer === 'nation' ? owner : terrain;
  const v = grid[start]!;
  // The nation layer fills land only (an unowned start fills unowned land, not the sea).
  const ok = (c: number): boolean => grid[c] === v && (layer !== 'nation' || isLand(terrain[c]!));
  if (!ok(start)) return [];
  const seen = new Uint8Array(w * h);
  const out: number[] = [];
  const stack = [start];
  seen[start] = 1;
  while (stack.length > 0) {
    const c = stack.pop()!;
    out.push(c);
    const cx = c % w;
    const cy = (c - cx) / w;
    const ns = [wrap || cx < w - 1 ? cy * w + ((cx + 1) % w) : -1, wrap || cx > 0 ? cy * w + ((cx + w - 1) % w) : -1, cy > 0 ? c - w : -1, cy < h - 1 ? c + w : -1];
    for (const n of ns) {
      if (n < 0 || seen[n]) continue;
      seen[n] = 1;
      if (ok(n)) stack.push(n);
    }
  }
  return out.sort((a, b) => a - b);
}

function markDirty(world: World, c: number): void {
  const w = world.cells.w;
  const x = c % w;
  const y = (c - x) / w;
  world.out.dirtyTiles[Math.floor(y / TILE) * world.out.tilesX + Math.floor(x / TILE)] = 1;
}

/**
 * Terrain changed: everything derived from it is rebuilt on demand. Not the paths of the
 * formations on the march, which are state (PLAN 3.7k): the march finds a step that the new
 * ground does not allow when it comes to it (`movementSystem`).
 */
function terrainChanged(world: World): void {
  world.nav = null;
  world.frontier = null;
  world.supplyDirty = true;
  world.terrainVersion++;
}

/**
 * Paints `value` (a nation id, 0 = unowned; or a terrain class) with `tool`; returns the edit, or
 * null when nothing changed. The edit is pushed on the undo stack.
 *
 * `stroke` (PLAN 1.44): `start` opens a brush stroke, and `more` adds to the open stroke's edit
 * when it is of the same layer and value (else it opens the stroke anew), so a dragged stroke is
 * one undo step however many segments it took.
 */
export function paint(world: World, layer: EditLayer, tool: EditTool, x: number, y: number, x2: number, y2: number, r: number, value: number, mask: EditMask | null, stroke?: 'start' | 'more'): Edit | null {
  const { w, h, owner, controller, terrain } = world.cells;
  const st = world.edits;
  // Only `more` continues a stroke: every other paint, valid or not, ends the one in progress.
  const top = stroke === 'more' && st.stroke ? st.undo[st.undo.length - 1] : undefined;
  if (stroke !== 'more') st.stroke = false;
  if (layer === 'nation' && value !== 0 && !world.nations.has(value)) return null;
  if (layer === 'terrain' && !isLand(value)) return null;
  const wrap = world.settings.loopingMap;
  const shape = tool === 'brush' ? brushCells(w, h, x, y, r, wrap) : tool === 'line' ? lineCells(w, h, x, y, x2, y2, r, wrap) : bucketCells(world, layer, x, y);
  const cells = shape.filter((c) => {
    if (!isLand(terrain[c]!)) return false; // both layers: land cells only (no water ↔ land yet)
    if (mask && (mask.kind === 'terrain' ? terrain[c] !== mask.value : owner[c] !== mask.value)) return false;
    return layer === 'nation' ? owner[c] !== value || controller[c] !== value : terrain[c] !== value;
  });
  if (cells.length === 0) return null;
  const e: Edit = {
    layer,
    cells: Uint32Array.from(cells),
    before: Uint16Array.from(cells, (c) => (layer === 'nation' ? owner[c]! : terrain[c]!)),
    after: new Uint16Array(cells.length).fill(value),
    beforeCtl: layer === 'nation' ? Uint16Array.from(cells, (c) => controller[c]!) : null,
  };
  apply(world, e, false);
  if (top && top.layer === layer && top.after[0] === value) st.extend(e);
  else {
    st.push(e);
    st.stroke = stroke !== undefined;
  }
  return e;
}

/**
 * Applies an edit forward, or backward (`undo`). Backward runs from the last cell to the first:
 * a cell that a stroke lists twice (it changed under the stroke, by the running game) then ends
 * with the value it had before the stroke.
 *
 * A step holds the nations of the day it was made, and one of them may have died since (PLAN
 * 3.4Ri, ADR-146). A dead nation gets no cell: what the step says it owned goes to the living
 * nation the step says held it, as at a death, else to nobody; what it held goes to the owner.
 * The step itself stays as it was made: its nation may live again.
 */
function apply(world: World, e: Edit, undo: boolean): void {
  const terrain = world.cells.terrain;
  const alive = (v: number): boolean => v !== 0 && world.nations.cols.living[v] === 1;
  const n = e.cells.length;
  for (let k = 0; k < n; k++) {
    const i = undo ? n - 1 - k : k;
    const c = e.cells[i]!;
    if (e.layer === 'nation') {
      const k = undo ? e.beforeCtl![i]! : e.after[i]!;
      const ctl = alive(k) ? k : 0;
      const o = undo ? e.before[i]! : e.after[i]!;
      const own = alive(o) ? o : ctl;
      world.setOwner(c, own);
      // A step with no controller on a cell is written back so: only a dead one is replaced.
      world.setController(c, k === 0 || ctl !== 0 ? ctl : own);
    } else {
      terrain[c] = undo ? e.before[i]! : e.after[i]!;
      markDirty(world, c);
    }
  }
  if (e.layer === 'terrain') terrainChanged(world);
}

/**
 * Formations left on water by a terrain import march nowhere: they move to the nearest land cell
 * within STRANDED_REACH cells, or are removed (review in PLAN 1.41). Not part of the undo step.
 */
const STRANDED_REACH = 64;
function strandedToLand(world: World): void {
  const { w, h, terrain } = world.cells;
  const fc = world.formations.cols;
  const gone: number[] = [];
  world.formations.forEach((f) => {
    const c = Math.floor(fc.y[f]!) * w + Math.floor(fc.x[f]!);
    if (isLand(terrain[c]!)) return;
    const to = nearestCellWhere((i) => isLand(terrain[i]!), fc.x[f]!, fc.y[f]!, w, h, STRANDED_REACH, world.settings.loopingMap);
    if (to < 0) {
      gone.push(f);
      return;
    }
    [fc.x[f], fc.y[f]] = world.cellPoint(to);
    world.paths.delete(f);
    fc.moving[f] = 0;
    fc.home[f] = 0;
  });
  for (const f of gone) destroyFormation(world, f);
}

/** Undoes the top edit, with the edits linked to it (newest first). */
export function undoEdit(world: World): boolean {
  const st = world.edits;
  st.stroke = false;
  if (st.undo.length === 0) return false;
  for (;;) {
    const e = st.undo.pop()!;
    apply(world, e, true);
    st.redo.push(e);
    if (!e.linked || st.undo.length === 0) break;
  }
  return true;
}

/** Redoes the top undone edit, then the edits linked to it (oldest first). */
export function redoEdit(world: World): boolean {
  const st = world.edits;
  st.stroke = false;
  if (st.redo.length === 0) return false;
  do {
    const e = st.redo.pop()!;
    apply(world, e, false);
    st.undo.push(e);
  } while (st.redo.length > 0 && st.redo[st.redo.length - 1]!.linked);
  return true;
}

/**
 * Imports a whole layer (PLAN 1.37a; values per cell from `paletteMap`): terrain may turn water
 * into land and back, and cells that become water lose their owner and controller (a linked
 * edit); nations paint land cells only, unknown ids and dead nations as unowned. One undo step. Returns the
 * number of changed cells.
 */
export function importLayer(world: World, layer: EditLayer, values: Uint16Array): number {
  const { owner, controller, terrain } = world.cells;
  if (values.length !== terrain.length) return 0;
  const living = (v: number): boolean => v !== 0 && world.nations.has(v) && world.nations.cols.living[v] === 1;
  const cells: number[] = [];
  // City cells keep their land (a city becomes an island, never drowns: review in PLAN 1.41).
  const cityCells = new Set<number>();
  world.cities.forEach((id) => cityCells.add(world.cities.cols.cell[id]!));
  for (let c = 0; c < values.length; c++) {
    const v = values[c]!;
    if (layer === 'terrain') {
      if (v < TERRAIN_IDS.length && terrain[c] !== v && !(cityCells.has(c) && !isLand(v))) cells.push(c);
    } else {
      const n = living(v) ? v : 0;
      if (isLand(terrain[c]!) && (owner[c] !== n || controller[c] !== n)) cells.push(c);
    }
  }
  if (cells.length === 0) return 0;
  const valueOf = (c: number): number => (layer === 'nation' ? (living(values[c]!) ? values[c]! : 0) : values[c]!);
  const e: Edit = {
    layer,
    cells: Uint32Array.from(cells),
    before: Uint16Array.from(cells, (c) => (layer === 'nation' ? owner[c]! : terrain[c]!)),
    after: Uint16Array.from(cells, valueOf),
    beforeCtl: layer === 'nation' ? Uint16Array.from(cells, (c) => controller[c]!) : null,
  };
  apply(world, e, false);
  world.edits.push(e);
  if (layer === 'terrain') {
    // New water holds no nation.
    const wet = cells.filter((c) => !isLand(terrain[c]!) && (owner[c] !== 0 || controller[c] !== 0));
    if (wet.length > 0) {
      const clear: Edit = { layer: 'nation', cells: Uint32Array.from(wet), before: Uint16Array.from(wet, (c) => owner[c]!), after: new Uint16Array(wet.length), beforeCtl: Uint16Array.from(wet, (c) => controller[c]!), linked: true };
      apply(world, clear, false);
      world.edits.undo.push(clear); // after push(e): the redo side is already clear
    }
    strandedToLand(world);
  }
  return cells.length;
}
