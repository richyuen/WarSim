import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { AIR_PER_LEVEL, airbaseHolder, airbaseRoom } from '../../src/sim/data/airbases';
import { validateDataSet } from '../../src/sim/data/schemas';
import { AIRBASES_1938, NATIONS_1938, SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { assets1938 } from '../helpers/earth';

// PLAN 5.1c: the 1938 scenario's airbases. Every capital city is one, a city of size 5 one of
// level 2, and 23 main air stations by hand; who holds the cell holds the base; its room is the
// airbase building's 50 aircraft a level.

const id = (t: string): number => NATIONS_1938.findIndex((n) => n.tag === t) + 1;

function readTree(dir: string, base = ''): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? `${base}/${e.name}` : e.name;
    if (e.isDirectory()) Object.assign(out, readTree(path.join(dir, e.name), rel));
    else if (e.name.endsWith('.json')) out[rel] = JSON.parse(fs.readFileSync(path.join(dir, e.name), 'utf8'));
  }
  return out;
}

describe('the airbases of 1938 (PLAN 5.1c)', () => {
  const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(SIZE_1938.w) });
  const w = s.world;

  it('every living nation holds one; every station by hand stands on its nation\'s land', () => {
    expect(w.airbases.length).toBeGreaterThan(150);
    const held = new Set(w.airbases.map((b) => airbaseHolder(w.cells.controller, b)));
    const none: string[] = [];
    w.nations.forEach((n) => {
      if (w.nations.cols.living[n] === 1 && !held.has(n)) none.push(NATIONS_1938[n - 1]!.tag);
    });
    expect(none).toEqual([]);
    const byHand = w.airbases.filter((b) => b.def >= 0);
    expect(byHand.length).toBe(AIRBASES_1938.bases.length);
    for (const b of byHand) {
      const d = AIRBASES_1938.bases[b.def]!;
      expect(w.cells.owner[b.cell], d.name).toBe(id(d.nation!));
      expect(b.level, d.name).toBeGreaterThanOrEqual(d.level);
    }
    // Capitals: Berlin's is a base of Germany's.
    const berlin = w.airbases.find((b) => b.name === 'Berlin' || b.name === 'Tempelhof');
    expect(berlin && airbaseHolder(w.cells.controller, berlin)).toBe(id('GER'));
  });

  it('a base taken is its taker\'s; its room is 50 aircraft a level', () => {
    const base = w.airbases.find((b) => b.name === 'Le Bourget')!;
    expect(airbaseHolder(w.cells.controller, base)).toBe(id('FRA'));
    w.setController(base.cell, id('GER'));
    expect(airbaseHolder(w.cells.controller, base)).toBe(id('GER'));
    expect(AIR_PER_LEVEL).toBe(50);
    for (const b of w.airbases) expect(airbaseRoom(b)).toBe(50 * b.level);
  });

  it('the data set refuses a base of a level the building has not, and one with no place', () => {
    const data = readTree(path.resolve(import.meta.dirname, '../../data'));
    expect(validateDataSet(data)).toEqual([]);
    const bad = structuredClone(data['scenarios/1938/airbases.json']) as { bases: { level: number; lonLat?: unknown }[] };
    bad.bases[0]!.level = 6;
    expect(validateDataSet({ ...data, 'scenarios/1938/airbases.json': bad }).length).toBeGreaterThan(0);
  });
});
