import { describe, expect, it } from 'vitest';
import presetsJson from '../../data/flags/presets.json' with { type: 'json' };
import flagsJson from '../../data/scenarios/1938/flags.json' with { type: 'json' };
import type { FlagPresets, FlagSpec } from '../../src/shared/flags';
import { fillFlag, FLAG_H, FLAG_PRESETS, FLAG_W, presetSpec, specToPixels } from '../../src/shared/flagPixels';
import { encodeRuns } from '../../src/shared/mapImport';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { assets1938 } from '../helpers/earth';
import { nationId } from '../helpers/sim1938';

// PLAN 1.37b (unit part): pixel flags, presets, bucket fill, and custom flags as saved state.

const presets = presetsJson.presets as unknown as FlagPresets;
const at = (px: Uint32Array, x: number, y: number): number => px[y * FLAG_W + x]!;

describe('pixel flags (PLAN 1.37b)', () => {
  it('rasterizes scenario flags to 36×24 (Germany: black, white, red stripes)', () => {
    const ger = specToPixels((flagsJson.flags as unknown as Record<string, FlagSpec>)['GER']!, presets);
    expect(ger.length).toBe(FLAG_W * FLAG_H);
    expect(at(ger, 18, 3)).toBe(0x000000);
    expect(at(ger, 18, 12)).toBe(0xffffff);
    expect(at(ger, 18, 20)).toBe(0xdd0000);
  });

  it('every preset rasterizes with its colours; a vertical tricolour has three columns', () => {
    for (const p of FLAG_PRESETS) expect(specToPixels(presetSpec(p, 0x112233, 0x445566, 0x778899), {}).some((v) => v === 0x112233), p).toBe(true);
    const v = specToPixels(presetSpec('tricolourV', 0x00aa00, 0xffffff, 0xcc0000), {});
    expect([at(v, 5, 12), at(v, 18, 12), at(v, 30, 12)]).toEqual([0x00aa00, 0xffffff, 0xcc0000]);
  });

  it('bucket fill stays inside one connected colour', () => {
    const v = specToPixels(presetSpec('tricolourV', 0x00aa00, 0xffffff, 0xcc0000), {});
    fillFlag(v, 18, 12, 0x0000ff);
    expect([at(v, 5, 12), at(v, 18, 0), at(v, 18, 23), at(v, 30, 12)]).toEqual([0x00aa00, 0x0000ff, 0x0000ff, 0xcc0000]);
  });

  it('a custom flag is state: set, saved, loaded, and reset by empty runs', () => {
    const POL = nationId('POL');
    const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(SIZE_1938.w) });
    const px = specToPixels(presetSpec('star', 0x101010, 0xf0f0f0, 0), {});
    s.command({ kind: 'setFlag', nation: POL, runs: encodeRuns(px) });
    s.applyNow();
    expect(s.world.flags.get(POL)).toEqual(px);
    const t = new Sim({ scenario: '1938', seed: 2, assets: assets1938(SIZE_1938.w) });
    t.load(s.save());
    expect(t.world.flags.get(POL)).toEqual(px);
    expect(t.hash()).toBe(s.hash());
    t.command({ kind: 'setFlag', nation: POL, runs: [] });
    t.applyNow();
    expect(t.world.flags.has(POL)).toBe(false);
    s.command({ kind: 'setFlag', nation: POL, runs: [0xff0000, 5] }); // wrong length: ignored
    s.applyNow();
    expect(s.world.flags.get(POL)).toEqual(px);
  });
});
