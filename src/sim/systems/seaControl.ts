/**
 * Sea control per zone (PLAN 4.4a, SPEC §6.2): who holds each sea zone, by the warships in it,
 * and for a time after they leave.
 *
 * Daily at 00:00. A zone's naval power by bloc (a nation and its puppets, `blocOf`): the hit
 * points of the live ships with a weapon (a gun or torpedoes) of the fleets standing or sailing
 * in it; a transport is no power, nor a submarine (it raids, PLAN 4.4d: it holds no sea). The bloc of the most power holds the zone (the lower id on a
 * tie), unless a bloc at war with it has `CONTEST_SHARE` of its power there or more: then
 * nobody holds it. A zone with no power in it stays its holder's for `CONTROL_DAYS` after the
 * last day it held it with its ships there, then nobody's. A holder that is no longer a living
 * bloc's leader holds nothing.
 *
 * State (`world.seaControl`, per zone: its holder and the days left), saved in a section of its
 * own while any zone is held; a world whose zones change (a map import) starts it again.
 * The blockade (PLAN 4.4b) reads it: a port is blockaded when the zone of its water is held by
 * a nation at war with the port cell's controller (`blockadedPorts`); a province whose every
 * port a ship reaches is blockaded, and the cell of such a port that is in no province, pay
 * `BLOCKADE_SHARE` of their land's income (`blockadedCells`, read by the economy's month).
 * Supply over sea and convoys are PLAN 4.4c–d, the map mode PLAN 4.7.
 */
import { isDayStart } from '../../shared/calendar';
import { portSeaOf, seaOf, type World } from '../world';
import { elementIndex } from './elements';
import { rebaseFleets } from './navalCombat';
import { blocOf } from './supply';

/** What a blockaded province's land pays of its income: half of a coastal province's trade went by sea. */
export const BLOCKADE_SHARE = 0.5;

/** Days a zone stays its holder's with none of its ships there. */
export const CONTROL_DAYS = 14;
/** The share of the holder's power an enemy's in the zone must have to contest it. */
export const CONTEST_SHARE = 0.5;

export interface SeaControl {
  /** Per zone (index 0 unused): the bloc that holds it, 0 for none; the days it holds it with none of its ships there. */
  holder: Uint16Array;
  days: Uint8Array;
}

/** The world's sea control, made (all zones held by none) where it has none or its zones changed. */
export function seaControlOf(world: World): SeaControl {
  const n = seaOf(world).count + 1;
  if (!world.seaControl || world.seaControl.holder.length !== n) world.seaControl = { holder: new Uint16Array(n), days: new Uint8Array(n) };
  return world.seaControl;
}

/** The bloc that holds zone `zone`, 0 for none. */
export function seaHolder(world: World, zone: number): number {
  return world.seaControl?.holder[zone] ?? 0;
}

/** Naval power of each bloc in each zone: zone → (bloc → hit points of armed ships). */
export function navalPower(world: World): Map<number, Map<number, number>> {
  const z = seaOf(world);
  const f = world.formations;
  const c = f.cols;
  const idx = elementIndex(world);
  const ec = world.elements.cols;
  const units = world.rules!.units;
  const w = world.cells.w;
  const out = new Map<number, Map<number, number>>();
  f.forEach((id) => {
    if (!world.isFleet(id)) return;
    const zone = z.zoneOf[Math.floor(c.y[id]!) * w + Math.floor(c.x[id]!)]!;
    if (zone === 0) return;
    let p = 0;
    for (const e of idx.get(id) ?? []) {
      const u = units[ec.unit[e]!]!;
      if (ec.strength[e]! > 0 && u.cls !== 'ss' && (u.hard > 0 || u.torpedo > 0)) p += u.hpPerUnit * ec.strength[e]!;
    }
    if (p <= 0) return;
    const bloc = blocOf(world, c.nation[id]!);
    let m = out.get(zone);
    if (!m) out.set(zone, (m = new Map()));
    m.set(bloc, (m.get(bloc) ?? 0) + p);
  });
  return out;
}

export function seaControlSystem(world: World): void {
  if (!isDayStart(world.tick) || !world.rules) return;
  // A fleet at a base its nation has lost sails for one it holds (PLAN 4.4e).
  rebaseFleets(world);
  const sc = seaControlOf(world);
  const power = navalPower(world);
  const nc = world.nations.cols;
  for (let zone = 1; zone < sc.holder.length; zone++) {
    const held = sc.holder[zone]!;
    if (held !== 0 && (!world.nations.has(held) || nc.living[held] !== 1 || blocOf(world, held) !== held)) {
      sc.holder[zone] = 0;
      sc.days[zone] = 0;
    }
    const m = power.get(zone);
    if (!m) {
      if (sc.days[zone]! > 0) sc.days[zone] = sc.days[zone]! - 1;
      if (sc.days[zone] === 0) sc.holder[zone] = 0;
      continue;
    }
    let top = 0;
    let most = 0;
    for (const [bloc, p] of m) if (p > most || (p === most && bloc < top)) [top, most] = [bloc, p];
    let contested = false;
    for (const [bloc, p] of m) if (bloc !== top && world.wars.atWar(top, bloc) && p >= CONTEST_SHARE * most) contested = true;
    sc.holder[zone] = contested ? 0 : top;
    sc.days[zone] = contested ? 0 : CONTROL_DAYS;
  }
}

/** Per port of `world.ports`: whether it is blockaded now (see the head of the file); none before the first day of sea control. */
export function blockadedPorts(world: World): Uint8Array {
  const out = new Uint8Array(world.ports.length);
  const sc = world.seaControl;
  if (!sc) return out;
  const water = portSeaOf(world);
  const sea = seaOf(world);
  const ctl = world.cells.controller;
  world.ports.forEach((p, i) => {
    const at = water[i]!;
    if (at < 0) return;
    const zone = sea.zoneOf[at]!;
    const holder = sc.holder[zone] ?? 0;
    const c = ctl[p.cell]!;
    if (holder !== 0 && c !== 0 && world.wars.atWar(holder, c)) out[i] = 1;
  });
  return out;
}

/**
 * The cells whose land pays `BLOCKADE_SHARE` of its income: those of a province whose every port
 * with water a ship reaches is blockaded, and the cell of a blockaded port in no province. Null
 * when none is.
 */
export function blockadedCells(world: World): { provinces: Set<number>; cells: Set<number> } | null {
  if (!world.seaControl) return null;
  const blocked = blockadedPorts(world);
  if (!blocked.includes(1)) return null;
  const water = portSeaOf(world);
  const sea = seaOf(world);
  const province = world.cells.province;
  const open = new Set<number>();
  const shut = new Set<number>();
  const cells = new Set<number>();
  world.ports.forEach((p, i) => {
    const at = water[i]!;
    if (at < 0 || sea.closed[sea.zoneOf[at]!] === 1) return;
    const pr = province[p.cell]!;
    if (pr === 0) {
      if (blocked[i]) cells.add(p.cell);
      return;
    }
    (blocked[i] ? shut : open).add(pr);
  });
  for (const pr of open) shut.delete(pr);
  return shut.size === 0 && cells.size === 0 ? null : { provinces: shut, cells };
}
