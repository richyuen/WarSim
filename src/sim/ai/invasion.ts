/**
 * The AI's invasions (PLAN 4.6b, SPEC §7): a nation at war with no front lands an army on an
 * enemy's coast.
 *
 * Daily at 00:00, each nation in a war (living, its AI on; staggered by `STAGGER` days as the
 * strategic AI) that has no land front today (no cell it holds beside a cell held by a nation at
 * war with it: ADR-267 counted the long wars with a rare front, the British bloc against Ireland
 * for 800 days in every seed) and no formation aboard plans one landing:
 *
 * - its transports: the transport group of its own that stands (not under way, not in a sea
 *   battle) at a port it holds with the most room (`transportRoom`, the lower id on a tie);
 * - the target: the port held by a nation at war with it nearest those transports (`seaKm`)
 *   whose water's zone is not closed by ice nor held by a nation at war with it (a landing there
 *   would be thrown back, PLAN 4.5b): the landing takes a port, a cell with water by it;
 * - its formations at that port (land formations within `AT_PORT_CELLS` of its water, not under
 *   way, in no fight, not retreating or going home) are ordered there by `orderLanding`, one by
 *   one, until the transports have no room for the next;
 * - with none there, its free land formations on the port's land, nearest the port first, are
 *   sent to it (`orderMove`) until their men fill the room; they go aboard on a later day.
 *
 * Not here: an escort or a fleet sent to hold the landing's sea (PLAN 4.6c), a landing for a
 * nation with a front elsewhere.
 */
import { isDayStart } from '../../shared/calendar';
import { neighbours4 } from '../nav/grid';
import { frontierOf } from '../systems/territory';
import { orderLanding, transportRoom } from '../systems/amphibious';
import { orderMove } from '../systems/movement';
import { AT_PORT_CELLS, seaKm } from '../systems/navalCombat';
import { seaHolder } from '../systems/seaControl';
import { navOf, portSeaOf, seaOf, seaRangeOf, type World } from '../world';
import { STAGGER } from './strategic';

const near = (world: World, a: number, b: number, r: number): boolean => {
  const w = world.cells.w;
  let dx = Math.abs((a % w) - (b % w));
  if (world.settings.loopingMap && dx > w / 2) dx = w - dx;
  return dx <= r && Math.abs(Math.floor(a / w) - Math.floor(b / w)) <= r;
};

export function invasionAi(world: World): void {
  if (!world.settings.aiEnabled || !isDayStart(world.tick) || world.wars.list.length === 0 || !world.rules) return;
  const nc = world.nations.cols;
  const day = world.tick / 24;
  const actors = [...world.wars.nations()].filter((n) => nc.living[n] === 1 && nc.aiOff[n] !== 1 && (day + n) % STAGGER === 0).sort((a, b) => a - b);
  if (actors.length === 0) return;
  // The nations with a land front today, and those with a formation aboard.
  const { w, h, controller } = world.cells;
  const fronted = new Set<number>();
  const nb: number[] = [];
  for (const c of frontierOf(world)) {
    const a = controller[c]!;
    if (fronted.has(a)) continue;
    for (const q of neighbours4(c, w, h, world.settings.loopingMap, nb)) {
      const b = controller[q]!;
      if (b !== 0 && b !== a && world.wars.atWar(a, b)) fronted.add(a);
    }
  }
  const aboard = new Set<number>();
  for (const id of world.embarked.keys()) aboard.add(world.formations.cols.nation[id]!);
  for (const n of actors) if (!fronted.has(n) && !aboard.has(n)) planLanding(world, n);
}

function planLanding(world: World, n: number): void {
  const f = world.formations;
  const c = f.cols;
  const w = world.cells.w;
  const water = portSeaOf(world);
  const ctl = world.cells.controller;
  const cellOf = (id: number): number => Math.floor(c.y[id]!) * w + Math.floor(c.x[id]!);
  // Its transports at a port it holds: the most room.
  let fleet = 0;
  let room = 0;
  let port = -1;
  f.forEach((id) => {
    if (!world.isFleet(id) || c.nation[id] !== n || c.moving[id] === 1 || c.engaged[id] === 1 || seaRangeOf(world, id) !== undefined) return;
    const r = transportRoom(world, id);
    if (r <= room) return;
    const at = cellOf(id);
    const i = world.ports.findIndex((p, k) => water[k]! >= 0 && ctl[p.cell] === n && near(world, at, water[k]!, world.atSize(AT_PORT_CELLS)));
    if (i < 0) return;
    [fleet, room, port] = [id, r, i];
  });
  if (fleet === 0) return;
  // The enemy's port nearest them whose sea is open to n.
  const z = seaOf(world);
  let target = -1;
  let best = Infinity;
  world.ports.forEach((p, i) => {
    const holder = ctl[p.cell]!;
    const at = water[i]!;
    if (holder === 0 || at < 0 || !world.wars.atWar(n, holder)) return;
    const zone = z.zoneOf[at]!;
    if (zone === 0 || z.closed[zone] === 1) return;
    const sea = seaHolder(world, zone);
    if (sea !== 0 && world.wars.atWar(sea, n)) return;
    const d = seaKm(world, c.x[fleet]!, c.y[fleet]!, (at % w) + 0.5, Math.floor(at / w) + 0.5);
    if (d < best) [best, target] = [d, i];
  });
  if (target < 0) return;
  const goal = world.ports[target]!.cell;
  const [tx, ty] = world.cellPoint(goal);
  const free = (id: number): boolean => !world.offLand(id) && c.nation[id] === n && c.moving[id] !== 1 && c.engaged[id] !== 1 && c.retreat[id] === 0 && c.home[id] === 0;
  // Its formations at the port go aboard.
  let sent = 0;
  const atPort: number[] = [];
  f.forEach((id) => {
    if (free(id) && near(world, cellOf(id), water[port]!, world.atSize(AT_PORT_CELLS))) atPort.push(id);
  });
  for (const id of atPort) {
    if (!orderLanding(world, id, tx, ty)) break;
    sent++;
  }
  if (sent > 0 || atPort.length > 0) return;
  // None there: the nearest free ones on the port's land are sent to it, to fill the room.
  const home = world.ports[port]!.cell;
  const comp = navOf(world).grid.component;
  const land = comp[home]!;
  const by: [number, number][] = [];
  f.forEach((id) => {
    if (!free(id) || comp[cellOf(id)] !== land) return;
    const k = cellOf(id);
    let dx = Math.abs((k % w) - (home % w));
    if (world.settings.loopingMap && dx > w / 2) dx = w - dx;
    by.push([dx + Math.abs(Math.floor(k / w) - Math.floor(home / w)), id]);
  });
  by.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const [px, py] = world.cellPoint(home);
  let men = 0;
  for (const [, id] of by) {
    if (men + c.strength[id]! > room) break;
    if (orderMove(world, id, px, py)) men += c.strength[id]!;
  }
}
