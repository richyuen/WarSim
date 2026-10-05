import { describe, expect, it } from 'vitest';
import presetsJson from '../../data/flags/presets.json' with { type: 'json' };
import flagsJson from '../../data/scenarios/1938/flags.json' with { type: 'json' };
import { FlagStore } from '../../src/app/flagStore';
import type { FlagPresets, FlagSpec } from '../../src/shared/flags';
import { FLAG_H, FLAG_W, foundedFlag, specToPixels } from '../../src/shared/flagPixels';
import type { FromWorker, Inspection, ScenarioId, SimInit } from '../../src/shared/protocol';
import { SCENARIO_INFO } from '../../src/shared/scenarios';
import { NATIONS_1938, SIZE_1938 } from '../../src/sim/scenario1938';
import { SimServer } from '../../src/worker/server';
import { assets1938 } from '../helpers/earth';

// PLAN 2.16b: flags and names by scenario. The flag store and the worker read the 1938 table
// by nation id whatever the scenario: the toy world's two nations and the random world's sixty
// flew the flags of the first nations of 1938, and the toy world's had their names.

const PIXELS = FLAG_W * FLAG_H;
const SPECS = flagsJson.flags as unknown as Record<string, FlagSpec>;
const PRESETS = presetsJson.presets as unknown as FlagPresets;
const COLOUR = 0x3b6fb6;

/** The colours of a flag that hold a twentieth of it or more (not the edge of a shape). */
function colours(px: Uint32Array): number[] {
  const n = new Map<number, number>();
  for (const v of px) n.set(v, (n.get(v) ?? 0) + 1);
  return [...n].filter(([, k]) => k >= PIXELS / 20).map(([c]) => c);
}

const storeOf = (scenario: ScenarioId): FlagStore => new FlagStore(() => COLOUR, () => false, (id) => SCENARIO_INFO[scenario].nationTags[id - 1]);

/** The nations of a fresh game of `init` as the worker names them. */
function names(init: SimInit): Inspection['nations'] {
  const replies: FromWorker[] = [];
  const server = new SimServer((m) => replies.push(m));
  server.handle({ type: 'init', reqId: 1, init }, 0);
  server.handle({ type: 'inspect', reqId: 2 }, 0);
  const r = replies.find((m) => m.type === 'reply' && m.reqId === 2);
  if (!r || r.type !== 'reply' || !r.bytes) throw new Error('no reply with bytes');
  return (JSON.parse(new TextDecoder().decode(r.bytes)) as Inspection).nations;
}

describe('flags by scenario (PLAN 2.16b)', () => {
  it('only the 1938 world has the tags of 1938', () => {
    expect(SCENARIO_INFO['1938'].nationTags).toEqual(NATIONS_1938.map((n) => n.tag));
    expect(SCENARIO_INFO.toy.nationTags).toEqual([]);
    expect(SCENARIO_INFO.random.nationTags).toEqual([]);
  });

  it('a nation of the 1938 world flies the flag of its tag', () => {
    const store = storeOf('1938');
    for (const id of [1, 2, 50, NATIONS_1938.length]) {
      expect(store.pixelsOf(id), `nation ${id}`).toEqual(specToPixels(SPECS[NATIONS_1938[id - 1]!.tag]!, PRESETS));
    }
  });

  for (const scenario of ['toy', 'random'] as const) {
    it(`a nation of the ${scenario} world flies a flag made from its id and colour, not one of 1938`, () => {
      const store = storeOf(scenario);
      for (const id of [1, 2, 50, NATIONS_1938.length]) {
        const px = store.pixelsOf(id);
        expect(px, `nation ${id}`).toEqual(specToPixels(foundedFlag(id, COLOUR), PRESETS));
        expect(px, `nation ${id}`).not.toEqual(specToPixels(SPECS[NATIONS_1938[id - 1]!.tag]!, PRESETS));
        const cs = colours(px);
        expect(cs.length, `nation ${id}`).toBeGreaterThanOrEqual(2);
        expect(cs, `nation ${id}`).toContain(COLOUR);
      }
    });
  }
});

describe('names by scenario (PLAN 2.16b)', () => {
  const literal = (rows: Inspection['nations']): void => {
    const seen = new Set<string>();
    for (const n of rows) {
      expect(n.name, `nation ${n.id}`).toMatch(/^=./);
      expect(n.name, `nation ${n.id}`).not.toMatch(/^=Free state \d+$/);
      expect(seen.has(n.name), `two nations called ${n.name}`).toBe(false);
      seen.add(n.name);
    }
  };

  it('the nations of the toy world have names of their own', () => {
    const rows = names({ scenario: 'toy', seed: 1 });
    expect(rows.length).toBe(2);
    literal(rows);
  });

  it('the nations of the random world have names of their own', () => {
    const rows = names({ scenario: 'random', seed: 7, options: { nations: 60 }, assets: assets1938(SIZE_1938.w) });
    expect(rows.length).toBe(60);
    literal(rows);
  });

  it('the nations of the 1938 world have the names of 1938', () => {
    const rows = names({ scenario: '1938', seed: 7, assets: assets1938(SIZE_1938.w) });
    expect(rows.map((n) => n.name)).toEqual(NATIONS_1938.map((n) => n.nameKey));
  });
});
