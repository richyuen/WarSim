/**
 * The AI's air forces (PLAN 5.6, SPEC §7): each day at 00:00, each nation at war with its AI on
 * gives its land-based wings their missions (a carrier's stay with its fleet, PLAN 5.4d). The
 * front is where its land formations and the enemy's are in contact (`engaged`).
 *
 * - Fighters patrol over the front: the place of its own engaged formation nearest their base
 *   within their range; none in range, no mission.
 * - Close support and tactical bombers strike the front: the enemy's engaged formation nearest
 *   their base within range.
 * - Naval bombers strike the enemy's fleet nearest their base within range; with none, the front.
 * - Strategic bombers bomb industry where the air is won: the enemy's cell with the most industry
 *   within their range whose air zone its superiority is `BOMB_SUPERIORITY` or more in
 *   (`airSuperiority`, PLAN 5.3c); with none, no mission. Superiority there comes of the
 *   fighters over the front, and of the air zones being wide (a zone of 1.5 M km² holds a front
 *   and the industry behind it).
 * - Paradrops first (PLAN 5.8u3b, `paradrops`): a formation of infantry alone at an airbase with
 *   the transports to lift it, not on the front, is dropped on its own front formation nearest it.
 * - Transports fly supply (PLAN 5.8u3a) to its own land formation short of it (supply under
 *   `LIFT_BELOW`) nearest their base within range; none, no mission. At peace, a nation's wings
 *   have none.
 *
 * Where none of the front is in range, a nation at war flies at the enemy's land forces still
 * (PLAN 5.12b: on seed 7321 no formation was in contact anywhere from about year 13, 60 nations at
 * war, and every wing sat): fighters patrol, and close support, tactical and naval bombers strike,
 * over the enemy's land formation nearest their base within range, in contact or not.
 *
 * An order is given only where it is within range (`kmFromBase`), so the AI is never refused.
 *
 * A wing with a front to serve and none of it in its range (PLAN 5.12a: on seed 7321 most
 * of the AI's wings at war sat out of range, the median front 2 ranges off) rebases toward it, a
 * hop a day (`toward`): to the airbase of its side with room for it, within a ferry flight
 * (FERRY_RANGE ranges), nearest the front's formation nearest it, where that is nearer than its base.
 */
import { isDayStart } from '../../shared/calendar';
import { basePlace, FERRY_RANGE, kmFromBase, ofSide, orderMission, orderRebase, wingAircraft, wingRange } from '../systems/air';
import { airbaseRoom } from '../data/airbases';
import { seaKm } from '../systems/navalCombat';
import { canParadrop, orderParadrop } from '../systems/airLift';
import { wrapDx } from '../systems/elements';
import { hypot } from '../core/dmath';
import { AIR_HELD, airSuperiority } from '../systems/airSuperiority';
import { airOf, navOf, type World } from '../world';
import { carriesNuke } from '../systems/nuclear';

/** A strategic bomber group bombs industry only in an air zone its nation's superiority is this or more in. */
export const BOMB_SUPERIORITY = AIR_HELD;

/** The AI's transports fly supply to its formations whose supply is under this (PLAN 5.8u3a). */
export const LIFT_BELOW = 0.5;

/** A wing's role by the class of its aircraft (its template's first squadron's). */
const ROLE: Record<string, 'patrol' | 'front' | 'naval' | 'bomb' | 'lift' | undefined> = {
  fighter: 'patrol',
  cas: 'front',
  bomber_tac: 'front',
  naval_bomber: 'naval',
  bomber_str: 'bomb',
  transport_air: 'lift',
};

/** The day's missions of every AI nation's land-based wings. */
export function airAi(world: World): void {
  if (!world.settings.aiEnabled || !isDayStart(world.tick) || !world.rules || world.wingBase.size === 0) return;
  const nc = world.nations.cols;
  const c = world.formations.cols;
  const wings = new Map<number, number[]>();
  for (const [id, base] of [...world.wingBase].sort((a, b) => a[0] - b[0])) {
    // A wing carrying a warhead flies on (PLAN 6.2).
    if (base <= 0 || !world.formations.has(id) || carriesNuke(world, id)) continue;
    const n = c.nation[id]!;
    if (nc.living[n] !== 1 || nc.aiOff[n] === 1) continue;
    let list = wings.get(n);
    if (!list) wings.set(n, (list = []));
    list.push(id);
  }
  if (wings.size === 0) return;
  // The front: every land formation in contact; every land formation (PLAN 5.12b); the fleets.
  const engaged: number[] = [];
  const land: number[] = [];
  const fleets: number[] = [];
  /** The land formations short of supply, for the transports. */
  const short: number[] = [];
  world.formations.forEach((id) => {
    if (world.isFleet(id)) fleets.push(id);
    else if (!world.offLand(id)) {
      if (!world.embarked.has(id)) land.push(id);
      if (c.engaged[id] === 1) engaged.push(id);
      if (c.supply[id]! < LIFT_BELOW) short.push(id);
    }
  });
  paradrops(world, wings, engaged);
  // The cells of industry, richest first, for a strategic bomber: made when one is tasked.
  let rich: readonly number[] | null = null;
  const richest = (): readonly number[] => (rich ??= byIndustry(world));
  const atWar = world.wars.nations();
  // The aircraft at each airbase, for a rebase's room (PLAN 5.12a): made when one is looked for.
  let used: Map<number, number> | null = null;
  const usedAt = (): Map<number, number> => {
    if (used) return used;
    used = new Map();
    for (const [o, b] of world.wingBase) if (b > 0 && world.formations.has(o)) used.set(b, (used.get(b) ?? 0) + wingAircraft(world, c.template[o]!));
    return used;
  };
  for (const n of [...wings.keys()].sort((a, b) => a - b)) {
    const list = wings.get(n)!;
    if (!atWar.has(n)) {
      for (const id of list) world.wingMission.delete(id);
      continue;
    }
    const own = engaged.filter((g) => c.nation[g] === n);
    const enemy = engaged.filter((g) => world.wars.atWar(n, c.nation[g]!));
    // The enemy's land forces, in contact or not (PLAN 5.12b): made when a wing has none of the front in range.
    let enemyLand: number[] | null = null;
    const enemyForces = (): number[] => (enemyLand ??= land.filter((g) => world.wars.atWar(n, c.nation[g]!)));
    const enemyFleets = fleets.filter((g) => world.wars.atWar(n, c.nation[g]!) && !world.embarked.has(g));
    for (const id of list) {
      const role = roleOf(world, id);
      let target: [number, number] | null = null;
      let kind: 'patrol' | 'strike' | 'supply' = 'strike';
      if (role === 'patrol') {
        target = nearest(world, id, own) ?? nearest(world, id, enemyForces());
        kind = 'patrol';
      } else if (role === 'front') target = nearest(world, id, enemy) ?? nearest(world, id, enemyForces());
      else if (role === 'naval') target = nearest(world, id, enemyFleets) ?? nearest(world, id, enemy) ?? nearest(world, id, enemyForces());
      else if (role === 'bomb') target = industry(world, id, n, richest);
      else if (role === 'lift') {
        target = nearest(world, id, short.filter((g) => c.nation[g] === n));
        kind = 'supply';
      }
      if (!target) {
        world.wingMission.delete(id);
        // A front out of its range: a hop toward it (PLAN 5.12a); with no front, the enemy's land forces (PLAN 5.12b).
        let front = role === 'patrol' ? own : role === 'front' ? enemy : role === 'naval' ? (enemyFleets.length > 0 ? enemyFleets : enemy) : [];
        if (front.length === 0 && (role === 'patrol' || role === 'front' || role === 'naval')) front = enemyForces();
        if (front.length > 0) toward(world, id, front, usedAt());
        continue;
      }
      const m = world.wingMission.get(id);
      if (m && m.kind === kind && m.x === target[0] && m.y === target[1]) continue;
      orderMission(world, id, kind, target[0], target[1]);
    }
  }
}

/**
 * The day's paradrops (PLAN 5.8u3b): of each AI nation at war with wings (`wings`), each of its
 * land formations that can be dropped (`canParadrop`: of infantry alone, at an airbase with its
 * transports there on the ground to lift it), not on the front, by ascending id, is dropped on
 * the place of its own formation on the front (`engaged`) nearest it. Before the wings' missions,
 * so the transports it takes fly the drop.
 */
function paradrops(world: World, wings: Map<number, number[]>, engaged: readonly number[]): void {
  const c = world.formations.cols;
  const rules = world.rules!;
  const atWar = world.wars.nations();
  const fronts = new Map<number, number[]>();
  for (const g of engaged) {
    const list = fronts.get(c.nation[g]!);
    if (list) list.push(g);
    else fronts.set(c.nation[g]!, [g]);
  }
  for (const id of [...world.formations.ids()].sort((a, b) => a - b)) {
    const n = c.nation[id]!;
    const front = fronts.get(n);
    if (!front || !wings.has(n) || !atWar.has(n) || world.offLand(id) || c.engaged[id] === 1) continue;
    if (rules.templates[c.template[id]!]!.elements.some((e) => rules.units[e.unit]!.cls !== 'inf')) continue;
    let best = -1;
    let bd = Infinity;
    for (const g of front) {
      const dx = wrapDx(world, c.x[id]!, c.x[g]!);
      const d = dx * dx + (c.y[g]! - c.y[id]!) * (c.y[g]! - c.y[id]!);
      if (d < bd) {
        bd = d;
        best = g;
      }
    }
    if (best >= 0 && canParadrop(world, id, c.x[best]!, c.y[best]!) === 0) orderParadrop(world, id, c.x[best]!, c.y[best]!);
  }
}

/** Wing `id`'s role (`ROLE`), by its first squadron's class. */
function roleOf(world: World, id: number): 'patrol' | 'front' | 'naval' | 'bomb' | 'lift' | undefined {
  const rules = world.rules!;
  const first = rules.templates[world.formations.cols.template[id]!]?.elements[0];
  return first ? ROLE[rules.units[first.unit]!.cls] : undefined;
}

/**
 * Rebases wing `id` a hop toward `front` (PLAN 5.12a): of the airbases its side holds with room
 * for it (`used`: the aircraft at each, kept up to date) within its range, the one nearest the
 * formation of `front` nearest its base, where that is nearer than its base, within a ferry's
 * reach (FERRY_RANGE ranges) of it; none, it stays.
 * Of equals, the lowest index.
 */
function toward(world: World, id: number, front: readonly number[], used: Map<number, number>): void {
  const base = world.wingBase.get(id)!;
  const at = basePlace(world, base);
  if (!at) return;
  const c = world.formations.cols;
  let goal = -1;
  let gd = Infinity;
  for (const f of front) {
    const d = seaKm(world, at[0], at[1], c.x[f]!, c.y[f]!);
    if (d < gd) [goal, gd] = [f, d];
  }
  if (goal < 0) return;
  const [gx, gy] = [c.x[goal]!, c.y[goal]!];
  const nation = c.nation[id]!;
  const need = wingAircraft(world, c.template[id]!);
  const range = FERRY_RANGE * wingRange(world, id);
  let best = 0;
  let bd = gd;
  world.airbases.forEach((b, i) => {
    if (i + 1 === base || !ofSide(world, nation, world.cells.controller[b.cell]!) || (used.get(i + 1) ?? 0) + need > airbaseRoom(b)) return;
    const [px, py] = world.cellPoint(b.cell);
    if (seaKm(world, at[0], at[1], px, py) > range) return;
    const d = seaKm(world, px, py, gx, gy);
    if (d < bd) [best, bd] = [i + 1, d];
  });
  if (best === 0) return;
  const [px, py] = world.cellPoint(world.airbases[best - 1]!.cell);
  if (orderRebase(world, id, px, py) !== 0 || world.wingBase.get(id) !== best) return;
  if (base > 0) used.set(base, (used.get(base) ?? 0) - need);
  used.set(best, (used.get(best) ?? 0) + need);
}

/** The place of the formation of `among` nearest wing `id`'s base within its range; null for none. */
function nearest(world: World, id: number, among: readonly number[]): [number, number] | null {
  const at = basePlace(world, world.wingBase.get(id)!);
  if (!at || among.length === 0) return null;
  const c = world.formations.cols;
  const range = wingRange(world, id);
  // `seaKm` from the base, with the grid's scales taken once (the same figures).
  const g = navOf(world).grid;
  const w = world.cells.w;
  let best: [number, number] | null = null;
  let bd = Infinity;
  for (const f of among) {
    let dx = Math.abs(c.x[f]! - at[0]);
    if (world.settings.loopingMap && dx > w / 2) dx = w - dx;
    const row = Math.min(g.h - 1, Math.max(0, Math.floor((at[1] + c.y[f]!) / 2)));
    const km = hypot(dx * g.kx[row]!, (c.y[f]! - at[1]) * g.ky[row]!);
    if (km <= range && km < bd) {
      bd = km;
      best = [c.x[f]!, c.y[f]!];
    }
  }
  return best;
}

/**
 * The middle of the cell with the most industry within wing `id`'s range held by a nation at war
 * with `n`, in an air zone where `n`'s superiority is `BOMB_SUPERIORITY` or more; null for none.
 * `rich()`: the cells of industry, richest first (`byIndustry`). Such a zone is one where
 * someone has flown (`world.airPower`; a half elsewhere), so those are looked at first.
 */
function industry(world: World, id: number, n: number, rich: () => readonly number[]): [number, number] | null {
  const won = new Set<number>();
  for (const z of world.airPower.keys()) if (airSuperiority(world, n, z) >= BOMB_SUPERIORITY) won.add(z);
  if (won.size === 0) return null;
  const { w, controller } = world.cells;
  const zones = airOf(world).zoneOf;
  const range = wingRange(world, id);
  for (const cell of rich()) {
    if (!won.has(zones[cell]!) || !world.wars.atWar(n, controller[cell]!)) continue;
    const x = (cell % w) + 0.5;
    const y = Math.floor(cell / w) + 0.5;
    if (kmFromBase(world, id, x, y) <= range) return [x, y];
  }
  return null;
}

/** The cells with industry, richest first (the lower cell first of equals), per world, kept while its industry is unchanged. */
const ORDER = new WeakMap<Uint32Array, { cells: number[]; at: Uint32Array; value: Uint32Array }>();

/**
 * The cells of `world` with industry (`cells.econ`), richest first: sorted once, and again only
 * when the industry changed (the editor's cities: PLAN 1.36). Told exactly (PLAN 5.8r): the cells
 * with industry and theirs are kept, in the cells' order, and the industry compared with them;
 * a sum of it let a change that kept the sum keep a stale order. A function of the industry
 * alone, so a loaded world has the same order.
 */
export function byIndustry(world: World): readonly number[] {
  const econ = world.cells.econ;
  const kept = ORDER.get(econ);
  if (kept && same(econ, kept.at, kept.value)) return kept.cells;
  const cells: number[] = [];
  for (let c = 0; c < econ.length; c++) if (econ[c]! > 0) cells.push(c);
  const at = Uint32Array.from(cells);
  const value = Uint32Array.from(cells, (c) => econ[c]!);
  cells.sort((a, b) => econ[b]! - econ[a]! || a - b);
  ORDER.set(econ, { cells, at, value });
  return cells;
}

/** Whether `econ`'s cells with industry are `at`, in order, with `value`. */
function same(econ: Uint32Array, at: Uint32Array, value: Uint32Array): boolean {
  let k = 0;
  for (let c = 0; c < econ.length; c++) {
    if (econ[c] === 0) continue;
    if (k === at.length || at[k] !== c || value[k] !== econ[c]) return false;
    k++;
  }
  return k === at.length;
}
