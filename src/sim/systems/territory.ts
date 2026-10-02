/**
 * Territory pressure, frontier-set flips and the connectivity rule (SPEC §4, PLAN 1.14).
 *
 * Frontier set (derived, never saved): cells whose controller is at war with the controller of
 * a 4-neighbour. It is rebuilt by one grid scan only when invalidated (load, a war declared or
 * ended, a controller change outside this system); flips update it locally, so the hourly loop
 * never scans the grid.
 *
 * Pressure (hourly): every formation of a nation at war projects
 *   strength/1000 × (0.5 + 0.5 supply) × (1 − d/(R+1))
 * into the cells within R cells of it. A frontier cell C controlled by D is contested by each
 * nation A at war with D that controls a 4-neighbour of C (the connectivity rule: control spreads
 * cell by cell from held land and can never jump past a line). A's pressure on C, divided by C's
 * terrain defence, must exceed D's bloc pressure + GARRISON for HOLD_TICKS consecutive hours
 * (`cells.flip`, saved); C then flips to the strongest such A (lowest id on ties).
 *
 * Decisions use start-of-tick control and are applied together, so the order of the frontier
 * cannot matter and a front advances at most one cell per HOLD_TICKS: a wave.
 */
import terrainJson from '../../../data/terrain.json' with { type: 'json' };
import { neighbours4 } from '../nav/grid';
import type { World } from '../world';
import { blocOf } from './supply';

export const PRESSURE_RADIUS = 2;
/** Abstract province garrison, in the same units as formation pressure (≈ 1,000 men at d = 0). */
export const GARRISON = 1;
export const HOLD_TICKS = 16;
const TERRAIN_DEF = terrainJson.terrain.map((t) => t.defense);

function neighbours(world: World, c: number, out: number[]): number[] {
  return neighbours4(c, world.cells.w, world.cells.h, true, out);
}

const scratch: number[] = [];
function onFrontier(world: World, c: number): boolean {
  const ctl = world.cells.controller;
  const a = ctl[c]!;
  if (a === 0) return false;
  for (const n of neighbours(world, c, scratch)) if (ctl[n] !== 0 && world.wars.atWar(a, ctl[n]!)) return true;
  return false;
}

/** The frontier set, rebuilt by a grid scan only when invalidated. */
export function frontierOf(world: World): Set<number> {
  if (world.frontier && world.frontierWars === world.wars.version) return world.frontier;
  const f = new Set<number>();
  if (world.wars.size > 0) {
    const n = world.cells.w * world.cells.h;
    for (let c = 0; c < n; c++) {
      if (onFrontier(world, c)) f.add(c);
      else world.cells.flip[c] = 0; // uncontested cells carry no hold progress
    }
  } else {
    world.cells.flip.fill(0);
  }
  world.frontier = f;
  world.frontierWars = world.wars.version;
  return f;
}

export function territorySystem(world: World): void {
  const frontier = frontierOf(world);
  const { w, h, controller, terrain, flip } = world.cells;
  if (frontier.size === 0) return;

  // Pressure per cell per nation, from formations of nations at war (ascending ids).
  const fighting = world.wars.nations();
  const pressure = new Map<number, Map<number, number>>();
  const f = world.formations.cols;
  world.formations.forEach((id) => {
    const nation = f.nation[id]!;
    if (!fighting.has(nation)) return;
    const base = (f.strength[id]! / 1000) * (0.5 + 0.5 * f.supply[id]!);
    const cx = Math.floor(f.x[id]!);
    const cy = Math.floor(f.y[id]!);
    for (let dy = -PRESSURE_RADIUS; dy <= PRESSURE_RADIUS; dy++) {
      const y = cy + dy;
      if (y < 0 || y >= h) continue;
      for (let dx = -PRESSURE_RADIUS; dx <= PRESSURE_RADIUS; dx++) {
        const d = Math.max(Math.abs(dx), Math.abs(dy));
        const p = base * (1 - d / (PRESSURE_RADIUS + 1));
        const c = y * w + ((cx + dx + w) % w);
        let m = pressure.get(c);
        if (!m) pressure.set(c, (m = new Map()));
        m.set(nation, (m.get(nation) ?? 0) + p);
      }
    }
  });

  // Decide on start-of-tick control; apply afterwards.
  const flips: [number, number][] = [];
  const nb: number[] = [];
  for (const c of [...frontier].sort((p, q) => p - q)) {
    const d = controller[c]!;
    const m = pressure.get(c);
    let defence = GARRISON;
    let best = 0;
    let bestNation = 0;
    if (m) {
      const dBloc = blocOf(world, d);
      for (const [n, p] of m) if (blocOf(world, n) === dBloc) defence += p;
      for (const a of neighbours(world, c, nb)) {
        const an = controller[a]!;
        if (an === 0 || an === bestNation || !world.wars.atWar(an, d)) continue;
        const p = (m.get(an) ?? 0) / (TERRAIN_DEF[terrain[c]!] ?? 1);
        if (p > best || (p === best && an < bestNation)) {
          best = p;
          bestNation = an;
        }
      }
    }
    if (bestNation !== 0 && best > defence) {
      flip[c] = flip[c]! + 1;
      if (flip[c]! >= HOLD_TICKS) flips.push([c, bestNation]);
    } else {
      flip[c] = 0;
    }
  }
  for (const [c, n] of flips) {
    flip[c] = 0;
    world.setController(c, n, true);
  }
  // Local frontier upkeep around flipped cells.
  for (const [c] of flips) {
    for (const k of [c, ...neighbours(world, c, nb)]) {
      if (onFrontier(world, k)) frontier.add(k);
      else if (frontier.delete(k)) flip[k] = 0;
    }
  }
}
