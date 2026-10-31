import { describe, expect, it } from 'vitest';
import nationsJson from '../../data/scenarios/1938/nations.json' with { type: 'json' };
import { FlagStore } from '../../src/app/flagStore';
import { atlasHeightFor, FLAG_ATLAS_COLS, FLAG_ATLAS_MAX_H, FLAG_ATLAS_MIN_H, FLAG_ATLAS_SLOTS, FLAG_ATLAS_W, FLAG_PAD, FLAG_SLOT_H, FlagAtlas, flagTexel, NO_FLAG_SLOT } from '../../src/render/units/flagAtlas';
import { FLAG_H, FLAG_W } from '../../src/shared/flagPixels';
import { encodeRuns } from '../../src/shared/mapImport';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { forceRevolt } from '../../src/sim/systems/revolts';
import type { World } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';

// PLAN 7.174b (ADR-777): every living nation's flag in one texture, for the countryball look.

const tagOf = (id: number): string | undefined => nationsJson.nations[id - 1]?.tag;

function storeOf(world: World): FlagStore {
  return new FlagStore(
    (id) => world.nations.cols.color[id],
    (id) => world.nations.cols.origin[id] !== 0,
    tagOf,
  );
}

function living(world: World): number[] {
  const ids: number[] = [];
  for (let id = 1; id < world.nations.highWater; id++) if (world.nations.cols.living[id] === 1) ids.push(id);
  return ids;
}

/** The atlas texel as 0xRRGGBB, and its alpha. */
function texel(atlas: FlagAtlas, x: number, y: number): [number, number] {
  const o = (y * FLAG_ATLAS_W + x) * 4;
  const p = atlas.pixels;
  return [(p[o]! << 16) | (p[o + 1]! << 8) | p[o + 2]!, p[o + 3]!];
}

/** Every living nation has a slot of its own, and its flag is there: the middle, the corners and the pad. */
function expectFlags(atlas: FlagAtlas, ids: readonly number[], store: FlagStore): void {
  const slots = new Set<number>();
  for (const id of ids) {
    const slot = atlas.slotOf(id);
    expect(slot, `nation ${id}`).toBeGreaterThanOrEqual(0);
    slots.add(slot);
    const px = store.pixelsOf(id);
    for (const [fx, fy] of [
      [FLAG_W >> 1, FLAG_H >> 1],
      [0, 0],
      [FLAG_W - 1, FLAG_H - 1],
    ] as const) {
      const [x, y] = flagTexel(slot, fx, fy);
      expect(texel(atlas, x, y), `nation ${id} at (${fx}, ${fy})`).toEqual([px[fy * FLAG_W + fx]!, 255]);
    }
    // The pad copies the edge: a linear sample at the edge keeps the flag's colour.
    const [x0, y0] = flagTexel(slot, 0, 0);
    expect(texel(atlas, x0 - FLAG_PAD, y0 - FLAG_PAD)[0], `nation ${id}'s pad`).toBe(px[0]!);
  }
  expect(slots.size).toBe(ids.length);
  expect(atlas.size).toBe(ids.length);
}

describe('the flag atlas (PLAN 7.174b)', () => {
  it('has the slots it says, and grows by powers of two', () => {
    expect(FLAG_ATLAS_COLS).toBe(53);
    expect(FLAG_ATLAS_SLOTS).toBe(53 * Math.floor(FLAG_ATLAS_MAX_H / FLAG_SLOT_H));
    expect(atlasHeightFor(1)).toBe(FLAG_ATLAS_MIN_H);
    expect(atlasHeightFor(FLAG_ATLAS_COLS * 4)).toBe(FLAG_ATLAS_MIN_H); // 4 rows of 26 px
    expect(atlasHeightFor(FLAG_ATLAS_COLS * 5)).toBe(256);
    expect(atlasHeightFor(FLAG_ATLAS_SLOTS)).toBe(FLAG_ATLAS_MAX_H);
  });

  it('the 1938 start, then a revolt forced in every province: each living nation has its flag, the dead none', () => {
    const world = new Sim({ scenario: '1938', seed: 5, assets: assets1938(SIZE_1938.w) }).world;
    const atlas = new FlagAtlas();
    let store = storeOf(world);
    const start = living(world);
    atlas.sync(start, (id) => store.pixelsOf(id));
    expectFlags(atlas, start, store);
    expect(atlas.dirtyRows()).not.toBeNull();

    for (let p = 1; p < world.provinces.count; p++) forceRevolt(world, p);
    store = storeOf(world); // the table has grown
    const after = living(world);
    const dead = start.filter((id) => !after.includes(id));
    atlas.sync(after, (id) => store.pixelsOf(id));
    console.log(`flag atlas: ${start.length} living at the start, ${after.length} after the revolts (${dead.length} died), ${atlas.height} px high`);
    expect(after.length).toBeGreaterThan(300);
    expectFlags(atlas, after, store);
    for (const id of dead) expect(atlas.slotOf(id), `dead nation ${id}`).toBe(NO_FLAG_SLOT);
    expect(atlas.height).toBe(atlasHeightFor(after.length));
  }, 300_000);

  it('a painted flag is in the atlas at the next sync; an unchanged flag is not written again', () => {
    const colours = new Map([
      [1, 0xff0000],
      [2, 0x0000ff],
    ]);
    const store = new FlagStore(
      (id) => colours.get(id),
      () => true,
      () => undefined,
    );
    const atlas = new FlagAtlas();
    const pixelsOf = (id: number): Uint32Array => store.pixelsOf(id);
    atlas.sync([1, 2], pixelsOf);
    atlas.markUploaded();
    atlas.sync([1, 2], pixelsOf);
    expect(atlas.dirtyRows(), 'nothing changed').toBeNull();

    const painted = new Uint32Array(FLAG_W * FLAG_H).fill(0x00ff00);
    store.setCustom([[2, encodeRuns(painted)]]);
    atlas.sync([1, 2], pixelsOf);
    const [x, y] = flagTexel(atlas.slotOf(2), FLAG_W >> 1, FLAG_H >> 1);
    expect(texel(atlas, x, y)).toEqual([0x00ff00, 255]);
    expect(atlas.dirtyRows()).not.toBeNull();
  });

  it('frees the slot of a nation gone and gives it to the next; past the last slot a nation has none', () => {
    const flag = new Uint32Array(FLAG_W * FLAG_H).fill(0x123456);
    const atlas = new FlagAtlas();
    atlas.sync([10, 11, 12], () => flag);
    const slot11 = atlas.slotOf(11);
    atlas.sync([10, 12], () => flag);
    expect(atlas.slotOf(11)).toBe(NO_FLAG_SLOT);
    atlas.sync([10, 12, 13], () => flag);
    expect(atlas.slotOf(13)).toBe(slot11);

    const many = Array.from({ length: FLAG_ATLAS_SLOTS + 5 }, (_, i) => 100 + i);
    const full = new FlagAtlas();
    full.sync(many, () => flag);
    expect(full.size).toBe(FLAG_ATLAS_SLOTS);
    expect(full.height).toBe(FLAG_ATLAS_MAX_H);
    expect(many.filter((id) => full.slotOf(id) === NO_FLAG_SLOT).length).toBe(5);
  });
});
