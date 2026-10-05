import { describe, expect, it } from 'vitest';
import nationsJson from '../../data/scenarios/1938/nations.json' with { type: 'json' };
import { FlagStore } from '../../src/app/flagStore';
import { FLAG_H, FLAG_W, foundedFlag, specToPixels } from '../../src/shared/flagPixels';
import { NATION_STRIDE, NationField, type FromWorker, type Snapshot } from '../../src/shared/protocol';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { forceRevolt, spawnRebels } from '../../src/sim/systems/revolts';
import { navOf } from '../../src/sim/world';
import { SimServer } from '../../src/worker/server';
import { assets1938 } from '../helpers/earth';

// PLAN 2.15c (the critic's R2-B6): a flag for every founded nation. A nation no scenario gives a
// flag flew a plain one in its colour, and a grey one for the rest of the game where the flag
// was asked for before the first snapshot had told the colour. It gets a flag made from its id
// and its colour, of two colours or more.

const PIXELS = FLAG_W * FLAG_H;
/** The tags of the 1938 table, as the map view gives them to the store in the 1938 world. */
const tagOf = (id: number): string | undefined => nationsJson.nations[id - 1]?.tag;
const pixelsOf = (id: number, colour: number): Uint32Array => specToPixels(foundedFlag(id, colour), {});

/** The colours of a flag that hold a twentieth of it or more (not the edge of a shape). */
function colours(px: Uint32Array): number[] {
  const n = new Map<number, number>();
  for (const v of px) n.set(v, (n.get(v) ?? 0) + 1);
  return [...n].filter(([, k]) => k >= PIXELS / 20).map(([c]) => c);
}

describe('flags of founded nations (PLAN 2.15c)', () => {
  it('a revolt forced in every province of the 1938 start: every nation founded has a flag of two colours or more', () => {
    const world = new Sim({ scenario: '1938', seed: 5, assets: assets1938(SIZE_1938.w) }).world;
    const first = world.nations.highWater;
    for (let p = 1; p < world.provinces.count; p++) forceRevolt(world, p);
    const nc = world.nations.cols; // after the revolts: the table has grown (PLAN 2.12a)
    const store = new FlagStore(
      (id) => nc.color[id],
      (id) => nc.origin[id] !== 0,
      tagOf,
    );
    const seen = new Set<string>();
    let founded = 0;
    for (let id = first; id < world.nations.highWater; id++) {
      founded++;
      const px = store.pixelsOf(id);
      const cs = colours(px);
      expect(cs.length, `nation ${id}, colour ${nc.color[id]!.toString(16)}`).toBeGreaterThanOrEqual(2);
      // The nation's own colour is on its flag: the flag belongs to the land under it.
      expect(cs, `nation ${id}`).toContain(nc.color[id]!);
      expect(px).toEqual(pixelsOf(id, nc.color[id]!));
      seen.add(px.join(','));
    }
    console.log(`forced revolts: ${founded} nations founded, ${seen.size} different flags`);
    expect(founded).toBeGreaterThan(300);
    expect(seen.size).toBe(founded);
    // The limit of the same run in nationNames and rebelCapitals: it takes 34 s alone and
    // 93 s beside the suite's other long tests, against the default 90.
  }, 300_000);

  it('the same id and colour give the same flag; any colour gives two colours or more', () => {
    let two = 0;
    for (let id = 1; id <= 300; id++) {
      for (const colour of [0x000000, 0xffffff, 0x888888, 0x464646, 0xc5c5c5, 0xc54646, 0x46c546, 0x4646c5, 0xe0b020, (id * 0x9e3779) & 0xffffff]) {
        const px = pixelsOf(id, colour);
        expect(px, `${id} ${colour.toString(16)}`).toEqual(pixelsOf(id, colour));
        const cs = colours(px);
        expect(cs.length, `nation ${id}, colour ${colour.toString(16)}`).toBeGreaterThanOrEqual(2);
        if (cs.length === 2) two++;
      }
    }
    console.log(`3000 flags: ${two} of two colours, ${3000 - two} of three`);
  });

  it('a flag asked for before the colour is known is not kept once it is', () => {
    const colour = new Map<number, number>();
    const store = new FlagStore((id) => colour.get(id), () => false, tagOf);
    const early = store.pixelsOf(300);
    expect(colours(early).length).toBeGreaterThanOrEqual(2);
    colour.set(300, 0xb04a6e);
    expect(store.pixelsOf(300)).toEqual(pixelsOf(300, 0xb04a6e));
    expect(store.pixelsOf(300)).not.toEqual(early);
    // And it follows the colour after that (a world loaded into a running game).
    colour.set(300, 0x4a6eb0);
    expect(store.pixelsOf(300)).toEqual(pixelsOf(300, 0x4a6eb0));
  });

  it('a founded nation on the id of a scenario nation does not fly that nation flag', () => {
    const FRA = nationsJson.nations.findIndex((n) => n.tag === 'FRA') + 1;
    expect(FRA).toBeGreaterThan(0);
    const founded = new Set<number>();
    const store = new FlagStore(
      () => 0x7a5ac0,
      (id) => founded.has(id),
      tagOf,
    );
    const france = store.pixelsOf(FRA);
    expect(france).not.toEqual(pixelsOf(FRA, 0x7a5ac0));
    founded.add(FRA);
    expect(store.pixelsOf(FRA)).toEqual(pixelsOf(FRA, 0x7a5ac0));
    founded.delete(FRA);
    expect(store.pixelsOf(FRA)).toEqual(france);
  });

  it('a nation founded on a freed id does not inherit a custom flag', () => {
    const world = new Sim({ scenario: '1938', seed: 5, assets: assets1938(SIZE_1938.w) }).world;
    const spare = world.nations.create();
    world.flags.set(spare, new Uint32Array(PIXELS).fill(0x123456));
    world.nations.remove(spare);
    const version = world.flagsVersion;
    // The province of a city that is no capital, and its holder.
    void navOf(world);
    const cc = world.cities.cols;
    let cell = -1;
    world.cities.forEach((ci) => {
      if (cell < 0 && cc.capitalOf[ci] === 0 && world.cells.owner[cc.cell[ci]!] !== 0) cell = cc.cell[ci]!;
    });
    const id = spawnRebels(world, [world.cells.province[cell]!], world.cells.owner[cell]!);
    expect(id).toBe(spare);
    expect(world.flags.has(id)).toBe(false);
    expect(world.flagsVersion).toBeGreaterThan(version);
  });

  it('the snapshot says which nations were founded', () => {
    const sim = new Sim({ scenario: '1938', seed: 5, assets: assets1938(SIZE_1938.w) });
    const world = sim.world;
    expect(NationField.founded).toBeLessThan(NATION_STRIDE);
    const first = world.nations.highWater;
    forceRevolt(world, 1);
    for (let p = 2; world.nations.highWater === first; p++) forceRevolt(world, p);
    let last: Snapshot | null = null;
    const server = new SimServer((m: FromWorker) => {
      if (m.type === 'snapshot') last = m.snap;
    });
    server.sim = sim;
    server.handle({ type: 'subscribe', sub: { bbox: [0, 0, Infinity, Infinity], z: 0, tier: 0, wantsElements: false } }, 0);
    const s = last as Snapshot | null;
    expect(s).not.toBeNull();
    const founded: number[] = [];
    for (let i = 0; i < s!.nations.count; i++) if (s!.nations.data[i * NATION_STRIDE + NationField.founded] === 1) founded.push(s!.nations.data[i * NATION_STRIDE + NationField.id]!);
    expect(founded).toEqual([first]);
  });
});
