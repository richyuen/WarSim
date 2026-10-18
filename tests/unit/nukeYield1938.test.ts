import { describe, expect, it } from 'vitest';
import { EventKind } from '../../src/shared/events';
import { nukeStrike } from '../../src/shared/history';
import { THERMO_YIELD, yieldOf } from '../../src/shared/nuclear';
import { cellOf } from '../../src/sim/data/terrain';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { BLAST_PEOPLE, blastRadius, peopleShare } from '../../src/sim/systems/nuclear';
import { assets1938 } from '../helpers/earth';

// PLAN 7.20 (critic R8-B3, `critic/c8_b_4711.json`): a hydrogen bomb on the same point as an atomic
// one killed 3 to 11 % more (Paris 554,827 against 588,117) and left the same ruin: its yield was 2.
// Now THERMO_YIELD fission ones: its blast BLAST_KM × the yield's cube root, the people killed of the
// blast's share BLAST_PEOPLE × the yield's ⅔ power (the area where people die), its plume as many
// times longer and wider. The critic's case: seed 4711, God Mode's bomb at four cities on its first
// day, each kind on a world of its own.

const { w: W, h: H } = SIZE_1938;
const CITIES: [string, number, number][] = [['Paris', 2.35, 48.86], ['London', -0.13, 51.51], ['Berlin', 13.4, 52.52], ['Moscow', 37.62, 55.75]];

interface Strike { dead: number; fallout: number; ruined: number; kind: number }

/** God Mode's bomb at (lon, lat) on a fresh world of seed 4711: the dead told, the cells under fallout, the cells of industry put out of work. */
function strike(lon: number, lat: number, thermonuclear: boolean): { s: Sim; r: Strike } {
  const s = new Sim({ scenario: '1938', seed: 4711, assets: assets1938(W) });
  const [x, y] = cellOf(lon, lat, W, H);
  s.command({ kind: 'godNuke', x, y, thermonuclear });
  const r: Strike = { dead: -1, fallout: 0, ruined: 0, kind: 0 };
  s.step(1, (w) => {
    for (let i = 0; i < w.out.events.length; i += 6) {
      if (w.out.events[i + 1] !== EventKind.NukeCasualties) continue;
      ({ dead: r.dead, yieldN: r.kind } = nukeStrike(w.out.events[i + 3]!));
    }
    w.out.events.length = 0;
    w.out.fires.length = 0;
  });
  r.fallout = s.world.fallout.size;
  for (const v of s.world.bombDamage.values()) if (v > 0.05) r.ruined++;
  return { s, r };
}

describe('a hydrogen bomb is a hydrogen bomb (PLAN 7.20)', () => {
  it('its yield: THERMO_YIELD fission ones; a blast that many times the cube root wider; the people share by the ⅔ power', () => {
    expect(THERMO_YIELD).toBeGreaterThanOrEqual(20);
    expect([yieldOf(1), yieldOf(2)]).toEqual([1, THERMO_YIELD]);
    expect(blastRadius(2) / blastRadius(1)).toBeCloseTo(Math.cbrt(THERMO_YIELD), 9);
    expect(peopleShare(1)).toBe(BLAST_PEOPLE);
    expect(peopleShare(2)).toBeCloseTo(Math.min(1, BLAST_PEOPLE * Math.cbrt(THERMO_YIELD) ** 2), 9);
  });

  it.each(CITIES)('at %s: the hydrogen bomb kills ten times and more, lays ten times the fallout, ruins ten times the cells', (name, lon, lat) => {
    const a = strike(lon, lat, false).r;
    const h = strike(lon, lat, true).r;
    process.stderr.write(`${name}: atomic ${JSON.stringify(a)}, hydrogen ${JSON.stringify(h)}; toll x${(h.dead / a.dead).toFixed(1)}\n`);
    expect([a.kind, h.kind]).toEqual([1, 2]);
    expect(a.dead).toBeGreaterThan(10_000);
    expect(h.dead).toBeGreaterThan(10 * a.dead);
    expect(h.fallout).toBeGreaterThan(8 * a.fallout);
    expect(h.ruined).toBeGreaterThan(8 * a.ruined);
  }, 240_000);

  it('the bursts the sim remembers keep their class through a save and a load (the ruin is drawn by it)', () => {
    const { s } = strike(13.4, 52.52, true);
    expect(s.world.nukeBursts.map((b) => b.yieldN)).toEqual([2]);
    const u = new Sim({ scenario: '1938', seed: 4711, assets: assets1938(W) });
    u.load(s.save());
    expect(u.world.nukeBursts).toEqual(s.world.nukeBursts);
    expect(u.hash()).toBe(s.hash());
  }, 240_000);
});
