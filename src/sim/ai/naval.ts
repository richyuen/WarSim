/**
 * The AI's fleets at sea (PLAN 4.6c, SPEC §7): a nation at war sails its warships to hold the
 * sea by its enemies' ports, and by its own landings; it seeks a battle where its ships are the
 * stronger and keeps out of one where they are not; at peace its fleets come home.
 *
 * Daily at 00:00, each nation (living, its AI on; staggered by `STAGGER` days as the strategic
 * AI). Its ports are those its bloc holds (a nation, its overlord and its puppets). Its warfleets are its fleets with power (`fleetPower`: the hit points of its live ships
 * with a gun or torpedoes, a submarine's none: submarines raid, PLAN 4.6d) that stand (not under
 * way, not in a sea battle).
 *
 * - At war: each of those at a port it holds (`AT_PORT_CELLS`) sails, within `SORTIE_KM` of
 *   it, to the water of a landing of its nation's under way (the escort); else to the water
 *   of the nearest port held by a nation at war with it, its zone not closed by ice, whose
 *   zone's enemy power (`navalPower`, the blocs at war with it) is no more than that of its
 *   nation's warfleets in port within `SORTIE_KM` of that water together (they choose alike,
 *   and go together): a battle it would lose is not sought.
 * - At war, a warfleet away from its ports in a zone where the enemy's power is over
 *   `AVOID_RATIO` times its own sails home (`sailHome`).
 * - At peace: a fleet away from its nation's ports sails home.
 */
import { isDayStart } from '../../shared/calendar';
import { elementIndex } from '../systems/elements';
import { AT_PORT_CELLS, sailHome, seaKm } from '../systems/navalCombat';
import { navalPower } from '../systems/seaControl';
import { orderSail } from '../systems/sail';
import { blocOf } from '../systems/supply';
import { portSeaOf, seaOf, seaRangeOf, type World } from '../world';
import { STAGGER } from './strategic';

/** How far, in km, a warfleet sails from its port to an enemy's (a little over the Mediterranean's length from Malta to Gibraltar or to Haifa). */
export const SORTIE_KM = 2500;
/** A warfleet away from its ports turns home where the enemy's power in its zone is over this many times its own. */
export const AVOID_RATIO = 1.5;

/** The hit points of fleet `id`'s live ships with a weapon, submarines left out (as sea control counts them). */
export function fleetPower(world: World, id: number): number {
  const units = world.rules!.units;
  const ec = world.elements.cols;
  let p = 0;
  for (const e of elementIndex(world).get(id) ?? []) {
    const u = units[ec.unit[e]!]!;
    if (ec.strength[e]! > 0 && u.cls !== 'ss' && (u.hard > 0 || u.torpedo > 0)) p += u.hpPerUnit * ec.strength[e]!;
  }
  return p;
}

export function navalAi(world: World): void {
  if (!world.settings.aiEnabled || !isDayStart(world.tick) || !world.rules) return;
  const nc = world.nations.cols;
  const day = world.tick / 24;
  const f = world.formations;
  const c = f.cols;
  // The standing fleets by nation, of the nations that act today.
  const fleets = new Map<number, number[]>();
  f.forEach((id) => {
    if (!world.isFleet(id) || c.moving[id] === 1 || c.engaged[id] === 1 || seaRangeOf(world, id) !== undefined) return;
    const n = c.nation[id]!;
    if (nc.living[n] !== 1 || nc.aiOff[n] === 1 || (day + n) % STAGGER !== 0) return;
    let list = fleets.get(n);
    if (!list) fleets.set(n, (list = []));
    list.push(id);
  });
  if (fleets.size === 0) return;
  const power = world.wars.list.length > 0 ? navalPower(world) : new Map<number, Map<number, number>>();
  for (const n of [...fleets.keys()].sort((a, b) => a - b)) plan(world, n, fleets.get(n)!, power);
}

function plan(world: World, n: number, mine: number[], power: Map<number, Map<number, number>>): void {
  const c = world.formations.cols;
  const w = world.cells.w;
  const water = portSeaOf(world);
  const ctl = world.cells.controller;
  const z = seaOf(world);
  const cellOf = (id: number): number => Math.floor(c.y[id]!) * w + Math.floor(c.x[id]!);
  const near = (a: number, b: number): boolean => {
    let dx = Math.abs((a % w) - (b % w));
    if (world.settings.loopingMap && dx > w / 2) dx = w - dx;
    return dx <= AT_PORT_CELLS && Math.abs(Math.floor(a / w) - Math.floor(b / w)) <= AT_PORT_CELLS;
  };
  // A port of its bloc's is home: the Netherlands' East Indies squadrons stand at Surabaya, the
  // Dutch East Indies' (sent for Den Helder at peace, a way of 2 s to find, every week).
  const bloc = blocOf(world, n);
  const atOwnPort = (id: number): boolean => world.ports.some((p, i) => water[i]! >= 0 && ctl[p.cell] !== 0 && blocOf(world, ctl[p.cell]!) === bloc && near(cellOf(id), water[i]!));
  const atWar = world.wars.list.some((war) => war.sides[0].includes(n) || war.sides[1].includes(n));
  if (!atWar) {
    // At peace: home.
    for (const id of mine) if (!atOwnPort(id)) sailHome(world, id);
    return;
  }
  /** The power of the blocs at war with n in zone `zone`. */
  const enemyIn = (zone: number): number => {
    let e = 0;
    for (const [b, p] of power.get(zone) ?? []) if (b !== bloc && world.wars.atWar(b, n)) e += p;
    return e;
  };
  const war: { id: number; p: number }[] = [];
  for (const id of mine) {
    const p = fleetPower(world, id);
    if (p <= 0) continue;
    if (!atOwnPort(id)) {
      // Away: out of a zone where the enemy is far the stronger.
      if (enemyIn(z.zoneOf[cellOf(id)]!) > AVOID_RATIO * p) sailHome(world, id);
      continue;
    }
    war.push({ id, p });
  }
  if (war.length === 0) return;
  // The escort: the water of a landing of its own under way.
  let escort = -1;
  for (const [fid, e] of [...world.embarked].sort((a, b) => a[0] - b[0])) {
    if (c.nation[fid] === n && e.water >= 0) {
      escort = e.water;
      break;
    }
  }
  const km = (id: number, cell: number): number => seaKm(world, c.x[id]!, c.y[id]!, (cell % w) + 0.5, Math.floor(cell / w) + 0.5);
  /** The power of its warfleets in port within `SORTIE_KM` of cell `cell`: those that would sail there together. */
  const together = (cell: number): number => war.reduce((s, x) => s + (km(x.id, cell) <= SORTIE_KM ? x.p : 0), 0);
  // The enemy's ports with water a fleet reaches, and their zones' enemy power.
  const targets: { at: number; enemy: number }[] = [];
  world.ports.forEach((p, i) => {
    const holder = ctl[p.cell]!;
    const at = water[i]!;
    if (holder === 0 || at < 0 || !world.wars.atWar(n, holder)) return;
    const zone = z.zoneOf[at]!;
    if (zone !== 0 && z.closed[zone] !== 1) targets.push({ at, enemy: enemyIn(zone) });
  });
  for (const { id } of war) {
    // Its landing's water within reach, else the nearest enemy port within reach whose sea the fleets there together can win.
    let target = escort >= 0 && km(id, escort) <= SORTIE_KM ? escort : -1;
    if (target < 0) {
      let best = Infinity;
      for (const t of targets) {
        const d = km(id, t.at);
        if (d <= SORTIE_KM && d < best && t.enemy <= together(t.at)) [best, target] = [d, t.at];
      }
    }
    if (target < 0 || near(cellOf(id), target)) continue;
    orderSail(world, id, (target % w) + 0.5, Math.floor(target / w) + 0.5);
  }
}
