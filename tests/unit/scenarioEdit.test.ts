import { describe, expect, it } from 'vitest';
import type { Command } from '../../src/shared/commands';
import { cellOf } from '../../src/sim/data/terrain';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { NO_DEF } from '../../src/sim/scenarioEdit';
import { Sim } from '../../src/sim/sim';
import { navOf } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';
import { nationId } from '../helpers/sim1938';

// PLAN 1.36 (unit part): cities, capitals, cores/claims (preset revolts), gold and annexation.

const { w: W, h: H } = SIZE_1938;
const [GER, POL, AUT, ETH] = ['GER', 'POL', 'AUT', 'ETH'].map(nationId) as number[];
const [lx, ly] = cellOf(19.0, 51.0, W, H); // Polish countryside near Łódź

function sim(): Sim {
  const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
  s.world.settings.aiEnabled = false;
  return s;
}
const run = (s: Sim, ...cmds: Command[]): void => {
  for (const c of cmds) s.command(c);
  s.applyNow();
};
const newCity = (s: Sim): number => {
  let id = 0;
  s.world.cities.forEach((c) => {
    if (s.world.cities.cols.def[c] === NO_DEF) id = c;
  });
  return id;
};

describe('scenario editing (PLAN 1.36)', () => {
  it('a placed city has its name and economy; removing it takes both back', () => {
    const s = sim();
    const cell = Math.floor(ly) * W + Math.floor(lx);
    const econ0 = s.world.cells.econ[cell]!;
    run(s, { kind: 'spawnCity', x: lx, y: ly, name: ' Nowe Miasto ', size: 3 });
    const id = newCity(s);
    expect(id).not.toBe(0);
    expect(s.world.cityNames.get(id)).toBe('Nowe Miasto');
    expect(s.world.cells.econ[cell]!).toBeGreaterThan(econ0);
    run(s, { kind: 'spawnCity', x: lx, y: ly, name: 'Twice', size: 1 }); // one city per cell
    expect([...s.world.cityNames.values()]).toEqual(['Nowe Miasto']);
    run(s, { kind: 'removeCity', city: id });
    expect(s.world.cities.has(id)).toBe(false);
    expect(s.world.cells.econ[cell]).toBe(econ0);
  });

  it('make capital moves the capital; removing it relocates to another city', () => {
    const s = sim();
    run(s, { kind: 'spawnCity', x: lx, y: ly, name: 'Stolica', size: 2 });
    const id = newCity(s);
    run(s, { kind: 'setCapital', nation: POL!, city: id });
    expect(s.world.cities.cols.capitalOf[id]).toBe(POL);
    expect(s.world.nations.cols.capitalX[POL!]).toBe(s.world.cities.cols.x[id]);
    let capitals = 0;
    s.world.cities.forEach((c) => {
      if (s.world.cities.cols.capitalOf[c] === POL) capitals++;
    });
    expect(capitals).toBe(1);
    run(s, { kind: 'setCapital', nation: GER!, city: id }); // not Germany's land
    expect(s.world.cities.cols.capitalOf[id]).toBe(POL);
    run(s, { kind: 'removeCity', city: id });
    let moved = 0;
    s.world.cities.forEach((c) => {
      if (s.world.cities.cols.capitalOf[c] === POL) moved = c;
    });
    expect(moved).not.toBe(0);
  });

  it('cores and claims: a dead nation’s claim is a preset revolt that revives it', () => {
    const s = sim();
    const p = s.world.cells.province[Math.floor(ly) * W + Math.floor(lx)]!;
    run(s, { kind: 'setCore', province: p, nation: ETH!, on: true });
    expect(s.world.provinces.coresOf(p)).toEqual([POL, ETH]);
    // Unrest high, then a revolt there brings Ethiopia back instead of new rebels.
    run(s, { kind: 'setUnrest', province: p, value: 100 }, { kind: 'spawnRevolt', province: p });
    expect(s.world.nations.cols.living[ETH!]).toBe(1);
    expect(s.world.cells.owner[navOf(s.world).graph.centre[p]!]).toBe(ETH);
    run(s, { kind: 'setCore', province: p, nation: ETH!, on: false });
    expect(s.world.provinces.coresOf(p)).not.toContain(ETH);
  });

  it('gold is set; annexation takes land, formations and cores and ends the target', () => {
    const s = sim();
    run(s, { kind: 'setGold', nation: AUT!, value: 12345 });
    expect(s.world.nations.cols.gold[AUT!]).toBe(12345);
    const nc = s.world.nations.cols;
    const land = nc.cells[GER!]! + nc.cells[AUT!]!;
    const autCores = s.world.provinces.provincesOf(AUT!).filter((p) => s.world.provinces.core[p] === AUT);
    run(s, { kind: 'annexNation', annexer: GER!, target: AUT! });
    expect(nc.living[AUT!]).toBe(0);
    expect(nc.cells[GER!]).toBe(land);
    for (const p of autCores) expect(s.world.provinces.core[p]).toBe(GER);
    let autFormations = 0;
    s.world.formations.forEach((f) => {
      if (s.world.formations.cols.nation[f] === AUT) autFormations++;
    });
    expect(autFormations).toBe(0);
  });

  it('city names and edits survive save/load and replay identically', () => {
    const s = sim();
    run(s, { kind: 'spawnCity', x: lx, y: ly, name: 'Gdzieś', size: 2 }, { kind: 'renameNation', nation: POL!, name: 'Rzeczpospolita' });
    const t = sim();
    t.load(s.save());
    expect([...t.world.cityNames.values()]).toEqual(['Gdzieś']);
    expect(t.world.names.get(POL!)).toBe('Rzeczpospolita');
    expect(t.hash()).toBe(s.hash());
    s.step(48);
    t.step(48);
    expect(t.hash()).toBe(s.hash());
  });
});
