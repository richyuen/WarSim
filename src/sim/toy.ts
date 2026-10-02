/**
 * Toy world for Phase 0 (PLAN 0.12): a 256×128 grid, two nations and random-walking
 * formations that capture the cells they cross. It exercises every determinism path the
 * real sim uses (RNG streams, dmath, table churn and free lists, commands, cell layers)
 * so invariants I1–I5 can be tested before real systems exist.
 */
import { cos, sin, TAU } from './core/dmath';
import { EventKind } from '../shared/events';
import { SCENARIO_GEOMETRY, SCENARIO_INFO } from '../shared/scenarios';
import type { System } from './tick';
import { Terrain } from '../shared/terrain';
import { World } from './world';

export const TOY_W = SCENARIO_GEOMETRY.toy.w;
export const TOY_H = SCENARIO_GEOMETRY.toy.h;
const FORMATIONS_PER_NATION = 60;
const SPEED_CELLS = 0.45;

export function createToyWorld(seed: number): World {
  const world = new World(seed, TOY_W, TOY_H);
  world.startDay = SCENARIO_INFO.toy.startDay;
  const rng = world.rng.get('scenario');
  const { cells } = world;

  // Land everywhere, plus a few elliptical lakes.
  cells.terrain.fill(Terrain.Plains);
  for (let k = 0; k < 6; k++) {
    const cx = rng.nextInt(TOY_W);
    const cy = 10 + rng.nextInt(TOY_H - 20);
    const rx = 4 + rng.nextInt(12);
    const ry = 3 + rng.nextInt(8);
    for (let y = cy - ry; y <= cy + ry; y++) {
      for (let x = cx - rx; x <= cx + rx; x++) {
        if (y < 0 || y >= TOY_H) continue;
        const dx = (x - cx) / rx;
        const dy = (y - cy) / ry;
        if (dx * dx + dy * dy <= 1) cells.terrain[world.cellIndex(((x % TOY_W) + TOY_W) % TOY_W, y)] = Terrain.Water;
      }
    }
  }

  const colors = [0, 0x3b6fb6, 0xc8553d];
  for (let n = 1; n <= 2; n++) {
    const id = world.nations.create();
    world.nations.cols.color[id] = colors[n]!;
    world.nations.cols.capitalX[id] = n === 1 ? TOY_W * 0.25 : TOY_W * 0.75;
    world.nations.cols.capitalY[id] = TOY_H * 0.5;
  }
  for (let y = 0; y < TOY_H; y++) {
    for (let x = 0; x < TOY_W; x++) {
      const i = world.cellIndex(x, y);
      if (cells.terrain[i] === Terrain.Water) continue;
      const owner = x < TOY_W / 2 ? 1 : 2;
      cells.owner[i] = owner;
      cells.controller[i] = owner;
    }
  }

  for (let n = 1; n <= 2; n++) {
    for (let k = 0; k < FORMATIONS_PER_NATION; k++) spawnNear(world, n, rng.nextFloat() * 20 - 10, rng.nextFloat() * 40 - 20);
  }
  return world;
}

function spawnNear(world: World, nation: number, dx: number, dy: number): number {
  const f = world.formations;
  const id = f.create();
  f.cols.nation[id] = nation;
  f.cols.x[id] = wrapX(world.nations.cols.capitalX[nation]! + dx);
  f.cols.y[id] = clampY(world.nations.cols.capitalY[nation]! + dy);
  f.cols.facing[id] = nation === 1 ? 0 : TAU / 2;
  f.cols.strength[id] = 300;
  world.out.emit(world.tick, EventKind.FormationSpawned, id, nation, f.cols.x[id]!, f.cols.y[id]!);
  return id;
}

function wrapX(x: number): number {
  return ((x % TOY_W) + TOY_W) % TOY_W;
}

function clampY(y: number): number {
  return Math.min(TOY_H - 0.001, Math.max(0, y));
}

/** Random walk + capture of crossed cells + attrition on enemy-controlled cells. */
const toyMovement: System = (world) => {
  const rng = world.rng.get('toy');
  const f = world.formations;
  const { cells } = world;
  f.forEach((id) => {
    const nation = f.cols.nation[id]!;
    const facing = f.cols.facing[id]! + rng.nextNormal() * 0.35;
    const nx = wrapX(f.cols.x[id]! + cos(facing) * SPEED_CELLS);
    const ny = clampY(f.cols.y[id]! + sin(facing) * SPEED_CELLS);
    const ci = world.cellIndex(Math.floor(nx), Math.floor(ny));
    if (cells.terrain[ci] === Terrain.Water) {
      f.cols.facing[id] = facing + TAU / 2; // bounce off water
      return;
    }
    f.cols.x[id] = nx;
    f.cols.y[id] = ny;
    f.cols.facing[id] = facing;
    if (cells.controller[ci] !== nation) {
      world.setController(ci, nation);
      const loss = 1 + rng.nextInt(8);
      f.cols.strength[id] = Math.max(0, f.cols.strength[id]! - loss);
    }
  });
};

/** Daily: formations at zero strength disband; each nation recruits back to its quota. */
const toyReinforce: System = (world) => {
  if (world.tick % 24 !== 23) return;
  const f = world.formations;
  const rng = world.rng.get('toy');
  const perNation = [0, 0, 0];
  f.forEach((id) => {
    if (f.cols.strength[id] === 0) {
      world.out.emit(world.tick, EventKind.FormationDestroyed, id, f.cols.nation[id]!, f.cols.x[id]!, f.cols.y[id]!);
      f.remove(id);
    } else perNation[f.cols.nation[id]!]!++;
  });
  for (let n = 1; n <= 2; n++) {
    for (let k = perNation[n]!; k < FORMATIONS_PER_NATION; k++) spawnNear(world, n, rng.nextFloat() * 6 - 3, rng.nextFloat() * 6 - 3);
  }
};

/** Daily: recount cells controlled per nation (a derived-but-authoritative stat). */
const toyCount: System = (world) => {
  if (world.tick % 24 !== 0) return;
  const counts = [0, 0, 0];
  const c = world.cells.controller;
  for (let i = 0; i < c.length; i++) counts[c[i]!]!++;
  world.nations.forEach((id) => (world.nations.cols.cells[id] = counts[id] ?? 0));
};

export const TOY_SYSTEMS: readonly System[] = [toyMovement, toyReinforce, toyCount];
