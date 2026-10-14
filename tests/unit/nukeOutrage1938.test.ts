import { describe, expect, it } from 'vitest';
import { EventKind } from '../../src/shared/events';
import { cellOf } from '../../src/sim/data/terrain';
import { NATIONS_1938, SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { aftermath, ALLY_SHARE, nukeInputs, OUTRAGE_COST, OUTRAGE_DECAY, OUTRAGE_STRIKE, OUTRAGE_WEIGHT, RELATION_FAR_KM, RELATION_FAR_SHARE, RELATION_NEAR_KM, relationHit } from '../../src/sim/systems/nuclear';
import { seaKm } from '../../src/sim/systems/navalCombat';
import { declareWar } from '../../src/sim/systems/war';
import { DEFENDERS } from '../../src/sim/wars';
import type { World } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';
import { nationId } from '../helpers/sim1938';

// PLAN 6.5 AT (6.5b): outrage. A strike on another nation's land raises the world's outrage at the
// striker, which persists for years; every nation's relations with it are hit by distance and
// alliance; the strategic AI turns on it (its war utility, a coalition); its own utility of a
// further strike falls.

const { w: W, h: H } = SIZE_1938;
const [ENG, FRA, GER, POL, USA, JAP, NED] = ['ENG', 'FRA', 'GER', 'POL', 'USA', 'JAP', 'NED'].map(nationId) as [number, number, number, number, number, number, number];
const berlin = cellOf(13.4, 52.52, W, H);
const sim = (): Sim => new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
const tag = (n: number): string => NATIONS_1938[n - 1]?.tag ?? String(n);

describe('outrage at a nuclear strike (PLAN 6.5b)', () => {
  it('rises by OUTRAGE_STRIKE a strike on another\'s land, to 100, none on its own; decays by OUTRAGE_DECAY a day', () => {
    const s = sim();
    const w = s.world;
    aftermath(w, GER, 1, ...berlin, 0);
    expect(w.nukeOutrage.size).toBe(0);
    aftermath(w, FRA, 1, ...berlin, 0);
    expect(w.nukeOutrage.get(FRA)).toBe(OUTRAGE_STRIKE);
    for (let k = 0; k < 3; k++) aftermath(w, FRA, 1, ...berlin, 0);
    expect(w.nukeOutrage.get(FRA)).toBe(100);
    s.step(1);
    while (w.tick % 24 !== 1) s.step(1);
    expect(w.nukeOutrage.get(FRA)).toBeCloseTo(100 - OUTRAGE_DECAY, 9);
    // One strike's outrage lasts years.
    expect(OUTRAGE_STRIKE / OUTRAGE_DECAY / 365).toBeGreaterThan(4);
  });

  it('relations hit by distance and alliance: Poland, near, the most; the United States less; Japan, far, less; England, France\'s ally, a quarter', () => {
    const w = sim().world;
    aftermath(w, FRA, 1, ...berlin, 0);
    const nc = w.nations.cols;
    const want = (n: number, allied: boolean): number => {
      const km = seaKm(w, nc.capitalX[n]!, nc.capitalY[n]!, nc.capitalX[FRA]!, nc.capitalY[FRA]!);
      const far = km <= RELATION_NEAR_KM ? 1 : km >= RELATION_FAR_KM ? RELATION_FAR_SHARE : 1 - ((1 - RELATION_FAR_SHARE) * (km - RELATION_NEAR_KM)) / (RELATION_FAR_KM - RELATION_NEAR_KM);
      return (OUTRAGE_STRIKE / 100) * far * (allied ? ALLY_SHARE : 1);
    };
    expect(w.alliances.allied(ENG, FRA)).toBe(true);
    const hit = [POL, USA, JAP, ENG].map((n) => relationHit(w, n, FRA));
    process.stderr.write(`relations hit: ${[POL, USA, JAP, ENG].map((n, k) => `${tag(n)} ${hit[k]!.toFixed(3)}`).join(', ')}\n`);
    expect(hit[0]).toBeCloseTo(want(POL, false), 12);
    expect(hit[1]).toBeCloseTo(want(USA, false), 12);
    expect(hit[2]).toBeCloseTo(want(JAP, false), 12);
    expect(hit[3]).toBeCloseTo(want(ENG, true), 12);
    expect(hit[0]).toBe(OUTRAGE_STRIKE / 100);
    expect(hit[0]!).toBeGreaterThan(hit[1]!);
    expect(hit[1]!).toBeGreaterThan(hit[2]!);
    expect(relationHit(w, FRA, FRA)).toBe(0);
    expect(relationHit(w, POL, GER)).toBe(0);
  });

  it('the utility\'s outrage term: OUTRAGE_COST for any strike, more for a striker the world is outraged at', () => {
    const s = sim();
    const w = s.world;
    s.step(1);
    const war = declareWar(w, GER, FRA, true)!;
    expect(nukeInputs(w, FRA, war, DEFENDERS, ...berlin).outrage).toBe(OUTRAGE_COST);
    aftermath(w, FRA, 1, ...berlin, 0);
    expect(nukeInputs(w, FRA, war, DEFENDERS, ...berlin).outrage).toBeCloseTo(OUTRAGE_COST + OUTRAGE_WEIGHT * (OUTRAGE_STRIKE / 100), 12);
  });

  it('the strategic AI turns on a pariah: the Netherlands, the world outraged at it, has more wars declared on it, and a league forms about it; a save carries the outrage', () => {
    // The Netherlands: France with its allies is too strong a target for outrage to tip a war.
    const run = (outrage: boolean): { wars: number; league: number[]; w: World; s: Sim } => {
      const s = sim();
      const w = s.world;
      let wars = 0;
      for (let h = 0; h < 24 * 62; h++) {
        if (outrage) w.nukeOutrage.set(NED, 100);
        s.step(1, (x: World) => {
          const ev = x.out.events;
          for (let i = 0; i < ev.length; i += 6) if (ev[i + 1] === EventKind.WarDeclared && ev[i + 3] === NED) wars++;
          ev.length = 0;
          x.out.fires.length = 0;
        });
      }
      const league = w.alliances.list.find((a) => a.nameKey === 'alliance.pariah');
      return { wars, league: league?.members ?? [], w, s };
    };
    const calm = run(false);
    const hot = run(true);
    process.stderr.write(`wars on the Netherlands: ${calm.wars} without outrage, ${hot.wars} with; the league about it: ${hot.league.map(tag).join(', ')}
`);
    expect(hot.wars).toBeGreaterThan(calm.wars);
    expect(calm.league).toEqual([]);
    expect(hot.league.length).toBeGreaterThanOrEqual(2);
    expect(hot.league).not.toContain(NED);
    const c = sim();
    c.load(hot.s.save());
    expect(c.world.nukeOutrage.get(NED)).toBe(hot.w.nukeOutrage.get(NED));
  }, 300_000);
});
