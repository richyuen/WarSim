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
 * - Transports: no mission. At peace, a nation's wings have none.
 *
 * An order is given only where it is within range (`kmFromBase`), so the AI is never refused.
 */
import { isDayStart } from '../../shared/calendar';
import { basePlace, kmFromBase, orderMission, wingRange } from '../systems/air';
import { hypot } from '../core/dmath';
import { airSuperiority } from '../systems/airSuperiority';
import { airOf, navOf, type World } from '../world';

/** A strategic bomber group bombs industry only in an air zone its nation's superiority is this or more in. */
export const BOMB_SUPERIORITY = 0.6;

/** A wing's role by the class of its aircraft (its template's first squadron's). */
const ROLE: Record<string, 'patrol' | 'front' | 'naval' | 'bomb' | undefined> = {
  fighter: 'patrol',
  cas: 'front',
  bomber_tac: 'front',
  naval_bomber: 'naval',
  bomber_str: 'bomb',
};

/** The day's missions of every AI nation's land-based wings. */
export function airAi(world: World): void {
  if (!world.settings.aiEnabled || !isDayStart(world.tick) || !world.rules || world.wingBase.size === 0) return;
  const nc = world.nations.cols;
  const c = world.formations.cols;
  const wings = new Map<number, number[]>();
  for (const [id, base] of [...world.wingBase].sort((a, b) => a[0] - b[0])) {
    if (base <= 0 || !world.formations.has(id)) continue;
    const n = c.nation[id]!;
    if (nc.living[n] !== 1 || nc.aiOff[n] === 1) continue;
    let list = wings.get(n);
    if (!list) wings.set(n, (list = []));
    list.push(id);
  }
  if (wings.size === 0) return;
  // The front: every land formation in contact; the fleets.
  const engaged: number[] = [];
  const fleets: number[] = [];
  world.formations.forEach((id) => {
    if (world.isFleet(id)) fleets.push(id);
    else if (!world.offLand(id) && c.engaged[id] === 1) engaged.push(id);
  });
  // The cells of industry, richest first, for a strategic bomber: made when one is tasked.
  let rich: readonly number[] | null = null;
  const richest = (): readonly number[] => (rich ??= byIndustry(world));
  const atWar = world.wars.nations();
  for (const n of [...wings.keys()].sort((a, b) => a - b)) {
    const list = wings.get(n)!;
    if (!atWar.has(n)) {
      for (const id of list) world.wingMission.delete(id);
      continue;
    }
    const own = engaged.filter((g) => c.nation[g] === n);
    const enemy = engaged.filter((g) => world.wars.atWar(n, c.nation[g]!));
    const enemyFleets = fleets.filter((g) => world.wars.atWar(n, c.nation[g]!) && !world.embarked.has(g));
    for (const id of list) {
      const role = roleOf(world, id);
      let target: [number, number] | null = null;
      let kind: 'patrol' | 'strike' = 'strike';
      if (role === 'patrol') {
        target = nearest(world, id, own);
        kind = 'patrol';
      } else if (role === 'front') target = nearest(world, id, enemy);
      else if (role === 'naval') target = nearest(world, id, enemyFleets) ?? nearest(world, id, enemy);
      else if (role === 'bomb') target = industry(world, id, n, richest);
      if (!target) {
        world.wingMission.delete(id);
        continue;
      }
      const m = world.wingMission.get(id);
      if (m && m.kind === kind && m.x === target[0] && m.y === target[1]) continue;
      orderMission(world, id, kind, target[0], target[1]);
    }
  }
}

/** Wing `id`'s role (`ROLE`), by its first squadron's class. */
function roleOf(world: World, id: number): 'patrol' | 'front' | 'naval' | 'bomb' | undefined {
  const rules = world.rules!;
  const first = rules.templates[world.formations.cols.template[id]!]?.elements[0];
  return first ? ROLE[rules.units[first.unit]!.cls] : undefined;
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
const ORDER = new WeakMap<Uint32Array, { sum: number; cells: number[] }>();

/**
 * The cells of `world` with industry (`cells.econ`), richest first: sorted once, and again only
 * when the industry changed (the editor's cities: PLAN 1.36), told by its sum and weighted sum.
 * A function of the industry alone, so a loaded world has the same order.
 */
export function byIndustry(world: World): readonly number[] {
  const econ = world.cells.econ;
  let sum = 0;
  for (let c = 0; c < econ.length; c++) if (econ[c] !== 0) sum += econ[c]! * ((c % 9973) + 1);
  const kept = ORDER.get(econ);
  if (kept && kept.sum === sum) return kept.cells;
  const cells: number[] = [];
  for (let c = 0; c < econ.length; c++) if (econ[c]! > 0) cells.push(c);
  cells.sort((a, b) => econ[b]! - econ[a]! || a - b);
  ORDER.set(econ, { sum, cells });
  return cells;
}
