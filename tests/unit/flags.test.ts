import { describe, expect, it } from 'vitest';
import presetsJson from '../../data/flags/presets.json';
import flagsJson from '../../data/scenarios/1938/flags.json';
import { buildFlagAtlas, flagShapes, flagSvg, rasterizeFlag, type FlagPresets, type FlagSpec } from '../../src/shared/flags';
import { xxhash32View } from '../../src/sim/core/hash';
import { TAGS_1938 } from '../helpers/earth';

// PLAN 1.6: flags are data (FlagSpec layers + presets) rendered to SVG and to a deterministic
// RGBA atlas. AT: the atlas builds (here), the flag grid is reviewed (e2e screenshot).

const presets = presetsJson.presets as unknown as FlagPresets;
const flags = flagsJson.flags as unknown as Record<string, FlagSpec>;
const entries = TAGS_1938.map((t) => [t, flags[t]!] as [string, FlagSpec]);

describe('flag atlas (PLAN 1.6)', () => {
  const atlas = buildFlagAtlas(entries, presets);

  it('builds one cell per nation, deterministically', () => {
    expect(Object.keys(atlas.cells)).toEqual(TAGS_1938);
    expect(atlas.width).toBe(16 * 49 + 1);
    expect(atlas.height).toBe(Math.ceil(TAGS_1938.length / 16) * 33 + 1);
    expect(xxhash32View(buildFlagAtlas(entries, presets).rgba)).toBe(xxhash32View(atlas.rgba));
  });

  const cell = (tag: string): Uint8Array => {
    const { x, y } = atlas.cells[tag]!;
    const out = new Uint8Array(atlas.cellW * atlas.cellH * 4);
    for (let r = 0; r < atlas.cellH; r++) out.set(atlas.rgba.subarray(((y + r) * atlas.width + x) * 4, ((y + r) * atlas.width + x + atlas.cellW) * 4), r * atlas.cellW * 4);
    return out;
  };
  const px = (tag: string, fx: number, fy: number): number[] => {
    const c = cell(tag);
    const i = (Math.floor(fy * atlas.cellH) * atlas.cellW + Math.floor(fx * atlas.cellW)) * 4;
    return [c[i]!, c[i + 1]!, c[i + 2]!, c[i + 3]!];
  };

  it('every flag fills its fitted area (Nepal is a pennant) and no two nations share a flag', () => {
    const hashes = new Map<number, string>();
    for (const t of TAGS_1938) {
      const c = cell(t);
      let opaque = 0;
      for (let i = 3; i < c.length; i += 4) if (c[i] === 255) opaque++;
      // The flag is fitted into the cell with its aspect kept, so it covers only its fitted area.
      const a = flags[t]!.aspect;
      const fw = Math.min(atlas.cellW, Math.round(atlas.cellH * a));
      const fh = Math.min(atlas.cellH, Math.round(fw / a));
      const cover = opaque / (fw * fh);
      expect(cover, t).toBeGreaterThan(t === 'NEP' ? 0.4 : 0.95); // Nepal's pennant is not rectangular
      const h = xxhash32View(c);
      expect(hashes.get(h), `${t} duplicates ${hashes.get(h)}`).toBeUndefined();
      hashes.set(h, t);
    }
  });

  it('known flags have the right colours in the right places', () => {
    expect(px('GER', 0.5, 0.15)).toEqual([0, 0, 0, 255]);
    expect(px('GER', 0.5, 0.5)).toEqual([255, 255, 255, 255]);
    expect(px('GER', 0.5, 0.85)).toEqual([0xdd, 0, 0, 255]);
    expect(px('FRA', 0.15, 0.5)).toEqual([0x00, 0x23, 0x95, 255]);
    expect(px('JAP', 0.5, 0.5)).toEqual([0xbc, 0x00, 0x2d, 255]);
    expect(px('JAP', 0.1, 0.1)).toEqual([255, 255, 255, 255]);
    expect(px('SWI', 0.05, 0.5)[3]).toBe(0); // square flag: transparent letterbox
    expect(px('ENG', 0.5, 0.5)).toEqual([0xc8, 0x10, 0x2e, 255]); // St George's cross centre
  });

  it('SVG output carries one polygon per shape and the flag aspect', () => {
    for (const t of ['ENG', 'USA', 'NEP', 'TIB']) {
      const svg = flagSvg(flags[t]!, presets, 32);
      expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
      expect(svg.match(/<polygon /g)!.length).toBe(flagShapes(flags[t]!, presets).length);
      expect(svg).toContain(`viewBox="0 0 ${Math.round(flags[t]!.aspect * 1000) / 1000} 1"`);
    }
  });

  it('presets substitute colour parameters, and bad specs fail loudly', () => {
    const a = flagShapes({ aspect: 1.5, layers: [{ t: 'preset', name: 'nordic', colors: ['#112233', '#445566'] }] }, presets);
    expect(a.map((s) => s.rgb)).toEqual([0x112233, 0x445566, 0x445566]);
    expect(() => flagShapes({ aspect: 1.5, layers: [{ t: 'preset', name: 'nope' }] }, presets)).toThrow(/unknown flag preset/);
    expect(() => flagShapes({ aspect: 1.5, layers: [{ t: 'preset', name: 'nordic' }] }, presets)).toThrow(/\$1 not given/);
    const buf = new Uint8Array(4 * 4 * 4);
    rasterizeFlag({ aspect: 1, layers: [{ t: 'stripes', dir: 'h', colors: ['#ff0000'] }] }, presets, buf, 4, 0, 0, 4, 4);
    expect([...buf.subarray(0, 4)]).toEqual([255, 0, 0, 255]);
  });
});
