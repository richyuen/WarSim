import { describe, expect, it } from 'vitest';
import { AIR_CONTESTED } from '../../src/shared/mapModes';
import { unproject } from '../../src/sim/data/projection';
import { cellOf } from '../../src/sim/data/terrain';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { airHolders } from '../../src/sim/systems/airSuperiority';
import { airOf } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';
import { nationId } from '../helpers/sim1938';

// PLAN 7.36b (critic run 10, R10-B3): on day 10 of Germany's war on Poland (seed 8217) the air map
// hatched one German zone from London to Kiev, every hover "held by Germany". London, Paris and
// Berlin were one land zone of 2.6 M km², 4,000 km across, and Warsaw and Kiev another: the land's
// zones were 1.5 M km² (ADR-306). Since ADR-560 they are 300,000 km², and the map reads what each
// place's air holds: London's and Kiev's no one flew in, Paris's France's, Warsaw's Germany's.

const { w: W, h: H } = SIZE_1938;
const GER = nationId('GER');

describe("the air map on day 10 of Germany's war on Poland (PLAN 7.36b)", () => {
  const sim = new Sim({ scenario: '1938', seed: 8217, assets: assets1938(W) });
  const world = sim.world;
  sim.command({ kind: 'declareWar', attacker: GER, defender: nationId('POL') });
  sim.step(24 * 10);
  const air = airOf(world);
  const holders = airHolders(world, air.count);
  const zoneAt = (lon: number, lat: number): number => {
    const [x, y] = cellOf(lon, lat, W, H);
    return air.zoneOf[Math.floor(y) * W + Math.floor(x)]!;
  };
  const cities: [string, number, number][] = [['London', -0.13, 51.51], ['Paris', 2.35, 48.86], ['Warsaw', 21.01, 52.23], ['Kiev', 30.52, 50.45]];

  it('two or more of London, Paris, Warsaw and Kiev read another than Germany (was Germany at all four), and no two share a zone', () => {
    const zones = cities.map(([, lon, lat]) => zoneAt(lon, lat));
    const read = zones.map((z) => holders[z]!);
    process.stderr.write(`${cities.map(([n], i) => `${n} zone ${zones[i]} holder ${read[i] === AIR_CONTESTED ? 'contested' : read[i]}`).join('; ')} (Germany ${GER})\n`);
    expect(read.filter((h) => h !== GER).length).toBeGreaterThanOrEqual(2);
    expect(new Set(zones).size).toBe(4);
  });

  it('no zone held that day spans over 1,500 km between the farthest two of its edge cells (PLAN 7.36b2)', () => {
    // Before ADR-562 an island far from every seed went whole to the nearest seed's zone: the
    // Azores to one of Rio de Oro (Nationalist Spain's, about 2,800 km), Formosa to one of Luzon
    // (Japan's, about 1,560 km).
    const edges = new Map<number, number[]>();
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const c = y * W + x;
        const z = air.zoneOf[c]!;
        const h = holders[z]!;
        if (z === 0 || h === 0 || h === AIR_CONTESTED) continue;
        const edge = air.zoneOf[y * W + ((x + 1) % W)] !== z || air.zoneOf[y * W + ((x + W - 1) % W)] !== z || y === 0 || y === H - 1 || air.zoneOf[c - W] !== z || air.zoneOf[c + W] !== z;
        if (!edge) continue;
        let a = edges.get(z);
        if (!a) edges.set(z, (a = []));
        a.push(c);
      }
    }
    const r = Math.PI / 180;
    const span = (cs: number[]): number => {
      const p = cs.map((c) => unproject(((c % W) + 0.5) / W, (Math.floor(c / W) + 0.5) / H));
      let m = 0;
      for (let i = 0; i < p.length; i++) {
        for (let j = i + 1; j < p.length; j++) {
          const [lo1, la1] = p[i]!;
          const [lo2, la2] = p[j]!;
          const s = Math.sin(((la2 - la1) * r) / 2) ** 2 + Math.cos(la1 * r) * Math.cos(la2 * r) * Math.sin(((lo2 - lo1) * r) / 2) ** 2;
          m = Math.max(m, 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(s))));
        }
      }
      return m;
    };
    const spans = [...edges].map(([z, cs]) => [z, Math.round(span(cs))] as const);
    process.stderr.write(`held zones ${spans.length}: ${spans.map(([z, s]) => `${z} ${s} km`).join(', ')}\n`);
    expect(spans.length).toBeGreaterThan(5);
    expect(spans.filter(([, s]) => s > 1500)).toEqual([]);
  });
});
