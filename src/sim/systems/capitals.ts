/**
 * Capitals, capture, relocation and elimination (SPEC §4, PLAN 1.15).
 *
 * Occupation: territory flips change only `controller`. `owner` changes only through peace
 * terms, annexation, integration or God Mode, so occupied land (controller ≠ owner) is tinted
 * by the renderer and pays the occupier OCCUPIED_SHARE of its income (economy).
 *
 * Capital capture (hourly, after territory): when an enemy at war controls a living nation's
 * capital city, `CapitalCaptured` is emitted. Then:
 * - with `winnerTakesAll`, the capturer annexes everything the loser controls (owner and
 *   controller) and the loser's land it already occupies, and the loser is eliminated;
 * - otherwise the capital moves to the loser's largest city that it both owns and controls
 *   (lowest city id on ties) with `CapitalMoved`. Without such a city, it moves to the loser's
 *   controlled cell nearest the old capital (a field capital). A field capital is lost by any
 *   change of control and relocates the same way; a nation with no cell left is eliminated.
 *
 * Elimination: `living` = 0, its formations and production orders are removed, its wars end,
 * the land it occupied goes back to its owners and its land that others occupy becomes theirs
 * (`leaveLand`), `NationEliminated` is emitted.
 */
import { EventKind } from '../../shared/events';
import { nearestCellWhere } from '../data/ownership';
import type { World } from '../world';
import { destroyFormation } from './elements';
import { holdsCore, REVIVAL_COOLDOWN } from './revival';
import { noteCapitalCaptured } from './war';

export function capitalsSystem(world: World): void {
  const cc = world.cities.cols;
  const nc = world.nations.cols;
  const { w, controller } = world.cells;
  const hasCity = new Uint8Array(world.nations.highWater);
  world.cities.forEach((city) => {
    const n = cc.capitalOf[city]!;
    if (n === 0 || nc.living[n] !== 1) return;
    hasCity[n] = 1;
    const holder = controller[cc.cell[city]!]!;
    if (holder === n || holder === 0 || !world.wars.atWar(holder, n)) return;
    captureCapital(world, n, holder, city);
  });
  // Field capitals (no city left): lost by any change of control; relocate or eliminate.
  world.nations.forEach((n) => {
    if (nc.living[n] !== 1 || hasCity[n]) return;
    const cell = Math.floor(nc.capitalY[n]!) * w + Math.floor(nc.capitalX[n]!);
    if (controller[cell] !== n) relocateToField(world, n);
  });
}

/** Moves the capital to the nation's controlled cell nearest the old one, or eliminates it. */
function relocateToField(world: World, n: number): void {
  const nc = world.nations.cols;
  const { w, h, controller } = world.cells;
  const cell = nearestCellWhere((c) => controller[c] === n, nc.capitalX[n]!, nc.capitalY[n]!, w, h, Math.max(w, h));
  if (cell < 0) {
    eliminateNation(world, n);
    return;
  }
  const x = cell % w;
  nc.capitalX[n] = x + 0.5;
  nc.capitalY[n] = (cell - x) / w + 0.5;
  world.out.emit(world.tick, EventKind.CapitalMoved, n, 0, nc.capitalX[n]!, nc.capitalY[n]!);
}

export function captureCapital(world: World, loser: number, capturer: number, city: number): void {
  const cc = world.cities.cols;
  const { owner, controller } = world.cells;
  world.out.emit(world.tick, EventKind.CapitalCaptured, loser, capturer, cc.x[city]!, cc.y[city]!);
  noteCapitalCaptured(world, capturer, loser);
  cc.capitalOf[city] = 0;
  // AoC's death rule (PLAN 1.20): without any core land left, losing the capital is death.
  if (world.settings.winnerTakesAll || !holdsCore(world, loser)) {
    // A rare event: one grid pass is acceptable here (not the hourly hot loop).
    for (let c = 0; c < controller.length; c++) {
      if (controller[c] === loser) {
        world.setOwner(c, capturer);
        world.setController(c, capturer);
      } else if (owner[c] === loser && controller[c] === capturer) {
        world.setOwner(c, capturer); // the capturer's own occupation of the loser becomes its land
      }
    }
    eliminateNation(world, loser);
    return;
  }
  relocateCapital(world, loser);
}

/**
 * Moves `n`'s capital to its largest city it owns and controls (lowest id on ties), else to a
 * field capital; eliminates it without land. Used after capture and when rebels take it.
 */
export function relocateCapital(world: World, n: number): void {
  const cc = world.cities.cols;
  const nc = world.nations.cols;
  const { owner, controller } = world.cells;
  let best = 0;
  world.cities.forEach((id) => {
    const cell = cc.cell[id]!;
    if (owner[cell] !== n || controller[cell] !== n || cc.capitalOf[id] !== 0) return;
    if (best === 0 || cc.size[id]! > cc.size[best]!) best = id;
  });
  if (best !== 0) {
    cc.capitalOf[best] = n;
    nc.capitalX[n] = cc.x[best]!;
    nc.capitalY[n] = cc.y[best]!;
    world.out.emit(world.tick, EventKind.CapitalMoved, n, best, cc.x[best]!, cc.y[best]!);
    return;
  }
  relocateToField(world, n);
}

/**
 * The dead hold no land (PLAN 2.16Rf): what `n` occupied goes back to its owner, and what a
 * living nation occupied of `n`'s becomes that nation's (`LandCeded`, one for each of them, the
 * lowest id first). Cells `n` both owns and controls stay: whoever ends a nation that still
 * holds land hands it over first (annexation, the God Mode Kill).
 */
function leaveLand(world: World, n: number): void {
  const nc = world.nations.cols;
  const { owner, controller, w } = world.cells;
  const got = new Map<number, { cells: number; sx: number; sy: number }>();
  // A rare event: one grid pass is acceptable here (not the hourly hot loop).
  for (let c = 0; c < owner.length; c++) {
    const o = owner[c]!;
    const k = controller[c]!;
    if (k === n && o !== n) world.setController(c, o);
    else if (o === n && k !== n && k !== 0 && nc.living[k] === 1) {
      world.setOwner(c, k);
      const g = got.get(k) ?? { cells: 0, sx: 0, sy: 0 };
      g.cells++;
      g.sx += (c % w) + 0.5;
      g.sy += Math.floor(c / w) + 0.5;
      got.set(k, g);
    }
  }
  for (const [to, g] of [...got].sort((a, b) => a[0] - b[0])) world.out.emit(world.tick, EventKind.LandCeded, to, n, g.sx / g.cells, g.sy / g.cells);
}

export function eliminateNation(world: World, n: number): void {
  const nc = world.nations.cols;
  if (nc.living[n] !== 1) return;
  nc.living[n] = 0;
  nc.revivalAt[n] = world.tick + REVIVAL_COOLDOWN; // PLAN 1.20: no revival before the cooldown
  world.formations.forEach((id) => {
    if (world.formations.cols.nation[id] === n) destroyFormation(world, id);
  });
  world.production.forEach((id) => {
    if (world.production.cols.nation[id] === n) world.production.remove(id);
  });
  world.cities.forEach((id) => {
    if (world.cities.cols.capitalOf[id] === n) world.cities.cols.capitalOf[id] = 0;
  });
  world.wars.endAllOf(n);
  world.alliances.removeNation(n);
  leaveLand(world, n);
  world.out.emit(world.tick, EventKind.NationEliminated, n, 0, NaN, NaN);
}
