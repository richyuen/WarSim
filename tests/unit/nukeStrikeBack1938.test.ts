import { describe, expect, it } from 'vitest';
import { EventKind } from '../../src/shared/events';
import { cellOf } from '../../src/sim/data/terrain';
import { SIZE_1938, TEMPLATES_LAND } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { FRONT_KM } from '../../src/sim/systems/nuclear';
import { seaKm } from '../../src/sim/systems/navalCombat';
import { declareWar } from '../../src/sim/systems/war';
import type { War } from '../../src/sim/wars';
import type { World } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';
import { nationId } from '../helpers/sim1938';

// PLAN 6.12b (critic R6-B2): a strike back aims at the striker. Struck at London by the Soviet
// Union, the United Kingdom's one bomb went to Chungking: the grievance gave a bonus to every place
// of the striker's side, other wars' places were weighed beside them, and no Soviet place was
// within FRONT_KM of the British. Now, while a nation holds a grievance against an enemy, it weighs
// that nation's land alone, from any distance, and strikes no one else.
// France, at war with Italy (losing to the death, twelve Italian divisions massed at Turin) and with
// the United States: not struck, it strikes the Italians; struck at Paris by the United States, its
// next strike falls on American land, 6,000 km away, and none on Italy's before it.

const { w: W, h: H } = SIZE_1938;
const [FRA, ITA, USA] = ['FRA', 'ITA', 'USA'].map(nationId) as [number, number, number];
const turin = cellOf(7.68, 45.07, W, H);
const paris = cellOf(2.35, 48.86, W, H);
const inf = TEMPLATES_LAND.findIndex((t) => t.id === 'infantry_div');

/** The `NukeDecided` events over `hours`, [nation, utility, x, y]; France held losing to the death against Italy. */
function run(s: Sim, italy: War, hours: number): number[][] {
  const side = italy.sides[0].includes(FRA) ? 0 : 1;
  const out: number[][] = [];
  for (let h = 0; h < hours; h++) {
    italy.fightToDeath[side] = true;
    italy.score = side === 0 ? -100 : 100;
    s.step(1, (w: World) => {
      const ev = w.out.events;
      for (let i = 0; i < ev.length; i += 6) if (ev[i + 1] === EventKind.NukeDecided) out.push([ev[i + 2]!, ev[i + 3]!, ev[i + 4]!, ev[i + 5]!]);
      ev.length = 0;
      w.out.fires.length = 0;
    });
  }
  return out;
}

function twoWars(): { s: Sim; italy: War; america: War } {
  const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
  const w = s.world;
  w.settings.nukesEnabled = true;
  w.nations.cols.aiOff[USA] = 1;
  w.nations.cols.aiOff[ITA] = 1;
  for (const n of [FRA, USA]) {
    s.command({ kind: 'grantWarheads', nation: n, count: 5 });
    s.command({ kind: 'grantTech', nation: n, tech: 'ballistic_missiles' });
  }
  s.step(1);
  const italy = declareWar(w, ITA, FRA, true)!;
  const america = declareWar(w, USA, FRA, true)!;
  expect(italy).toBeTruthy();
  expect(america).toBeTruthy();
  for (let k = 0; k < 12; k++) s.command({ kind: 'spawnFormation', nation: ITA, x: turin[0] + (k % 4) * 0.3, y: turin[1] + Math.floor(k / 4) * 0.3, strength: 0, template: inf });
  s.step(1);
  return { s, italy, america };
}

const ownerAt = (w: World, x: number, y: number): number => w.cells.owner[Math.floor(y) * W + Math.floor(x)]!;

describe('a strike back aims at the striker (PLAN 6.12b)', () => {
  it('not struck, France strikes the Italians at Turin', () => {
    const { s } = twoWars();
    const decided = run(s, s.world.wars.list.find((x) => x.sides.flat().includes(ITA))!, 24 * 5);
    process.stderr.write(`France, not struck: ${JSON.stringify(decided)}\n`);
    expect(decided.length).toBeGreaterThan(0);
    expect(decided[0]![0]).toBe(FRA);
    expect(ownerAt(s.world, decided[0]![2]!, decided[0]![3]!)).toBe(ITA);
  });

  it('struck at Paris by the United States, France strikes American land next, from 6,000 km, and not Italy before it', () => {
    const { s, italy } = twoWars();
    const w = s.world;
    s.command({ kind: 'launchNuke', nation: USA, x: paris[0], y: paris[1], missile: true });
    let at = -1;
    const before: number[][] = [];
    for (let h = 0; h < 48 && at < 0; h++) {
      before.push(...run(s, italy, 1));
      if (w.nukeGrievance.get(FRA)?.by === USA) at = h;
    }
    expect(at).toBeGreaterThanOrEqual(0);
    const after = run(s, italy, 24 * 10);
    process.stderr.write(`France, struck: before the grievance ${JSON.stringify(before)}, after ${JSON.stringify(after)}\n`);
    const mine = after.filter((d) => d[0] === FRA);
    expect(mine.length).toBeGreaterThan(0);
    const [, u, x, y] = mine[0]!;
    expect(u).toBeGreaterThan(0);
    expect(ownerAt(w, x!, y!)).toBe(USA);
    // Far from every front: FRONT_KM did not bar it.
    expect(seaKm(w, x!, y!, w.nations.cols.capitalX[FRA]!, w.nations.cols.capitalY[FRA]!)).toBeGreaterThan(FRONT_KM * 5);
    // The grievance spent; then Italy may be struck again.
    expect(w.nukeGrievance.has(FRA)).toBe(false);
  });
});
