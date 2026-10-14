import { describe, expect, it } from 'vitest';
import { airAi } from '../../src/sim/ai/air';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { kmFromBase, wingRange } from '../../src/sim/systems/air';
import type { World } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';
import { nationId } from '../helpers/sim1938';

// PLAN 5.12b (the critic's R5-B2): on seed 7321 no land formation was in contact anywhere from
// about year 13, with 60 nations at war, and the air AI, which tasked only from contact, left
// every wing on the ground. A nation at war now flies where its enemy's land forces are in
// range, in contact or not: its strikers at the nearest of them, its fighters over it.

const [GER, POL] = ['GER', 'POL'].map(nationId) as [number, number];
const cls = (w: World, id: number): string => w.rules!.units[w.rules!.templates[w.formations.cols.template[id]!]!.elements[0]!.unit]!.cls;

describe('the air war with no front in contact (PLAN 5.12b)', () => {
  it('a striker strikes, and a fighter patrols over, the enemy\'s land formation nearest it in range', () => {
    const w: World = new Sim({ scenario: '1938', seed: 1, assets: assets1938(SIZE_1938.w) }).world;
    const c = w.formations.cols;
    w.wars.start([GER], [POL], 0);
    // No formation in contact anywhere.
    w.formations.forEach((id) => (c.engaged[id] = 0));
    const polish: number[] = [];
    w.formations.forEach((id) => {
      if (!w.isFleet(id) && !w.offLand(id) && c.nation[id] === POL) polish.push(id);
    });
    airAi(w);
    let checked = 0;
    for (const [id, base] of w.wingBase) {
      if (base <= 0 || c.nation[id] !== GER || !['fighter', 'cas', 'bomber_tac'].includes(cls(w, id))) continue;
      const inRange = polish.filter((g) => kmFromBase(w, id, c.x[g]!, c.y[g]!) <= wingRange(w, id));
      const m = w.wingMission.get(id);
      if (inRange.length === 0) continue;
      // The nearest in range, at its place.
      const nearest = inRange.sort((a, b) => kmFromBase(w, id, c.x[a]!, c.y[a]!) - kmFromBase(w, id, c.x[b]!, c.y[b]!))[0]!;
      expect(m, `wing ${id} (${cls(w, id)})`).toBeDefined();
      expect(m!.kind).toBe(cls(w, id) === 'fighter' ? 'patrol' : 'strike');
      expect([m!.x, m!.y]).toEqual([c.x[nearest], c.y[nearest]]);
      checked++;
    }
    expect(checked, 'German fighters and strikers with Poland in range').toBeGreaterThan(2);
    // At peace, none flies.
    const v: World = new Sim({ scenario: '1938', seed: 1, assets: assets1938(SIZE_1938.w) }).world;
    airAi(v);
    expect([...v.wingMission.keys()].filter((id) => v.formations.cols.nation[id] === GER)).toEqual([]);
  });
});
