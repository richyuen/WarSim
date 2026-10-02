import { describe, expect, it } from 'vitest';
import templatesJson from '../../data/templates/land.json';
import landJson from '../../data/units/land.json';
import { placeOob, templateStrength, type TemplateDef, type UnitTypeLite } from '../../src/sim/data/oob';
import { NATIONS_1938, OOB_1938, OVERLORDS_1938, politicalMap1938, TAGS_1938 } from '../helpers/earth';

// PLAN 1.7: the starting land order of battle. AT: total strengths per major power lie within
// the documented ranges (ADR-20; the model counts divisional manpower, not rear services), and
// every formation stands on land its nation (or a puppet of it) holds.

const W = 2048;
const H = 1024;
const map = politicalMap1938(W);
const types = new Map((landJson.types as unknown as UnitTypeLite[]).map((u) => [u.id, u]));
const strength = new Map((templatesJson.templates as TemplateDef[]).map((t) => [t.id, templateStrength(t, types)]));

/** ADR-20: [formations, men, tanks] ranges per major power, 1 January 1938. */
const RANGES: Record<string, { formations: [number, number]; men: [number, number]; tanks: [number, number] }> = {
  GER: { formations: [45, 60], men: [450_000, 800_000], tanks: [1_000, 3_500] },
  SOV: { formations: [140, 200], men: [1_200_000, 2_000_000], tanks: [8_000, 20_000] },
  FRA: { formations: [50, 80], men: [450_000, 900_000], tanks: [1_500, 3_500] },
  ENG: { formations: [8, 16], men: [60_000, 200_000], tanks: [200, 700] },
  ITA: { formations: [70, 95], men: [700_000, 1_200_000], tanks: [500, 1_800] },
  JAP: { formations: [28, 40], men: [450_000, 900_000], tanks: [500, 2_000] },
  USA: { formations: [10, 18], men: [60_000, 200_000], tanks: [100, 400] },
  CHI: { formations: [120, 200], men: [800_000, 1_600_000], tanks: [0, 200] },
  POL: { formations: [35, 50], men: [300_000, 500_000], tanks: [400, 900] },
  CZS: { formations: [20, 40], men: [200_000, 450_000], tanks: [300, 700] },
};

describe('1938 order of battle (PLAN 1.7)', () => {
  it('every group places all its formations', () => {
    expect(map.unplacedGroups.map((i) => OOB_1938[i])).toEqual([]);
    expect(map.formations.length).toBe(OOB_1938.reduce((n, g) => n + g.count, 0));
  });

  it('major powers are within the documented strength ranges', () => {
    const out: string[] = [];
    for (const [tag, r] of Object.entries(RANGES)) {
      const id = TAGS_1938.indexOf(tag) + 1;
      const mine = map.formations.filter((f) => f.nation === id);
      const men = mine.reduce((s, f) => s + strength.get(f.template)!.men, 0);
      const tanks = mine.reduce((s, f) => s + strength.get(f.template)!.tanks, 0);
      const inside = (v: number, [lo, hi]: [number, number]): boolean => v >= lo && v <= hi;
      if (!inside(mine.length, r.formations) || !inside(men, r.men) || !inside(tanks, r.tanks)) {
        out.push(`${tag}: ${mine.length} formations, ${men} men, ${tanks} tanks`);
      }
    }
    expect(out).toEqual([]);
  });

  it('every formation stands on land its nation controls, or a puppet of it owns and controls', () => {
    const puppetsOf = new Map<number, Set<number>>();
    for (const [p, o] of OVERLORDS_1938) {
      const oi = TAGS_1938.indexOf(o) + 1;
      if (!puppetsOf.has(oi)) puppetsOf.set(oi, new Set());
      puppetsOf.get(oi)!.add(TAGS_1938.indexOf(p) + 1);
    }
    const bad = map.formations.filter((f) => {
      const c = f.cell;
      const ownLand = map.controller[c] === f.nation;
      const puppetLand = puppetsOf.get(f.nation)?.has(map.owner[c]!) === true && map.controller[c] === map.owner[c];
      return !(ownLand || puppetLand) || map.terrain[c]! < 2 || Math.floor(f.y) * W + Math.floor(f.x) !== c;
    });
    expect(bad.map((f) => `${TAGS_1938[f.nation - 1]} ${f.template} at ${f.x.toFixed(1)},${f.y.toFixed(1)}`)).toEqual([]);
  });

  it('wartime fronts: Japanese divisions stand in occupied China and Manchukuo, Chinese ones only on free Chinese land', () => {
    const jap = TAGS_1938.indexOf('JAP') + 1;
    const chi = TAGS_1938.indexOf('CHI') + 1;
    const man = TAGS_1938.indexOf('MAN') + 1;
    const japCells = map.formations.filter((f) => f.nation === jap).map((f) => f.cell);
    expect(japCells.filter((c) => map.owner[c] === chi && map.controller[c] === jap).length).toBeGreaterThanOrEqual(15);
    expect(japCells.filter((c) => map.owner[c] === man).length).toBeGreaterThanOrEqual(6);
    expect(map.formations.filter((f) => f.nation === chi).every((f) => map.controller[f.cell] === chi)).toBe(true);
  });

  it('every living nation with an army has formations; placement is deterministic and spaced', () => {
    const armed = new Set(OOB_1938.map((g) => g.nation));
    expect(armed.size).toBeGreaterThanOrEqual(95);
    const again = placeOob({ w: W, h: H, owner: map.owner, controller: map.controller, terrain: map.terrain, tags: TAGS_1938, overlordOf: OVERLORDS_1938, groups: OOB_1938 });
    expect(again.formations).toEqual(map.formations);
    expect(again.stacked).toBe(0);
    for (const n of NATIONS_1938.filter((x) => x.alive === false)) expect(armed.has(n.tag), n.tag).toBe(false);
  });

  it('template strengths add up from unit types', () => {
    expect(strength.get('infantry_div')).toEqual({ men: 24 * 500 + 3 * 120 + 100, tanks: 0, guns: 4 * 12, elements: 28 });
    expect(strength.get('panzer_div')!.tanks).toBe(340);
    expect(() => templateStrength({ id: 'x', elements: [{ type: 'nope', count: 1 }] }, types)).toThrow(/unknown unit type/);
  });
});
