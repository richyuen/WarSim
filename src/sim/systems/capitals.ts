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
 * - otherwise the capital moves to the loser's largest city that it both owns and controls on the
 *   landmass where it owns and controls the most cells (`relocateCapital`, PLAN 7.68) with
 *   `CapitalMoved`. Without such a city, it moves to the loser's
 *   controlled cell nearest the old capital (a field capital). A field capital is lost by any
 *   change of control and relocates the same way; a nation with no cell left is eliminated.
 *
 * A capital given away (ADR-145, PLAN 3.4Rh): a capital city on a cell its nation no longer owns
 * (the editor's paint, the God brush, an import, land ceded) moves the same way, with
 * `CapitalMoved` alone: no `CapitalCaptured`, and no annexation under either setting. A nation
 * painted away whole is eliminated by it. Occupation with no war (controller ≠ owner) is not that.
 *
 * Elimination: `living` = 0, its formations, production orders and research lines are removed, its wars end,
 * it leaves its alliance (`AllianceLeft`, and `AllianceDissolved` when one member is left), the land it occupied goes back to its owners and its land that others occupy becomes theirs
 * (`leaveLand`), `NationEliminated` is emitted.
 */
import { EventKind } from '../../shared/events';
import { nearestCellWhere } from '../data/ownership';
import { navOf, type World } from '../world';
import { leaveAlliance } from './alliances';
import { destroyFormation } from './elements';
import { releasePuppet } from './puppets';
import { holdsCore, REVIVAL_COOLDOWN } from './revival';
import { noteCapitalCaptured } from './war';

export function capitalsSystem(world: World): void {
  const cc = world.cities.cols;
  const nc = world.nations.cols;
  const { w, owner, controller } = world.cells;
  const hasCity = new Uint8Array(world.nations.highWater);
  world.cities.forEach((city) => {
    const n = cc.capitalOf[city]!;
    if (n === 0 || nc.living[n] !== 1) return;
    hasCity[n] = 1;
    const cell = cc.cell[city]!;
    const holder = controller[cell]!;
    if (holder !== n && holder !== 0 && world.wars.atWar(holder, n)) {
      captureCapital(world, n, holder, city);
      return;
    }
    if (owner[cell] === n) return;
    // Given away (ADR-145): nobody took it in a war, so no capture and no annexation.
    cc.capitalOf[city] = 0;
    relocateCapital(world, n);
  });
  // Field capitals (no city left): lost by any change of control; relocate or eliminate.
  world.nations.forEach((n) => {
    if (nc.living[n] !== 1 || hasCity[n]) return;
    const cell = Math.floor(nc.capitalY[n]!) * w + Math.floor(nc.capitalX[n]!);
    if (controller[cell] !== n) relocateToField(world, n);
  });
}

/**
 * The cell of n's capital: its capital city's, else (a field capital) the one its coordinates
 * are in. Not the coordinates' cell for a city: those of a city on the shore are in a sea cell
 * of the coarse grid or in the next province (PLAN 2.15e3, 2.16Rh).
 */
export function capitalCell(world: World, n: number): number {
  const cc = world.cities.cols;
  const nc = world.nations.cols;
  let city = 0;
  world.cities.forEach((ci) => {
    if (city === 0 && cc.capitalOf[ci] === n) city = ci;
  });
  return city !== 0 ? cc.cell[city]! : Math.floor(nc.capitalY[n]!) * world.cells.w + Math.floor(nc.capitalX[n]!);
}

/**
 * Steps (4-neighbour, over land and sea) from each cell to the nearest cell held by a nation at war
 * with `n`; null when no nation at war with it holds a cell. A rare event's grid pass (a capital
 * moving), not the hourly hot loop.
 */
export function enemyDistance(world: World, n: number): Int32Array | null {
  const { w, h, controller } = world.cells;
  const enemy = new Uint8Array(world.nations.highWater);
  let any = false;
  for (const war of world.wars.list) {
    const them = war.sides[0].includes(n) ? war.sides[1] : war.sides[1].includes(n) ? war.sides[0] : null;
    if (!them) continue;
    for (const m of them) {
      if (!world.wars.atWar(n, m)) continue;
      enemy[m] = 1;
      any = true;
    }
  }
  if (!any) return null;
  const dist = new Int32Array(controller.length).fill(-1);
  const queue = new Int32Array(controller.length);
  let tail = 0;
  for (let c = 0; c < controller.length; c++) {
    if (enemy[controller[c]!] === 1) {
      dist[c] = 0;
      queue[tail++] = c;
    }
  }
  if (tail === 0) return null;
  // Breadth first from every enemy cell at once; the four neighbours inline (the order of
  // `neighbours4`), as the pass is over the whole grid.
  const wrap = world.settings.loopingMap;
  const last = w * h - w;
  for (let head = 0; head < tail; head++) {
    const c = queue[head]!;
    const d = dist[c]! + 1;
    const x = c % w;
    if (c >= w && dist[c - w] === -1) {
      dist[c - w] = d;
      queue[tail++] = c - w;
    }
    if (c < last && dist[c + w] === -1) {
      dist[c + w] = d;
      queue[tail++] = c + w;
    }
    const left = x > 0 ? c - 1 : wrap ? c + w - 1 : -1;
    if (left >= 0 && dist[left] === -1) {
      dist[left] = d;
      queue[tail++] = left;
    }
    const right = x < w - 1 ? c + 1 : wrap ? c - w + 1 : -1;
    if (right >= 0 && dist[right] === -1) {
      dist[right] = d;
      queue[tail++] = right;
    }
  }
  return dist;
}

/**
 * Moves the capital to a field capital, or eliminates the nation without a cell. At war (PLAN 7.81b1,
 * ADR-640): the controlled cell farthest from the cells its enemies hold (`enemyDistance`), on the
 * landmass where it controls the most cells; ties to the one nearest the old capital, then the lower
 * cell. The nearest controlled cell to a lost capital is a front cell, so the field capital fell with
 * each day's advance (the Netherlands' moved 26 times in a year). With no enemy holding land, the
 * controlled cell nearest the old capital, as before.
 */
function relocateToField(world: World, n: number): void {
  const nc = world.nations.cols;
  const { w, h, controller } = world.cells;
  const dist = enemyDistance(world, n);
  const cell = dist
    ? farthestFieldCell(world, n, dist)
    : nearestCellWhere((c) => controller[c] === n, nc.capitalX[n]!, nc.capitalY[n]!, w, h, Math.max(w, h), world.settings.loopingMap);
  if (cell < 0) {
    eliminateNation(world, n);
    return;
  }
  const x = cell % w;
  nc.capitalX[n] = x + 0.5;
  nc.capitalY[n] = (cell - x) / w + 0.5;
  world.out.emit(world.tick, EventKind.CapitalMoved, n, 0, nc.capitalX[n]!, nc.capitalY[n]!);
}

/** `relocateToField`'s pick at war: -1 when `n` controls no cell. */
function farthestFieldCell(world: World, n: number, dist: Int32Array): number {
  const nc = world.nations.cols;
  const { w, controller } = world.cells;
  const comp = navOf(world).grid.component;
  // The landmass where n controls the most cells (lowest id on ties; a cell of none counts for none).
  const count = new Map<number, number>();
  for (let c = 0; c < controller.length; c++) if (controller[c] === n && comp[c] !== 0) count.set(comp[c]!, (count.get(comp[c]!) ?? 0) + 1);
  let land = 0;
  let landCells = 0;
  for (const [l, k] of count) if (k > landCells || (k === landCells && l < land)) [land, landCells] = [l, k];
  const x0 = nc.capitalX[n]!;
  const y0 = nc.capitalY[n]!;
  const wrap = world.settings.loopingMap;
  let best = -1;
  let bestDist = -1;
  let bestNear = Infinity;
  for (let c = 0; c < controller.length; c++) {
    if (controller[c] !== n || (land !== 0 && comp[c] !== land)) continue;
    const d = dist[c]!;
    if (d < bestDist) continue;
    const x = c % w;
    let dx = Math.abs(x + 0.5 - x0);
    if (wrap && dx > w / 2) dx = w - dx;
    const dy = (c - x) / w + 0.5 - y0;
    const near = dx * dx + dy * dy;
    if (d > bestDist || near < bestNear) [best, bestDist, bestNear] = [c, d, near];
  }
  return best;
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
 * Moves `n`'s capital to a city it owns and controls on the landmass where it owns and controls the
 * most cells (PLAN 7.68, ADR-620; of the landmasses with such a city, lowest landmass id on ties),
 * its largest there (lowest id on ties); else to a field capital; eliminates it without land. Used
 * after capture, a capital given away, and when rebels take it. A cell of no landmass (0) counts
 * for none.
 */
export function relocateCapital(world: World, n: number): void {
  const cc = world.cities.cols;
  const nc = world.nations.cols;
  const { owner, controller } = world.cells;
  const comp = navOf(world).grid.component;
  // A rare event: one grid pass is acceptable here (not the hourly hot loop).
  const held = new Map<number, number>();
  for (let c = 0; c < owner.length; c++) {
    if (owner[c] === n && controller[c] === n && comp[c] !== 0) held.set(comp[c]!, (held.get(comp[c]!) ?? 0) + 1);
  }
  let best = 0;
  let bestHeld = -1;
  world.cities.forEach((id) => {
    const cell = cc.cell[id]!;
    if (owner[cell] !== n || controller[cell] !== n || cc.capitalOf[id] !== 0) return;
    const k = held.get(comp[cell]!) ?? 0;
    const land = comp[cell]!;
    const better =
      best === 0 ||
      k > bestHeld ||
      (k === bestHeld && land < comp[cc.cell[best]!]!) ||
      (k === bestHeld && land === comp[cc.cell[best]!]! && cc.size[id]! > cc.size[best]!);
    if (better) [best, bestHeld] = [id, k];
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
  world.research.forEach((id) => {
    if (world.research.cols.nation[id] === n) world.research.remove(id);
  });
  world.cities.forEach((id) => {
    if (world.cities.cols.capitalOf[id] === n) world.cities.cols.capitalOf[id] = 0;
  });
  world.wars.endAllOf(n);
  // It leaves its alliance as a member that walks out does, with the rows of it (PLAN 3.12Rf): an
  // alliance that a death left with one member was gone from the log without a word.
  leaveAlliance(world, n);
  world.alliances.removeNation(n);
  // Nor is it anybody's puppet (PLAN 3.4Rk, ADR-148): it would return as one, and the war of a
  // revival on its overlord's land was refused. Its autonomy and loyalty are read of a puppet only.
  if (nc.overlord[n] !== 0) {
    nc.overlord[n] = 0;
    nc.integration[n] = 0;
    world.supplyDirty = true; // the blocs changed
  }
  // And its puppets are free at its death (PLAN 3.7i, ADR-174), lowest id first: until the month's
  // first hour they had a dead nation's supply bloc. A collapse and an annexation have ended or
  // moved the ties before they come here.
  world.nations.forEach((p) => {
    if (nc.overlord[p] === n && nc.living[p] === 1) releasePuppet(world, p);
  });
  leaveLand(world, n);
  world.out.emit(world.tick, EventKind.NationEliminated, n, 0, NaN, NaN);
}
