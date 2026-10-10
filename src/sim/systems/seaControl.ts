/**
 * Sea control per zone (PLAN 4.4a, SPEC §6.2): who holds each sea zone, by the warships in it,
 * and for a time after they leave.
 *
 * Daily at 00:00. A zone's naval power by bloc (a nation and its puppets, `blocOf`): the hit
 * points of the live ships with a weapon (a gun or torpedoes) of the fleets standing or sailing
 * in it; a transport is no power. The bloc of the most power holds the zone (the lower id on a
 * tie), unless a bloc at war with it has `CONTEST_SHARE` of its power there or more: then
 * nobody holds it. A zone with no power in it stays its holder's for `CONTROL_DAYS` after the
 * last day it held it with its ships there, then nobody's. A holder that is no longer a living
 * bloc's leader holds nothing.
 *
 * State (`world.seaControl`, per zone: its holder and the days left), saved in a section of its
 * own while any zone is held; a world whose zones change (a map import) starts it again.
 * Nothing reads it yet: the blockade, supply over sea and convoys are PLAN 4.4b–d, the map mode
 * PLAN 4.7.
 */
import { isDayStart } from '../../shared/calendar';
import { seaOf, type World } from '../world';
import { elementIndex } from './elements';
import { blocOf } from './supply';

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
    if (!world.afloat(id)) return;
    const zone = z.zoneOf[Math.floor(c.y[id]!) * w + Math.floor(c.x[id]!)]!;
    if (zone === 0) return;
    let p = 0;
    for (const e of idx.get(id) ?? []) {
      const u = units[ec.unit[e]!]!;
      if (ec.strength[e]! > 0 && (u.hard > 0 || u.torpedo > 0)) p += u.hpPerUnit * ec.strength[e]!;
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
