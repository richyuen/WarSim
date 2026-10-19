import { describe, expect, it } from 'vitest';
import cities1938 from '../../data/scenarios/1938/cities.json' with { type: 'json' };
import { EventKind } from '../../src/shared/events';
import { filterHistory, kindName, NO_FILTER, TICKER_KINDS } from '../../src/shared/history';
import { cellOf } from '../../src/sim/data/terrain';
import { HISTORY_STRIDE } from '../../src/sim/history';
import { NATIONS_1938, SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import type { World } from '../../src/sim/world';
import en from '../../src/ui/i18n/en.json' with { type: 'json' };
import { historyText } from '../../src/ui/historyText';
import { historyRows, tickerRows } from '../../src/worker/historyRows';
import { Lives } from '../../src/worker/lives';
import { assets1938 } from '../helpers/earth';
import { nationId } from '../helpers/sim1938';

// PLAN 7.33b (critic run 9, God Mode: "Spawn nation, Found city and Raze city leave no ticker or
// history row"): each act a row of its own kind, in the history, the ticker and the type filter,
// a town by the name it had when the act was done.

const { w: W, h: H } = SIZE_1938;
const [POL, CZE] = ['POL', 'CZS'].map(nationId) as number[];
const nationName = (n: number): string => `nation.${NATIONS_1938[n - 1]?.tag ?? ''}`;
const defName = (d: number): string => cities1938.cities[d]?.name ?? '';
const cityName = (w: World) => (v: number): string => defName(w.cities.cols.def[v]!) || (w.cityNames.get(v) ?? '');
const rowsOf = (w: World) => historyRows(w, nationName, cityName(w), defName);
const tickerOf = (w: World) => tickerRows(w, nationName, cityName(w), defName);
const kindsOf = (w: World): number[] => {
  const out: number[] = [];
  for (let i = 0; i < w.history.rows.length; i += HISTORY_STRIDE) out.push(w.history.rows[i + 1]!);
  return out;
};
const fresh = (): Sim => new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
/** The city row of the scenario's city named `name`. */
function cityRow(w: World, name: string): number {
  const def = cities1938.cities.findIndex((c) => c.name === name);
  let row = 0;
  w.cities.forEach((id) => {
    if (w.cities.cols.def[id] === def) row = id;
  });
  return row;
}

describe("God Mode's acts in the history (PLAN 7.33b)", () => {
  it('Spawn nation: a NationSpawned row, not a revolt; a birth in the lives, no revolt of its holder', () => {
    const s = fresh();
    const [x, y] = cellOf(21.0, 52.23, W, H);
    const p = s.world.cells.province[Math.floor(y) * W + Math.floor(x)]!;
    const lives = new Lives();
    s.step(48);
    lives.of(s.world);
    const n = s.world.nations.highWater;
    s.command({ kind: 'spawnNation', province: p, size: 3 });
    s.step(1);
    const kinds = kindsOf(s.world);
    expect(kinds).toContain(EventKind.NationSpawned);
    expect(kinds).not.toContain(EventKind.RevoltSpawned);
    const row = rowsOf(s.world).find((r) => r.kind === EventKind.NationSpawned)!;
    expect([row.a, row.b]).toEqual([n, POL]);
    expect(historyText(row)).toMatch(/^.+ was set up on land of Poland$/);
    expect(TICKER_KINDS.has(EventKind.NationSpawned)).toBe(true);
    expect(tickerOf(s.world).map((r) => r.kind)).toContain(EventKind.NationSpawned);
    s.step(24);
    const life = lives.of(s.world);
    expect(life.find((l) => l.id === POL)!.revolts).toBe(0);
    const born = life.find((l) => l.id === n)!;
    expect(born.living).toBe(true);
    // Born at the act (tick 48), not alive from the start as a nation of the scenario.
    expect(born.age * 24 * 365.2425).toBeCloseTo(s.world.tick - row.tick, 6);
    expect(row.tick).toBe(48);
  });

  it('Found city: a CitySpawned row with the town named, kept after the town is razed and its row reused', () => {
    const s = fresh();
    const [x, y] = cellOf(19.0, 51.0, W, H);
    s.command({ kind: 'spawnCity', x, y, name: 'New Town', size: 2 });
    s.step(1);
    const founded = rowsOf(s.world).find((r) => r.kind === EventKind.CitySpawned)!;
    expect(founded.bn).toBe('nation.POL');
    expect(historyText(founded)).toBe('New Town was founded in Poland');
    expect(tickerOf(s.world).map((r) => r.kind)).toContain(EventKind.CitySpawned);
    // Razed, and its row given to another town: the founding still names New Town, the raze too.
    const row = founded.a;
    s.command({ kind: 'removeCity', city: row });
    s.step(1);
    s.command({ kind: 'spawnCity', x, y, name: 'Other Town', size: 1 });
    s.step(1);
    expect(s.world.cityNames.get(row)).toBe('Other Town'); // the row reused
    const texts = rowsOf(s.world)
      .filter((r) => r.kind === EventKind.CitySpawned || r.kind === EventKind.CityRazed)
      .map(historyText);
    expect(texts).toEqual(['New Town was founded in Poland', 'New Town in Poland was razed', 'Other Town was founded in Poland']);
    // A save and load keeps the names, and the hash.
    const t = new Sim({ scenario: '1938', seed: 2, assets: assets1938(W) });
    t.load(s.save());
    expect(t.hash()).toBe(s.hash());
    expect(rowsOf(t.world).filter((r) => r.kind === EventKind.CitySpawned || r.kind === EventKind.CityRazed).map(historyText)).toEqual(texts);
    // A scenario exported from the game starts with no history, and no names of its towns; the game keeps them.
    const u = new Sim({ scenario: '1938', seed: 3, assets: assets1938(W) });
    u.load(s.exportScenario().bytes);
    expect(u.world.history.rows).toEqual([]);
    expect(u.world.history.towns.size).toBe(0);
    expect(s.world.history.towns.size).toBe(3);
  });

  it("Raze city: a scenario city's CityRazed row names it and its holder", () => {
    const s = fresh();
    const prague = cityRow(s.world, 'Prague');
    expect(prague).toBeGreaterThan(0);
    s.command({ kind: 'removeCity', city: prague });
    s.step(1);
    expect(s.world.cities.has(prague)).toBe(false);
    const razed = rowsOf(s.world).find((r) => r.kind === EventKind.CityRazed)!;
    expect(razed.b).toBe(CZE);
    expect(historyText(razed)).toBe('Prague in Czechoslovakia was razed');
    const tick = tickerOf(s.world).find((r) => r.kind === EventKind.CityRazed)!;
    expect(historyText(tick)).toBe('Prague in Czechoslovakia was razed');
    expect([tick.x, tick.y]).toEqual([razed.x, razed.y]);
  });

  it("the history's type filter lists the three kinds, each with its label, and finds their rows", () => {
    const s = fresh();
    const [x, y] = cellOf(21.0, 52.23, W, H);
    s.command({ kind: 'spawnNation', province: s.world.cells.province[Math.floor(y) * W + Math.floor(x)]!, size: 2 });
    const [cx, cy] = cellOf(19.0, 51.0, W, H);
    s.command({ kind: 'spawnCity', x: cx, y: cy, name: 'New Town', size: 2 });
    s.command({ kind: 'removeCity', city: cityRow(s.world, 'Prague') });
    s.step(1);
    const rows = rowsOf(s.world);
    // The kinds the panel's select lists: those of the rows (HistoryPanel).
    const listed = new Set(rows.map((r) => r.kind));
    for (const k of [EventKind.NationSpawned, EventKind.CitySpawned, EventKind.CityRazed]) {
      expect(listed.has(k), kindName(k)).toBe(true);
      expect(`history.type.${kindName(k)}` in en, kindName(k)).toBe(true);
      expect(filterHistory(rows, { ...NO_FILTER, kind: k }, s.world.startDay)).toHaveLength(1);
    }
    // The nation filter finds a town's holder.
    expect(filterHistory(rows, { ...NO_FILTER, nation: CZE! }, s.world.startDay).map((r) => r.kind)).toEqual([EventKind.CityRazed]);
  });
});
