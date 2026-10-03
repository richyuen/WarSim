/**
 * Map editor (SPEC §9, PLAN 1.35): brush, line and bucket over the nation layer (owner and
 * controller together) or the terrain layer, optionally limited by a target mask (only cells of
 * one terrain or one nation), with a command-pattern undo/redo stack of cell diffs.
 *
 * Edits are commands, so they replay; the stack is state (saved) so a save plus its later
 * command log, which may contain undo/redo, replays exactly. The stack keeps at most UNDO_DEPTH
 * edits and UNDO_CELLS cells (oldest dropped first); a new edit clears the redo side.
 *
 * Terrain edits change land into land only (plains → forest, mountains …): water ↔ land also
 * needs the fine coastline regenerated and comes with map import (PLAN 1.37). The nation layer
 * paints land cells only.
 */
import { isLand } from '../shared/terrain';
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
}

export class EditStack implements Stateful {
  undo: Edit[] = [];
  redo: Edit[] = [];

  push(e: Edit): void {
    this.undo.push(e);
    this.redo = [];
    let cells = 0;
    for (const u of this.undo) cells += u.cells.length;
    while (this.undo.length > UNDO_DEPTH || (cells > UNDO_CELLS && this.undo.length > 1)) cells -= this.undo.shift()!.cells.length;
  }

  serialize(): Section[] {
    // Metadata as JSON; cell data as typed sections in stack order (undo, then redo).
    const all = [...this.undo, ...this.redo];
    const meta = { undo: this.undo.length, edits: all.map((e) => ({ layer: e.layer, n: e.cells.length, ctl: e.beforeCtl !== null })) };
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
    if (!sections.some((s) => s.name === 'edits.json')) return; // saves from before PLAN 1.35
    const meta = JSON.parse(new TextDecoder().decode(takeSection(sections, 'edits.json', 'u8'))) as { undo: number; edits: { layer: EditLayer; n: number; ctl: boolean }[] };
    const cells = takeSection(sections, 'edits.cells', 'u32');
    const before = takeSection(sections, 'edits.before', 'u16');
    const after = takeSection(sections, 'edits.after', 'u16');
    const ctl = takeSection(sections, 'edits.ctl', 'u16');
    let o = 0;
    let c = 0;
    meta.edits.forEach((m, i) => {
      const e: Edit = { layer: m.layer, cells: cells.slice(o, o + m.n), before: before.slice(o, o + m.n), after: after.slice(o, o + m.n), beforeCtl: m.ctl ? ctl.slice(c, c + m.n) : null };
      o += m.n;
      if (m.ctl) c += m.n;
      (i < meta.undo ? this.undo : this.redo).push(e);
    });
  }
}

/** Cells within radius r of (x, y): wrapping x, clipped to the map. */
export function brushCells(w: number, h: number, x: number, y: number, r: number): number[] {
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
      out.push(yy * w + ((((cx + dx) % w) + w) % w));
    }
  }
  return out;
}

/** The brush stamped every cell along the segment (x0, y0) → (x1, y1) (no wrap across the seam). */
export function lineCells(w: number, h: number, x0: number, y0: number, x1: number, y1: number, r: number): number[] {
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
  const seen = new Set<number>();
  for (let i = 0; i <= steps; i++) for (const c of brushCells(w, h, x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps, r)) seen.add(c);
  return [...seen].sort((a, b) => a - b);
}

/** 4-connected flood fill from (x, y) over cells whose `layer` value equals the start cell's (wrapping x). */
export function bucketCells(world: World, layer: EditLayer, x: number, y: number): number[] {
  const { w, h, owner, terrain } = world.cells;
  const sx = ((Math.floor(x) % w) + w) % w;
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
    const ns = [cy * w + ((cx + 1) % w), cy * w + ((cx + w - 1) % w), cy > 0 ? c - w : -1, cy < h - 1 ? c + w : -1];
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

/** Terrain changed: everything derived from it is rebuilt on demand. */
function terrainChanged(world: World): void {
  world.nav = null;
  world.paths.clear();
  world.frontier = null;
  world.supplyDirty = true;
  world.terrainVersion++;
}

/**
 * Paints `value` (a nation id, 0 = unowned; or a terrain class) with `tool`; returns the edit, or
 * null when nothing changed. The edit is pushed on the undo stack.
 */
export function paint(world: World, layer: EditLayer, tool: EditTool, x: number, y: number, x2: number, y2: number, r: number, value: number, mask: EditMask | null): Edit | null {
  const { w, h, owner, controller, terrain } = world.cells;
  if (layer === 'nation' && value !== 0 && !world.nations.has(value)) return null;
  if (layer === 'terrain' && !isLand(value)) return null;
  const shape = tool === 'brush' ? brushCells(w, h, x, y, r) : tool === 'line' ? lineCells(w, h, x, y, x2, y2, r) : bucketCells(world, layer, x, y);
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
  world.edits.push(e);
  return e;
}

/** Applies an edit forward, or backward (`undo`). */
function apply(world: World, e: Edit, undo: boolean): void {
  const terrain = world.cells.terrain;
  for (let i = 0; i < e.cells.length; i++) {
    const c = e.cells[i]!;
    if (e.layer === 'nation') {
      world.setOwner(c, undo ? e.before[i]! : e.after[i]!);
      world.setController(c, undo ? e.beforeCtl![i]! : e.after[i]!);
    } else {
      terrain[c] = undo ? e.before[i]! : e.after[i]!;
      markDirty(world, c);
    }
  }
  if (e.layer === 'terrain') terrainChanged(world);
}

export function undoEdit(world: World): boolean {
  const e = world.edits.undo.pop();
  if (!e) return false;
  apply(world, e, true);
  world.edits.redo.push(e);
  return true;
}

export function redoEdit(world: World): boolean {
  const e = world.edits.redo.pop();
  if (!e) return false;
  apply(world, e, false);
  world.edits.undo.push(e);
  return true;
}
