import { describe, expect, it } from 'vitest';
import { NATIONS_1938, SIZE_1938, TEMPLATES_LAND } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { forceRevolt } from '../../src/sim/systems/revolts';
import type { World } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';
import { strayNaN } from '../helpers/stateNumbers';

// PLAN 2.12 (the critic's R2-B4): a table of the state grows by doubling, and a growth moves it
// to new arrays. `spawnRebels` took the nations' columns, then created the nation's row, and
// wrote the nation into the columns it had taken: when that row made the table grow (the 128th
// id of a 1938 game), every write fell outside the old arrays and was lost. The nation was
// founded dead, without an origin, a colour or a capital, at war, and its militia stood at
// (NaN, NaN).
//
// And a table's size is in no save: a loaded table is as long as the save's rows, where the
// table of the game that went on has doubled. The two grew at different ids from then on, so
// they lost different nations: a loaded game did not go on as the game that was saved.

const sim1938 = (seed = 5): Sim => new Sim({ scenario: '1938', seed, assets: assets1938(SIZE_1938.w) });

/** The next province from `at.p` on whose revolt founds a new nation: the nation (0: none left). */
function found(world: World, at: { p: number }): number {
  while (at.p < world.provinces.count) {
    const before = world.nations.highWater;
    forceRevolt(world, at.p++);
    if (world.nations.highWater > before) return world.nations.highWater - 1;
  }
  return 0;
}

/** What a nation founded by a revolt has: checked for nation `id`. */
function expectWhole(world: World, id: number, what: string): void {
  const nc = world.nations.cols;
  expect(world.nations.has(id), `${what}: a row`).toBe(true);
  expect(nc.living[id], `${what}: living`).toBe(1);
  expect(nc.origin[id], `${what}: the province it rose in`).toBeGreaterThan(0);
  expect(nc.color[id], `${what}: a colour`).toBeGreaterThan(0);
  expect(nc.incomeMult[id], `${what}: income multiplier`).toBe(1);
  expect(nc.manpowerMult[id], `${what}: manpower multiplier`).toBe(1);
  expect(nc.gold[id], `${what}: gold`).toBeGreaterThan(0);
  const [cx, cy] = [nc.capitalX[id]!, nc.capitalY[id]!];
  // (Where there is no city the capital is the middle of the area, which need not be its land.)
  expect(Number.isFinite(cx) && Number.isFinite(cy) && cx > 0 && cy > 0, `${what}: a capital, at (${cx}, ${cy})`).toBe(true);
  const fc = world.formations.cols;
  let militia = 0;
  world.formations.forEach((f) => {
    if (fc.nation[f] !== id) return;
    militia++;
    expect(Number.isFinite(fc.x[f]!) && Number.isFinite(fc.y[f]!), `${what}: its militia ${f} at (${fc.x[f]}, ${fc.y[f]})`).toBe(true);
  });
  expect(militia, `${what}: militia`).toBeGreaterThan(0);
}

describe('a table that grows (PLAN 2.12)', () => {
  it('a nation founded as the nations table grows is as whole as any other', () => {
    const sim = sim1938();
    const world = sim.world;
    const cap0 = world.nations.capacity;
    const at = { p: 1 };
    let grew = 0;
    // Up to the growth and two nations past it.
    for (let past = 0; past < 3; ) {
      const cap = world.nations.capacity;
      const id = found(world, at);
      expect(id, 'provinces left to revolt').toBeGreaterThan(0);
      const growing = world.nations.capacity !== cap;
      if (growing) grew = id;
      if (grew !== 0) past++;
      expectWhole(world, id, `nation ${id}${growing ? `, whose row made the table grow from ${cap} to ${world.nations.capacity}` : ''}`);
    }
    expect(grew, 'a nation whose row made the table grow').toBeGreaterThan(0);
    expect(world.nations.capacity).toBeGreaterThan(cap0);
    // And no number of the state is NaN, but for "no place" in the history's rows.
    expect(strayNaN(world), 'NaN in the state').toEqual([]);
  }, 60_000);

  it('a loaded world, whose tables are as long as the save, goes on as the world that was saved', () => {
    const a = sim1938();
    const at = { p: 1 };
    // Past the growth: the table of the world that goes on has doubled.
    const cap0 = a.world.nations.capacity;
    while (a.world.nations.highWater < cap0 + 2) expect(found(a.world, at), 'provinces left to revolt').toBeGreaterThan(0);
    expect(a.world.nations.capacity).toBe(cap0 * 2);
    const b = sim1938();
    b.load(a.save());
    expect(b.hash()).toBe(a.hash());
    // The loaded table is shorter (as long as its rows), so its next nation makes it grow.
    expect(b.world.nations.capacity, 'the loaded table').toBeLessThan(a.world.nations.capacity);
    const p = at.p;
    const ida = found(a.world, { p });
    const idb = found(b.world, { p });
    expect(idb).toBe(ida);
    expectWhole(b.world, idb, `nation ${idb} of the loaded world`);
    expect(b.hash(), 'after one more revolt').toBe(a.hash());
    a.step(48);
    b.step(48);
    expect(b.hash(), 'two days on').toBe(a.hash());
    // A world loaded a second time, into tables another game has left longer: the same again.
    const c = sim1938(77);
    const atc = { p: 40 };
    while (c.world.nations.highWater < cap0 * 2 + 2) expect(found(c.world, atc), 'provinces left to revolt').toBeGreaterThan(0);
    c.step(24);
    c.load(a.save());
    const d = sim1938();
    d.load(a.save());
    expect(c.hash()).toBe(d.hash());
    for (const s of [c, d]) {
      found(s.world, { p: at.p + 30 });
      s.step(48);
    }
    expect(c.hash(), 'a world loaded into a used sim, against one loaded into a fresh sim').toBe(d.hash());
  }, 120_000);

  it('where a table keeps its rows is no part of the game: every create moving the tables changes nothing', () => {
    // Game B's tables move to new arrays at every create and spoil the old ones (`volatile`):
    // a reference to columns that is held across a create reads rubbish there and writes
    // nowhere. In game A that happens only at a growth, at a size nobody chose.
    const GER = NATIONS_1938.findIndex((n) => n.tag === 'GER') + 1;
    const BEL = NATIONS_1938.findIndex((n) => n.tag === 'BEL') + 1;
    const INF = TEMPLATES_LAND.findIndex((t) => t.id === 'infantry_div');
    expect(GER > 0 && BEL > 0 && INF >= 0).toBe(true);
    const games = [sim1938(11), sim1938(11)];
    const creates = { nations: 0, formations: 0, elements: 0, production: 0, cities: 0 };
    const b = games[1]!.world;
    const tables = { nations: b.nations, formations: b.formations, elements: b.elements, production: b.production, cities: b.cities };
    for (const t of Object.values(tables)) t.volatile = true;
    const count = (): void => {
      for (const [k, t] of Object.entries(tables)) creates[k as keyof typeof creates] = t.moves;
    };
    const day = (d: number): void => {
      for (const g of games) {
        if (d === 0) {
          for (const province of [3, 40, 90, 150, 210]) g.command({ kind: 'spawnRevolt', province });
          g.command({ kind: 'queueFormation', nation: GER, template: INF });
          g.command({ kind: 'spawnFormation', nation: GER, x: g.world.nations.cols.capitalX[GER]!, y: g.world.nations.cols.capitalY[GER]!, strength: 1, template: INF });
          g.command({ kind: 'spawnCity', x: g.world.nations.cols.capitalX[GER]! + 3, y: g.world.nations.cols.capitalY[GER]!, name: 'Neustadt', size: 2 });
          // Unrest all over, for the monthly system to found nations of its own accord in this
          // first tick, which is a month's start (the forced revolts above come in by a command).
          for (let province = 300; province < 700; province++) g.command({ kind: 'setUnrest', province, value: 100 });
        }
        if (d === 5) g.command({ kind: 'collapseNation', nation: BEL });
        if (d === 12) g.command({ kind: 'reviveNation', nation: BEL });
        g.step(24);
      }
    };
    let risen = 0;
    for (let d = 0; d < 45; d++) {
      const before = b.nations.moves;
      day(d);
      if (d === 0) risen = b.nations.moves - before;
      expect(games[1]!.hash(), `day ${d + 1}`).toBe(games[0]!.hash());
    }
    expect(risen, 'nations founded on the first day, five of them by command').toBeGreaterThan(15);
    count();
    // The game made rows of every kind while the tables moved.
    for (const [k, n] of Object.entries(creates)) expect(n, `creates in ${k}`).toBeGreaterThan(0);
    console.log(`creates with the tables moving: ${JSON.stringify(creates)}`);
  }, 180_000);
});
