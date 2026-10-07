import { describe, expect, it } from 'vitest';
import { EventKind } from '../../src/shared/events';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { declareWar } from '../../src/sim/systems/war';
import { navOf } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';
import { eventKinds, nationId, runEvents } from '../helpers/sim1938';

// PLAN 3.8f (the critic's R3-B4, "Belgium +29 × Free Gers"): a war of independence is fought by
// the two realms. The holder of a revolt declared on its rebels as on any nation, and its whole
// alliance came with it; so did the alliance of an overlord whose puppet rose (ADR-184).

const [FRA, ENG, ITA, GER, ALB, POL] = ['FRA', 'ENG', 'ITA', 'GER', 'ALB', 'POL'].map(nationId) as [number, number, number, number, number, number];
const world1938 = (): Sim => new Sim({ scenario: '1938', seed: 5, assets: assets1938(SIZE_1938.w) });
const realm = (s: Sim, n: number): number[] => [n, ...s.world.nations.ids().filter((m) => s.world.nations.cols.overlord[m] === n)];
const sorted = (a: readonly number[]): number[] => [...a].sort((x, y) => x - y);

/** A French province with a French core, held by France, away from its capital. */
function frenchProvince(s: Sim): number {
  const w = s.world;
  const g = navOf(w).graph;
  const capital = w.cells.province[Math.floor(w.nations.cols.capitalY[FRA]!) * SIZE_1938.w + Math.floor(w.nations.cols.capitalX[FRA]!)]!;
  for (let p = 1; p < w.provinces.count; p++) {
    const c = g.centre[p] ?? -1;
    if (c >= 0 && p !== capital && w.cells.owner[c] === FRA && w.cells.controller[c] === FRA && w.provinces.core[p] === FRA) return p;
  }
  throw new Error('no French province');
}

describe('a war of independence is the two realms’ (PLAN 3.8f)', () => {
  it('a revolt: the holder fights its rebels with its puppets, without its allies', () => {
    const s = world1938();
    expect(s.world.alliances.allied(FRA, ENG)).toBe(true);
    s.command({ kind: 'spawnRevolt', province: frenchProvince(s) });
    const ev = runEvents(s, 1);
    const [rebel, holder] = eventKinds(ev, EventKind.RevoltSpawned)[0]!;
    expect(holder).toBe(FRA);
    const war = s.world.wars.between(FRA, rebel!)!.war;
    expect(sorted(war.sides[0])).toEqual(sorted(realm(s, FRA)));
    expect(war.sides[1]).toEqual([rebel]);
    expect(s.world.wars.atWar(ENG, rebel!)).toBe(false);
  });

  it('a puppet that rises: its overlord fights it with its other puppets, without its allies', () => {
    const s = world1938();
    expect(s.world.alliances.allied(ITA, GER)).toBe(true);
    s.command({ kind: 'setPuppetLoyalty', subject: ALB, value: 5 });
    expect(eventKinds(runEvents(s, 1), EventKind.PuppetRevolt)).toEqual([[ALB, ITA]]);
    const war = s.world.wars.between(ALB, ITA)!.war;
    expect(war.sides[0]).toEqual([ALB]);
    expect(sorted(war.sides[1])).toEqual(sorted(realm(s, ITA)));
    expect(s.world.wars.atWar(GER, ALB)).toBe(false);
  });

  it('any other declaration calls the alliances as before', () => {
    const s = world1938();
    const war = declareWar(s.world, GER, POL)!;
    expect(war.sides[0]).toContain(ITA);
  });
});
