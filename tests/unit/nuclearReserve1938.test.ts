import { describe, expect, it } from 'vitest';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { byIndustry } from '../../src/sim/ai/air';
import { kmFromBase, wingRange } from '../../src/sim/systems/air';
import { nuclearReserve } from '../../src/sim/systems/nuclear';
import { airOf } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';
import { nationId } from '../helpers/sim1938';

// PLAN 7.37a (ADR-561): a nation holding a warhead it may use and no missiles keeps one strategic
// bomber group home for it. The critic's France (seed 7127, 10 warheads, Germany's war on it) flew
// its only strategic bomber group at Italy's industry, where its side held the air, from day 15
// to day 24, when it was lost; overrun from day 60, it could weigh a strike and not deliver one.
// Czechoslovakia (PLAN 7.37) died holding its 10 the same way.

const { w: W } = SIZE_1938;
const [FRA, GER] = ['FRA', 'GER'].map(nationId) as [number, number];

/** France at war with Germany on seed 7127, `warheads` given, its side holding the air over Germany's richest industry its strategic bomber group reaches; the wing and its mission after the next 00:00. */
function franceRaids(warheads: number): { wing: number; reserve: number; mission: { kind: string; x: number; y: number } | undefined } {
  const s = new Sim({ scenario: '1938', seed: 7127, assets: assets1938(W) });
  const w = s.world;
  if (warheads > 0) s.command({ kind: 'grantWarheads', nation: FRA, count: warheads });
  s.command({ kind: 'declareWar', attacker: GER, defender: FRA });
  s.step(23);
  const c = w.formations.cols;
  let wing = 0;
  w.formations.forEach((id) => {
    if (wing === 0 && c.nation[id] === FRA && w.isWing(id) && w.rules!.units[w.rules!.templates[c.template[id]!]!.elements[0]!.unit]!.cls === 'bomber_str') wing = id;
  });
  expect(wing, "France's strategic bomber group").toBeGreaterThan(0);
  // Germany's richest industry within its range: France holds the air of its zone.
  const cell = byIndustry(w).find((k) => w.cells.controller[k] === GER && kmFromBase(w, wing, (k % W) + 0.5, Math.floor(k / W) + 0.5) <= wingRange(w, wing));
  expect(cell, 'German industry in its range').toBeDefined();
  w.airPower.set(airOf(w).zoneOf[cell!]!, new Map([[FRA, 1e6]]));
  s.step(2);
  return { wing, reserve: nuclearReserve(w, FRA), mission: w.wingMission.get(wing) };
}

describe('a holder of warheads keeps a strategic bomber group for them (PLAN 7.37a)', () => {
  it('France with no warhead raids German industry where its side holds the air', () => {
    const r = franceRaids(0);
    expect(r.reserve).toBe(0);
    expect(r.mission?.kind).toBe('strike');
  });

  it('France holding 10 warheads keeps its only strategic bomber group home: no raid', () => {
    const r = franceRaids(10);
    expect(r.reserve).toBe(r.wing);
    expect(r.mission).toBeUndefined();
  });
});
