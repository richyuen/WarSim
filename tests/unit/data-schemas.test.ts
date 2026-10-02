import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import en from '../../src/ui/i18n/en.json';
import { LAT_BOTTOM_DEG, LAT_TOP_DEG } from '../../src/sim/data/projection';
import { collectKeys, schemaFor, TERRAIN_IDS, validateDataSet, validateFile } from '../../src/sim/data/schemas';
import { SCENARIO_GEOMETRY } from '../../src/shared/scenarios';

// PLAN 1.1: every JSON file under data/ validates against its zod schema (plus the cross-file
// checks); an invalid fixture fails with a readable `<file>: <path>: <message>` error.

const root = path.resolve(import.meta.dirname, '../..');

function readTree(dir: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const walk = (rel: string): void => {
    for (const e of readdirSync(path.join(dir, rel), { withFileTypes: true })) {
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) walk(r);
      else if (e.name.endsWith('.json')) out[r] = JSON.parse(readFileSync(path.join(dir, r), 'utf8'));
      else throw new Error(`data/${r}: only .json files belong in data/`);
    }
  };
  walk('');
  return out;
}

const data = readTree(path.join(root, 'data'));
const fixtures = readTree(path.join(root, 'tests/fixtures/data-invalid'));

describe('data/** schemas (PLAN 1.1)', () => {
  it('finds the expected data files', () => {
    expect(Object.keys(data).sort()).toEqual(
      expect.arrayContaining(['terrain.json', 'units/land.json', 'units/sea.json', 'units/air.json', 'traits/traits.json',
        'buildings/buildings.json', 'maps/earth/map.json', 'maps/toy/map.json', 'scenarios/1938/scenario.json', 'scenarios/toy/scenario.json']),
    );
    expect(Object.keys(data).filter((f) => f.startsWith('tech/')).length).toBeGreaterThanOrEqual(5);
  });

  for (const file of Object.keys(data).sort()) {
    it(`${file} matches its schema`, () => {
      expect(validateFile(file, data[file])).toEqual([]);
    });
  }

  it('the whole data set passes the cross-file checks', () => {
    expect(validateDataSet(data)).toEqual([]);
  });

  it('every nameKey/descKey exists in the English catalog', () => {
    const missing = collectKeys(data).filter((k) => !(k in en));
    expect(missing).toEqual([]);
  });

  it('every unit class has at least one unit type', () => {
    const classes = new Set(
      Object.keys(data).filter((f) => f.startsWith('units/')).flatMap((f) => (data[f] as { types: { class: string }[] }).types.map((t) => t.class)),
    );
    expect([...classes].sort()).toEqual(
      ['aa', 'armor_h', 'armor_l', 'armor_m', 'art', 'at', 'bb', 'bomber_str', 'bomber_tac', 'ca', 'cas', 'cl', 'cv', 'dd',
        'fighter', 'inf', 'mech', 'mot', 'naval_bomber', 'nuke_missile', 'ss', 'tp', 'transport_air'],
    );
  });

  it('the heavy tank is gated behind a 1942+ tech (SPEC §6.1)', () => {
    const units = (data['units/land.json'] as { types: { id: string; techReq?: string }[] }).types;
    const techs = Object.keys(data).filter((f) => f.startsWith('tech/')).flatMap((f) => (data[f] as { techs: { id: string; year: number }[] }).techs);
    const req = units.find((u) => u.id === 'tank_heavy')!.techReq!;
    expect(techs.find((t) => t.id === req)!.year).toBeGreaterThanOrEqual(1942);
  });

  it('the earth map agrees with the projection constants, and toy geometry comes from data', () => {
    const earth = data['maps/earth/map.json'] as { projection: { latTopDeg: number; latBottomDeg: number }; sizes: { id: string; w: number }[] };
    expect(earth.projection.latTopDeg).toBe(LAT_TOP_DEG);
    expect(earth.projection.latBottomDeg).toBe(LAT_BOTTOM_DEG);
    expect(earth.sizes.map((s) => `${s.id}:${s.w}`)).toEqual(['S:1024', 'M:2048', 'L:4096', 'XL:6144']);
    expect(SCENARIO_GEOMETRY.toy).toEqual({ w: 256, h: 128, kmPerCell: 40075 / 256, wrapX: true });
  });
});

describe('invalid data fails with readable paths (PLAN 1.1)', () => {
  const errs = (file: string, as: string): string[] => validateFile(as, fixtures[file]);

  it('a wrong type deep inside a unit reports the full path', () => {
    expect(errs('units-bad-type.json', 'units/bad.json')).toEqual([
      'units/bad.json: types[1].stats.speed_kmh: Invalid input: expected number, received string',
    ]);
  });

  it('unknown keys, bad enums and domain/class mismatches are reported per field', () => {
    const e = errs('units-bad-fields.json', 'units/bad.json');
    expect(e).toContain('units/bad.json: types[0]: Unrecognized key: "speed"');
    expect(e).toContain('units/bad.json: types[0].terrainMods: Unrecognized key: "lava"');
    expect(e).toContain('units/bad.json: types[0].mobility: sea units move by ship');
    expect(e).toContain('units/bad.json: types[0].domain: class dd is a sea class');
  });

  it('terrain out of enum order is a set-level error', () => {
    const t = structuredClone(data['terrain.json']) as { terrain: unknown[] };
    t.terrain.reverse();
    expect(validateDataSet({ 'terrain.json': t })).toEqual([`terrain.json: terrain: must list every class once, in enum order: ${TERRAIN_IDS.join(', ')}`]);
  });

  it('cross-file references, duplicates and tech cycles are caught', () => {
    const e = validateDataSet({ ...data, 'tech/bad.json': fixtures['tech-cycle.json'], 'units/bad.json': fixtures['units-bad-ref.json'] });
    expect(e).toContain("units/bad.json: types[0].techReq: unknown tech 'warp_drive'");
    expect(e).toContain("units/land.json: types[0].id: duplicate id 'infantry' (also in units/bad.json)");
    expect(e).toContain('tech: prerequisite cycle tech_a → tech_b → tech_a');
    expect(e).toContain("tech/bad.json: techs[2].prereqs[0]: unknown tech 'missing_tech'");
  });

  it('scenario map/size references and malformed dates are checked', () => {
    const e = validateDataSet({ ...data, 'scenarios/bad/scenario.json': fixtures['scenario-bad.json'] });
    expect(e).toContain('scenarios/bad/scenario.json: startDate: dates are YYYY-MM-DD');
    const s = { ...(data['scenarios/1938/scenario.json'] as object), id: 'bad', size: 'XXL' };
    expect(validateDataSet({ ...data, 'scenarios/bad/scenario.json': s })).toEqual(["scenarios/bad/scenario.json: size: map 'earth' has no size 'XXL'"]);
  });

  it('a file under an unknown path has no schema and is rejected', () => {
    expect(schemaFor('misc/notes.json')).toBeUndefined();
    expect(validateFile('misc/notes.json', {})[0]).toMatch(/^misc\/notes\.json: no schema matches this path/);
  });
});
