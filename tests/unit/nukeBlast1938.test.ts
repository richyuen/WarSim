import { describe, expect, it } from 'vitest';
import { EventKind } from '../../src/shared/events';
import { cellOf } from '../../src/sim/data/terrain';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { elementIndex } from '../../src/sim/systems/elements';
import { seaKm } from '../../src/sim/systems/navalCombat';
import { packNukeStrike, nukeStrike } from '../../src/shared/history';
import { aftermath, BLAST_KILL, BLAST_KM, BLAST_PEOPLE, blast, blastRadius, blastShare } from '../../src/sim/systems/nuclear';
import { assets1938 } from '../helpers/earth';
import { nationId } from '../helpers/sim1938';

// PLAN 6.3 AT (6.3a): the casualty falloff. A warhead's blast destroys BLAST_KILL × (1 − d / radius)
// of what is at d km from it within its radius (BLAST_KM × the yield's cube root): of each element
// of the formations there, BLAST_PEOPLE of it of each cell's people, and of its industry (as bombs
// put it out of work).

const { w: W, h: H } = SIZE_1938;
const [ENG, GER] = ['ENG', 'GER'].map(nationId) as [number, number];
const berlin = cellOf(13.4, 52.52, W, H);

describe('a warhead\'s blast (PLAN 6.3a)', () => {
  it('the share by distance: BLAST_KILL at the centre, a straight fall to none at the radius; a larger yield a larger radius', () => {
    const r = blastRadius(1);
    expect(r).toBe(BLAST_KM);
    expect(blastShare(0, r)).toBe(BLAST_KILL);
    expect(blastShare(r / 2, r)).toBeCloseTo(BLAST_KILL / 2, 12);
    expect(blastShare(r, r)).toBe(0);
    expect(blastShare(2 * r, r)).toBe(0);
    expect(blastRadius(2) / r).toBeCloseTo(Math.cbrt(2), 9);
  });

  it('at Berlin: each formation loses its distance\'s share, each cell its people\'s; industry put out of work; the toll told', () => {
    const w = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) }).world;
    const c = w.formations.cols;
    const ec = w.elements.cols;
    // Three German land formations: at the burst, a cell east, far off.
    const german: number[] = [];
    w.formations.forEach((id) => {
      if (german.length < 3 && c.nation[id] === GER && !w.isFleet(id) && !w.offLand(id)) german.push(id);
    });
    const places: [number, number][] = [berlin, [berlin[0] + 1, berlin[1]], [berlin[0] + 8, berlin[1]]];
    german.forEach((id, k) => ([c.x[id], c.y[id]] = places[k]!));
    const r = blastRadius(1);
    const share = places.map(([x, y]) => blastShare(seaKm(w, ...berlin, x, y), r));
    expect(share[0]).toBe(BLAST_KILL);
    expect(share[1]).toBeGreaterThan(0);
    expect(share[2]).toBe(0);
    const idx = elementIndex(w);
    const before = german.map((id) => (idx.get(id) ?? []).map((e) => ec.strength[e]!));
    const men = german.map((id) => c.strength[id]!);
    const centre = Math.floor(berlin[1]) * W + Math.floor(berlin[0]);
    const pop = w.cells.pop[centre]!;
    w.out.events.length = 0;
    const toll = blast(w, 1, ...berlin);
    // Each element of each: its strength less its share, to the unit (losses whole, wounds carried).
    german.forEach((id, k) => {
      const els = before[k]!;
      const now = (elementIndex(w).get(id) ?? []).map((e) => ec.strength[e]!);
      const want = els.map((s) => s - s * share[k]!);
      if (!w.formations.has(id)) return expect(share[k]).toBeGreaterThan(0);
      els.forEach((_, j) => expect(Math.abs((now[j] ?? 0) - want[j]!), `formation ${k}, element ${j}`).toBeLessThanOrEqual(1));
    });
    // Beyond the radius: untouched.
    expect(c.strength[german[2]!]).toBe(men[2]);
    // The cell of the burst: its people less the centre's share; its industry out of work.
    const cs = blastShare(seaKm(w, ...berlin, Math.floor(berlin[0]) + 0.5, Math.floor(berlin[1]) + 0.5), r);
    expect(w.cells.pop[centre]).toBe(pop - Math.round(pop * cs * BLAST_PEOPLE));
    if (w.cells.econ[centre]! > 0) expect(w.bombDamage.get(centre)).toBeCloseTo(Math.min(0.95, cs), 12);
    expect(toll.men).toBeGreaterThan(0);
    expect(toll.people).toBeGreaterThan(0);
    // The toll told, with the strike's consequences (PLAN 6.5a): England struck Germany, yield 1.
    aftermath(w, ENG, 1, ...berlin, toll.men + toll.people);
    const told: number[][] = [];
    for (let i = 0; i < w.out.events.length; i += 6) if (w.out.events[i + 1] === EventKind.NukeCasualties) told.push(Array.from(w.out.events.slice(i + 2, i + 6)));
    expect(told).toEqual([[ENG, packNukeStrike(GER, 1, toll.men + toll.people), ...berlin]]);
    expect(nukeStrike(told[0]![1]!)).toEqual({ nation: GER, yieldN: 1, dead: toll.men + toll.people });
    process.stderr.write(`Berlin: shares ${share.map((s) => s.toFixed(3)).join(', ')}; ${toll.men} men and ${toll.people} people\n`);
  });
});
