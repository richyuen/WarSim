import { describe, expect, it } from 'vitest';
import { EventKind } from '../../src/shared/events';
import { cellOf } from '../../src/sim/data/terrain';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { nuclearSystem, STRIKE_GAP_DAYS, strikePaused } from '../../src/sim/systems/nuclear';
import type { World } from '../../src/sim/world';
import type { War } from '../../src/sim/wars';
import { assets1938 } from '../helpers/earth';
import { nationId } from '../helpers/sim1938';

// PLAN 7.28 (ADR-491's promise, ADR-507's gap): a side that launched waits STRIKE_GAP_DAYS before a
// first use again, for the burst's shock, an answer or a peace; a launch stopped short (shot down, or
// its bomber lost on the way) gives none of them and starts no gap. The United Kingdom at war with
// Germany (seed 1), its launches at Berlin set up as `nukeDecisions` records them: a bomber's wing that
// is gone is stopped short, a missile always bursts.

const { w: W, h: H } = SIZE_1938;
const [ENG, GER] = ['ENG', 'GER'].map(nationId) as [number, number];
const berlin = cellOf(13.4, 52.52, W, H);
const count = (w: World, kind: number): number => {
  let k = 0;
  for (let i = 0; i < w.out.events.length; i += 6) if (w.out.events[i + 1] === kind) k++;
  return k;
};

/** A world at war, and Britain's launches of this hour as its decision records them: `short` of them stopped short, the rest by missile. */
function launched(short: number, missiles: number): { w: World; war: War } {
  const w = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) }).world;
  const war = w.wars.start([ENG], [GER], 0);
  war.lastStrike = [w.tick, -1];
  war.strikesLive = [short + missiles, 0];
  // A bomber's wing that is no longer there: lost on the way (`arrivals`).
  for (let k = 0; k < short; k++) w.nukeLaunches.push({ id: w.nextLaunchId++, nation: ENG, missile: 0, wing: 999_999, bx: 0, by: 0, tx: berlin[0], ty: berlin[1], launch: w.tick, arrive: w.tick, yieldN: 1 });
  for (let k = 0; k < missiles; k++) w.nukeLaunches.push({ id: w.nextLaunchId++, nation: ENG, missile: 1, wing: 0, bx: 0, by: 0, tx: berlin[0], ty: berlin[1], launch: w.tick, arrive: w.tick, yieldN: 1 });
  w.out.events.length = 0;
  nuclearSystem(w);
  expect(count(w, EventKind.NukeIntercepted)).toBe(short);
  expect(count(w, EventKind.NukeDetonated)).toBe(missiles);
  return { w, war };
}

describe('the gap after a launch (PLAN 7.25b, 7.28)', () => {
  it('a launch stopped short starts no gap', () => {
    const { w, war } = launched(1, 0);
    expect(war.strikesLive).toEqual([0, 0]);
    expect(strikePaused(w, war, 0)).toBe(false);
  }, 300_000);

  it('a launch that bursts holds the side STRIKE_GAP_DAYS; so does one of two of the same hour that bursts', () => {
    for (const [short, missiles] of [[0, 1], [1, 1]] as const) {
      const { w, war } = launched(short, missiles);
      expect(war.strikesLive![0], `${short} short, ${missiles} burst`).toBe(1);
      expect(strikePaused(w, war, 0)).toBe(true);
      w.tick = war.lastStrike![0] + STRIKE_GAP_DAYS * 24 - 1;
      expect(strikePaused(w, war, 0)).toBe(true);
      w.tick++;
      expect(strikePaused(w, war, 0)).toBe(false);
    }
  }, 300_000);

  it('a war of an older save, with no count of live launches, holds as before', () => {
    const w = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) }).world;
    const war = w.wars.start([ENG], [GER], 0);
    war.lastStrike = [w.tick, -1];
    expect(strikePaused(w, war, 0)).toBe(true);
    expect(strikePaused(w, war, 1)).toBe(false);
  }, 300_000);
});
