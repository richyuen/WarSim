import { describe, expect, it } from 'vitest';
import { airbaseRoom } from '../../src/sim/data/airbases';
import { AIR_1938, CARRIER_WING, ECONOMY_TABLES_1938, NATIONS_1938, RULES_1938, SIZE_1938, TEMPLATES_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { destroyFormation } from '../../src/sim/systems/elements';
import { assets1938 } from '../helpers/earth';

// PLAN 5.1d: the air forces of the 1938 start: each nation's wings of air.json at its airbases,
// within their room, and a naval bomber group on each carrier of the fleets; paid; no rule of
// the land reads a wing (`World.offLand`); a carrier's wings are lost with it.

const tag = (n: number): string => NATIONS_1938[n - 1]!.tag;
const tIndex = new Map(TEMPLATES_1938.map((t, i) => [t.id, i]));
const aircraft = (ti: number): number => RULES_1938.templates[ti]!.elements.reduce((s, e) => s + e.count * RULES_1938.units[e.unit]!.size, 0);

describe('the air forces of 1938 (PLAN 5.1d)', () => {
  const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(SIZE_1938.w) });
  const w = s.world;
  const c = w.formations.cols;

  it('each nation\'s wings as air.json has them, at its airbases within their room; a group on each carrier', () => {
    const want = new Map<string, number>();
    for (const g of AIR_1938) want.set(`${g.nation} ${g.template}`, (want.get(`${g.nation} ${g.template}`) ?? 0) + g.count);
    const got = new Map<string, number>();
    const used = new Map<number, number>();
    let carriers = 0;
    for (const [id, base] of w.wingBase) {
      expect(w.isWing(id)).toBe(true);
      expect(w.offLand(id)).toBe(true);
      if (base < 0) {
        carriers++;
        expect(TEMPLATES_1938[c.template[id]!]!.id).toBe(CARRIER_WING);
        expect(w.isFleet(-base)).toBe(true);
        expect(c.nation[-base]).toBe(c.nation[id]);
        continue;
      }
      const b = w.airbases[base - 1]!;
      expect(w.cells.controller[b.cell], b.name).toBe(c.nation[id]);
      expect([c.x[id], c.y[id]]).toEqual(w.cellPoint(b.cell));
      used.set(base, (used.get(base) ?? 0) + aircraft(c.template[id]!));
      const k = `${tag(c.nation[id]!)} ${TEMPLATES_1938[c.template[id]!]!.id}`;
      got.set(k, (got.get(k) ?? 0) + 1);
    }
    expect(got).toEqual(want);
    for (const [base, n] of used) expect(n, w.airbases[base - 1]!.name).toBeLessThanOrEqual(airbaseRoom(w.airbases[base - 1]!));
    // The carriers of the fleets: two to a carrier group.
    let cv = 0;
    w.formations.forEach((id) => {
      if (w.isFleet(id) && TEMPLATES_1938[c.template[id]!]!.id === 'carrier_group') cv += 2;
    });
    expect(carriers).toBe(cv);
    expect(carriers).toBeGreaterThan(0);
    // Paid: an air template has an upkeep.
    for (const g of new Set(AIR_1938.map((x) => x.template))) expect(ECONOMY_TABLES_1938.templateUpkeep[tIndex.get(g)!]!).toBeGreaterThan(0);
  });

  it('a month on, every wing is at its base, whole, untouched by the rules of the land', () => {
    const t = new Sim({ scenario: '1938', seed: 7, assets: assets1938(SIZE_1938.w) });
    const tw = t.world;
    const start = new Map([...tw.wingBase].map(([id]) => [id, tw.formations.cols.strength[id]!]));
    t.step(24 * 30);
    const tc = tw.formations.cols;
    let lost = 0;
    for (const [id, strength] of start) {
      if (!tw.formations.has(id)) {
        lost++;
        continue;
      }
      const base = tw.wingBase.get(id)!;
      if (base > 0) expect([tc.x[id], tc.y[id]]).toEqual(tw.cellPoint(tw.airbases[base - 1]!.cell));
      else if (base < 0) expect([tc.x[id], tc.y[id]]).toEqual([tc.x[-base], tc.y[-base]]);
      expect(tc.moving[id]).toBe(0);
      expect(tc.engaged[id]).toBe(0);
      expect(tc.strength[id]).toBe(strength);
    }
    // Only a carrier's wing is lost, with its carrier.
    expect(lost).toBeLessThanOrEqual(4);
  });

  it('a carrier sunk takes its wings; a save loads with them, the same game', () => {
    const t = new Sim({ scenario: '1938', seed: 1, assets: assets1938(SIZE_1938.w) });
    const tw = t.world;
    const [wing, base] = [...tw.wingBase].find(([, b]) => b < 0)!;
    const mates = [...tw.wingBase].filter(([, b]) => b === base).map(([id]) => id);
    const u = new Sim({ scenario: '1938', seed: 1, assets: assets1938(SIZE_1938.w) });
    u.load(t.save());
    expect([...u.world.wingBase]).toEqual([...tw.wingBase]);
    u.step(24);
    t.step(24);
    expect(u.hash()).toBe(t.hash());
    destroyFormation(tw, -base);
    t.step(1);
    for (const id of mates) expect(tw.formations.has(id) && tw.wingBase.has(id), String(id)).toBe(false);
    expect(mates).toContain(wing);
  });
});
