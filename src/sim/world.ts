/**
 * The authoritative world state (SPEC §3). Everything here is serialized and hashed;
 * nothing outside this object influences a tick except queued commands.
 */
import type { Command, LoggedCommand } from '../shared/commands';
import type { EventKind } from '../shared/events';
import { RngStreams } from './core/rng';
import { takeSection, type Section } from './core/sections';
import type { Stateful } from './core/state';
import { Table } from './core/table';

export interface PendingCommand {
  seq: number;
  cmd: Command;
}

export const NATION_SCHEMA = {
  color: 'u32',
  capitalX: 'f64',
  capitalY: 'f64',
  cells: 'u32',
} as const;

export const FORMATION_SCHEMA = {
  nation: 'u16',
  x: 'f64',
  y: 'f64',
  facing: 'f64',
  strength: 'u32',
} as const;

/** Per-cell layers (SPEC §3.2), each of length W·H, row-major. */
export class CellLayers implements Stateful {
  readonly w: number;
  readonly h: number;
  owner: Uint16Array<ArrayBuffer>;
  controller: Uint16Array<ArrayBuffer>;
  terrain: Uint8Array<ArrayBuffer>;

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.owner = new Uint16Array(w * h);
    this.controller = new Uint16Array(w * h);
    this.terrain = new Uint8Array(w * h);
  }

  serialize(): Section[] {
    return [
      { name: 'cells.owner', dtype: 'u16', data: this.owner },
      { name: 'cells.controller', dtype: 'u16', data: this.controller },
      { name: 'cells.terrain', dtype: 'u8', data: this.terrain },
    ];
  }

  deserialize(sections: readonly Section[]): void {
    const n = this.w * this.h;
    const owner = takeSection(sections, 'cells.owner', 'u16');
    const controller = takeSection(sections, 'cells.controller', 'u16');
    const terrain = takeSection(sections, 'cells.terrain', 'u8');
    if (owner.length !== n || controller.length !== n || terrain.length !== n) {
      throw new Error(`cell layers: expected ${n} cells`);
    }
    this.owner = owner.slice();
    this.controller = controller.slice();
    this.terrain = terrain.slice();
  }
}

/** Side length of a dirty tile in cells (SPEC §2.4). */
export const TILE = 64;

/**
 * Derived, non-authoritative outputs of a tick: which 64×64 tiles changed and which events
 * happened. Never serialized or hashed; consumers (the snapshot server) drain them.
 */
export class TickOutputs {
  readonly tilesX: number;
  readonly tilesY: number;
  /** 1 = tile changed since the consumer last cleared it. */
  readonly dirtyTiles: Uint8Array;
  /** Flat [tick, kind, a, b, x, y] records since the consumer last drained. */
  events: number[] = [];

  constructor(w: number, h: number) {
    this.tilesX = Math.ceil(w / TILE);
    this.tilesY = Math.ceil(h / TILE);
    this.dirtyTiles = new Uint8Array(this.tilesX * this.tilesY);
  }

  markAllDirty(): void {
    this.dirtyTiles.fill(1);
  }

  emit(tick: number, kind: EventKind, a: number, b: number, x: number, y: number): void {
    this.events.push(tick, kind, a, b, x, y);
  }
}


/** Scalar globals + RNG + command log. */
class WorldCore implements Stateful {
  constructor(private readonly world: World) {}

  serialize(): Section[] {
    const w = this.world;
    const meta = new Float64Array([w.seed, w.tick, w.cells.w, w.cells.h, w.nextCommandSeq, w.startDay]);
    // Pending (queued, not yet applied) commands are saved too, so a save taken between
    // enqueue and the next tick boundary loses nothing.
    const log = new TextEncoder().encode(JSON.stringify({ log: w.commandLog, pending: w.pending }));
    return [
      { name: 'world.meta', dtype: 'f64', data: meta },
      { name: 'world.rng', dtype: 'u32', data: w.rng.save() },
      { name: 'world.commandLog', dtype: 'u8', data: log },
    ];
  }

  deserialize(sections: readonly Section[]): void {
    const w = this.world;
    const meta = takeSection(sections, 'world.meta', 'f64');
    const [seed = 0, tick = 0, cw = 0, ch = 0, nextSeq = 0, startDay = 0] = meta;
    if (cw !== w.cells.w || ch !== w.cells.h) throw new Error(`map size mismatch: save ${cw}×${ch}, world ${w.cells.w}×${w.cells.h}`);
    w.seed = seed;
    w.tick = tick;
    w.nextCommandSeq = nextSeq;
    w.startDay = startDay;
    w.rng.load(takeSection(sections, 'world.rng', 'u32'));
    const parsed = JSON.parse(new TextDecoder().decode(takeSection(sections, 'world.commandLog', 'u8'))) as {
      log: LoggedCommand[];
      pending: PendingCommand[];
    };
    w.commandLog = parsed.log;
    w.pending = parsed.pending;
    w.out.markAllDirty();
  }
}

export class World {
  seed: number;
  /** Ticks elapsed; 1 tick = 1 sim hour (ADR-5). */
  tick = 0;
  /** Scenario start date as days since 1970-01-01 (shared/calendar): tick 0 is its 00:00. */
  startDay = 0;
  rng: RngStreams;
  cells: CellLayers;
  nations = new Table('nations', NATION_SCHEMA, 8);
  formations = new Table('formations', FORMATION_SCHEMA, 128);
  commandLog: LoggedCommand[] = [];
  /** Commands queued since the last tick boundary, applied in seq order at the next tick. */
  pending: PendingCommand[] = [];
  nextCommandSeq = 0;
  /** Derived outputs (dirty tiles, events): not state. */
  readonly out: TickOutputs;
  private readonly core = new WorldCore(this);

  constructor(seed: number, w: number, h: number) {
    this.seed = seed >>> 0;
    this.rng = new RngStreams(this.seed);
    this.cells = new CellLayers(w, h);
    this.out = new TickOutputs(w, h);
    this.out.markAllDirty();
  }

  /** Sets the controller of cell `i`, marking its tile dirty when it changes. */
  setController(i: number, nation: number): void {
    const c = this.cells;
    if (c.controller[i] === nation) return;
    c.controller[i] = nation;
    const x = i % c.w;
    const y = (i - x) / c.w;
    this.out.dirtyTiles[Math.floor(y / TILE) * this.out.tilesX + Math.floor(x / TILE)] = 1;
  }

  /** Queue a command for the next tick boundary. */
  enqueue(cmd: Command): void {
    this.pending.push({ seq: this.nextCommandSeq++, cmd });
  }

  /** Authoritative parts in a fixed order (the save/hash layout). */
  parts(): Stateful[] {
    return [this.core, this.cells, this.nations, this.formations];
  }

  cellIndex(x: number, y: number): number {
    return y * this.cells.w + x;
  }
}
