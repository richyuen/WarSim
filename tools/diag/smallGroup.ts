/**
 * PLAN 7.55's measure: a nation whose transport groups have room under a division's. From each
 * saved state, for the nation named, on day 0 and for `days` days (after each day's 24 hours):
 * - its transport groups: id, transports' room (`transportRoom`, men), under way or not, the port
 *   of its own they stand at (index, name), and whether it is in a sea battle;
 * - its land formations: how many, the smallest and the median strength, and those on the land of
 *   the port its biggest group stands at (the smallest there);
 * - ADR-518's order (`economic.ts` 2c): `wantsTransport` today, a transport group in training, its
 *   gold, its income (`budgetOf`), `POOR_INCOME`, a shipyard;
 * - over the days: transport groups new (ordered or launched), formations that went aboard.
 *
 * Usage: npx tsx tools/diag/smallGroup.ts <out.json> <days> <seed:state.bin:TAG> [...]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { budgetOf, POOR_INCOME, wantsTransport } from '../../src/sim/ai/economic';
import { BUILD_MIX_1938, ECONOMY_TABLES_1938, SIZE_1938, TAGS_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { transportRoom } from '../../src/sim/systems/amphibious';
import { monthlyAccounts } from '../../src/sim/systems/economy';
import { AT_PORT_CELLS } from '../../src/sim/systems/navalCombat';
import { shipyard } from '../../src/sim/systems/production';
import { navOf, portSeaOf, seaRangeOf, type World } from '../../src/sim/world';
import { loadAssets1938 } from '../headless/assets';

const out = process.argv[2]!;
const days = Number(process.argv[3]);
const cases = process.argv.slice(4).map((a) => {
  const [seed, src, tag] = a.split(':');
  return { seed: Number(seed), src: src!, tag: tag! };
});

const near = (world: World, a: number, b: number, r: number): boolean => {
  const ww = world.cells.w;
  let dx = Math.abs((a % ww) - (b % ww));
  if (world.settings.loopingMap && dx > ww / 2) dx = ww - dx;
  return dx <= r && Math.abs(Math.floor(a / ww) - Math.floor(b / ww)) <= r;
};

const rows: unknown[] = [];
for (const { seed, src, tag } of cases) {
  const s = new Sim({ scenario: '1938', seed, assets: loadAssets1938(SIZE_1938.w) });
  const w = s.world;
  s.load(new Uint8Array(readFileSync(src)));
  const n = TAGS_1938.indexOf(tag) + 1;
  const c = w.formations.cols;
  const cw = w.cells.w;
  const cellOf = (id: number): number => Math.floor(c.y[id]!) * cw + Math.floor(c.x[id]!);
  const transport = BUILD_MIX_1938.fleets!.transport;
  const water = portSeaOf(w);
  const comp = navOf(w).grid.component;
  const median = (a: number[]): number => (a.length === 0 ? 0 : [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)]!);

  const read = (): Record<string, unknown> => {
    const groups: unknown[] = [];
    const fleets: number[] = [];
    let bigPort = -1;
    let bigRoom = 0;
    w.formations.forEach((id) => {
      if (c.nation[id] !== n || !w.isFleet(id)) return;
      fleets.push(id);
      const room = transportRoom(w, id);
      if (room <= 0) return;
      const at = cellOf(id);
      const port = w.ports.findIndex((p, k) => water[k]! >= 0 && w.cells.controller[p.cell] === n && near(w, at, water[k]!, w.atSize(AT_PORT_CELLS)));
      groups.push({ id, room, moving: c.moving[id], engaged: c.engaged[id], seaRange: seaRangeOf(w, id) !== undefined, port, portName: port >= 0 ? w.ports[port]!.name : null });
      if (port >= 0 && c.moving[id] !== 1 && room > bigRoom) [bigRoom, bigPort] = [room, port];
    });
    const land: number[] = [];
    const onPortLand: number[] = [];
    w.formations.forEach((id) => {
      if (c.nation[id] !== n || w.isFleet(id) || w.isWing(id) || w.offLand(id)) return;
      land.push(c.strength[id]!);
      if (bigPort >= 0 && comp[cellOf(id)] === comp[w.ports[bigPort]!.cell]) onPortLand.push(c.strength[id]!);
    });
    let training = 0;
    w.production.forEach((p) => {
      if (w.production.cols.nation[p] === n && w.production.cols.template[p] === transport) training++;
    });
    const { income } = budgetOf(w, n, monthlyAccounts(w, ECONOMY_TABLES_1938));
    return {
      groups,
      bigRoom,
      bigPort: bigPort >= 0 ? w.ports[bigPort]!.name : null,
      land: { count: land.length, min: land.length ? Math.min(...land) : 0, median: median(land) },
      onPortLand: { count: onPortLand.length, min: onPortLand.length ? Math.min(...onPortLand) : 0, median: median(onPortLand) },
      wantsTransport: wantsTransport(w, n, transport, fleets, ECONOMY_TABLES_1938.templateStrength[BUILD_MIX_1938.infantry] ?? 0),
      division: ECONOMY_TABLES_1938.templateStrength[BUILD_MIX_1938.infantry],
      transportTraining: training,
      gold: Math.round(w.nations.cols.gold[n]!),
      income: Math.round(income),
      poor: income < POOR_INCOME,
      shipyard: shipyard(w, n) >= 0,
      price: w.rules!.templates[transport]!.gold,
    };
  };
  const day0 = read();
  const seen = new Set<number>();
  w.formations.forEach((id) => {
    if (c.nation[id] === n && w.isFleet(id) && transportRoom(w, id) > 0) seen.add(id);
  });
  const boarded = new Set<number>();
  let ordered = 0;
  const newGroups: { day: number; id: number; room: number }[] = [];
  for (let d = 1; d <= days; d++) {
    s.step(24, (ww) => {
      ww.out.events.length = 0;
      ww.out.fires.length = 0;
    });
    w.production.forEach((p) => {
      if (w.production.cols.nation[p] === n && w.production.cols.template[p] === transport && !seen.has(-p - 1)) {
        seen.add(-p - 1);
        ordered++;
      }
    });
    w.formations.forEach((id) => {
      if (c.nation[id] === n && w.isFleet(id) && transportRoom(w, id) > 0 && !seen.has(id)) {
        seen.add(id);
        newGroups.push({ day: d, id, room: transportRoom(w, id) });
      }
    });
    for (const id of w.embarked.keys()) if (c.nation[id] === n) boarded.add(id);
  }
  const row = { seed, src, tag, day0, after: read(), ordered, newGroups, boarded: boarded.size };
  rows.push(row);
  process.stderr.write(`${JSON.stringify(row)}\n`);
}
writeFileSync(out, JSON.stringify(rows, null, 1));
