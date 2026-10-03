import { describe, expect, it } from 'vitest';
import { dateOfTick } from '../../src/shared/calendar';
import { xxhash32View } from '../../src/sim/core/hash';
import type { ScenarioAssets } from '../../src/shared/protocol';
import { NATIONS_1938, SIZE_1938, TEMPLATES_LAND } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { CITIES_1938, assets1938, OOB_1938, politicalMap1938 } from '../helpers/earth';

// PLAN 1.9a: the 1938 scenario boots as sim state (Node here; the worker in e2e), carrying the
// political map, nations, cities and starting OOB, and is deterministic and saveable.

const assets: ScenarioAssets = assets1938(SIZE_1938.w);

describe('1938 world (PLAN 1.9a)', () => {
  const t0 = performance.now();
  const sim = new Sim({ scenario: '1938', seed: 1938, assets });
  const buildMs = performance.now() - t0;
  const w = sim.world;
  const map = politicalMap1938(SIZE_1938.w);

  it('builds in well under a second at M and starts on 1 January 1938', () => {
    expect(buildMs).toBeLessThan(2000);
    expect([w.cells.w, w.cells.h]).toEqual([2048, 1024]);
    expect(dateOfTick(w.startDay, w.tick)).toEqual({ year: 1938, month: 1, day: 1, hour: 0 });
  });

  it('cell layers equal the political map; every province cell is kept', () => {
    // Hash comparison: vitest's deep equality is far too slow on 2M-cell typed arrays.
    expect(xxhash32View(w.cells.owner)).toBe(xxhash32View(map.owner));
    expect(xxhash32View(w.cells.controller)).toBe(xxhash32View(map.controller));
    expect(xxhash32View(w.cells.terrain)).toBe(xxhash32View(map.terrain));
    expect(xxhash32View(w.cells.province)).toBe(xxhash32View(map.provinceIds));
  });

  it('nations follow nations.json order with colour, land, capital and living flag', () => {
    expect(w.nations.count).toBe(NATIONS_1938.length);
    const n = w.nations.cols;
    NATIONS_1938.forEach((def, i) => {
      const id = i + 1;
      expect(n.color[id]).toBe(parseInt(def.color.slice(1), 16));
      expect(n.living[id], def.tag).toBe(def.alive === false ? 0 : 1);
      if (def.alive !== false) {
        expect(n.cells[id], def.tag).toBeGreaterThan(0);
        expect(n.capitalX[id]! + n.capitalY[id]!, `${def.tag} capital`).toBeGreaterThan(0);
      } else expect(n.cells[id]).toBe(0);
    });
  });

  it('cities and formations come from the scenario data', () => {
    expect(w.cities.count).toBe(map.cities.length);
    expect(w.cities.count).toBeGreaterThan(0.98 * CITIES_1938.length);
    let capitals = 0;
    w.cities.forEach((id) => {
      if (w.cities.cols.capitalOf[id]! > 0) capitals++;
    });
    expect(capitals).toBe(NATIONS_1938.filter((n) => n.alive !== false).length);
    expect(w.formations.count).toBe(OOB_1938.reduce((s, g) => s + g.count, 0));
    const f = w.formations.cols;
    w.formations.forEach((id) => {
      expect(TEMPLATES_LAND[f.template[id]!]).toBeDefined();
      expect(f.strength[id]).toBeGreaterThan(0);
      expect(w.cells.controller[Math.floor(f.y[id]!) * 2048 + Math.floor(f.x[id]!)]).toBeGreaterThan(0);
    });
  });

  it('is deterministic and survives a save/load round trip bit for bit', () => {
    const other = new Sim({ scenario: '1938', seed: 1938, assets });
    expect(other.hash()).toBe(sim.hash());
    sim.step(48);
    other.step(48);
    expect(other.hash()).toBe(sim.hash());
    const bytes = sim.save();
    const fresh = new Sim({ scenario: '1938', seed: 7, assets });
    fresh.load(bytes);
    expect(fresh.hash()).toBe(sim.hash());
    expect(Buffer.from(fresh.save()).equals(Buffer.from(bytes))).toBe(true);
  });

  it('refuses to start without its map assets', () => {
    expect(() => new Sim({ scenario: '1938', seed: 1 })).toThrow(/needs its map assets/);
  });
});

// Review in PLAN 1.41: the scenario file's settings are the world's (they were mostly unread).
describe('1938 scenario settings are applied', () => {
  it('settings and revival limits come from scenario.json', async () => {
    const { default: scen } = await import('../../data/scenarios/1938/scenario.json', { with: { type: 'json' } });
    const { REVIVAL_COOLDOWN } = await import('../../src/sim/systems/revival');
    const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(SIZE_1938.w) });
    const set = s.world.settings;
    expect([set.ceMode, set.winnerTakesAll, set.loopingMap, set.aiEnabled, set.revoltMode]).toEqual([
      scen.settings.combatEfficiency,
      scen.settings.winnerTakesAll,
      scen.settings.loopingMap,
      scen.settings.aiEnabled,
      scen.settings.revoltMode,
    ]);
    s.world.nations.forEach((n) => expect(s.world.nations.cols.revivalsLeft[n]).toBe(scen.settings.revival.maxPerNation));
    expect(scen.settings.revival.cooldownDays * 24).toBe(REVIVAL_COOLDOWN);
  }, 120_000);
});
