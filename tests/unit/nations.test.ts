import { readFileSync } from 'node:fs';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import straitsJson from '../../data/maps/earth/straits.json';
import diplomacyJson from '../../data/scenarios/1938/diplomacy.json';
import nationsJson from '../../data/scenarios/1938/nations.json';
import rulesJson from '../../data/scenarios/1938/ownership.json';
import { decodeAdmin1, type Admin1Meta } from '../../src/shared/admin1';
import { deltaE, parseHex, rgbToLab } from '../../src/shared/color';
import { buildOwnership, nearestOwnedCell, reconcileIslands, type OwnershipRules } from '../../src/sim/data/ownership';
import { buildProvinceRaster } from '../../src/sim/data/provinces';
import type { NationDef } from '../../src/sim/data/schemas';
import { cellOf, loadTerrain, type StraitDef } from '../../src/sim/data/terrain';

// PLAN 1.4: ≥ 100 nations incl. colonies/dominions as puppets, with traits, aggression, cores,
// capitals and alliances. AT: schema pass (data-schemas.test.ts), every nation's capital lies in
// its own territory, and neighbouring nations differ in colour by ΔE > 15.

const dir = path.resolve(import.meta.dirname, '../../public/data/earth');
const manifest = JSON.parse(readFileSync(path.join(dir, 'manifest.json'), 'utf8')) as { assets: { kind: string; path: string; width: number }[] };
const file = (kind: string, w?: number): Buffer =>
  gunzipSync(readFileSync(path.join(dir, manifest.assets.find((a) => a.kind === kind && (w === undefined || a.width === w))!.path)));
const meta = JSON.parse(file('admin1-meta').toString('utf8')) as Admin1Meta[];
const nations = nationsJson.nations as unknown as NationDef[];
const tags = nations.map((n) => n.tag);
const living = nations.filter((n) => n.alive !== false);
const W = 2048;
const H = 1024;

const pr = buildProvinceRaster(decodeAdmin1(file('admin1-geometry')), meta, W, H);
const { terrain } = loadTerrain(new Uint8Array(file('terrain', W)), W, H, straitsJson.straits as unknown as StraitDef[]);
reconcileIslands(terrain, pr.ids, meta, W, H);
const { owner } = buildOwnership({ w: W, h: H, provinceIds: pr.ids, provinces: meta, terrain, tags, rules: rulesJson as unknown as OwnershipRules });

describe('1938 nations (PLAN 1.4)', () => {
  it('has at least 100 living nations, colonies and dominions among them as puppets', () => {
    expect(living.length).toBeGreaterThanOrEqual(100);
    const puppets = living.filter((n) => n.overlord);
    expect(puppets.length).toBeGreaterThanOrEqual(35);
    for (const t of ['CAN', 'AST', 'SAF', 'RAJ', 'AOF', 'DEI', 'BCO', 'MAN', 'MON', 'PHI']) expect(nations.find((n) => n.tag === t)!.overlord, t).toBeDefined();
  });

  it('every living nation has its capital in its own territory (≤ 2 cells off for coastal capitals)', () => {
    const off = living.flatMap((n) => {
      const id = tags.indexOf(n.tag) + 1;
      const [x, y] = cellOf(n.capital.lonLat[0], n.capital.lonLat[1], W, H);
      const c = nearestOwnedCell(owner, id, x, y, W, H, 2);
      return c < 0 || owner[c] !== id ? [`${n.tag} (${n.capital.name})`] : [];
    });
    expect(off).toEqual([]);
  });

  it('neighbouring nations differ in colour by ΔE > 15', () => {
    const seen = new Set<string>();
    const close: string[] = [];
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const a = owner[y * W + x]!;
        if (a === 0) continue;
        for (const [dx, dy] of [[1, 0], [0, 1]] as const) {
          if (y + dy >= H) continue;
          const b = owner[(y + dy) * W + ((x + dx) % W)]!;
          if (b === 0 || b === a) continue;
          const key = a < b ? `${a},${b}` : `${b},${a}`;
          if (seen.has(key)) continue;
          seen.add(key);
          const d = deltaE(parseHex(nations[a - 1]!.color), parseHex(nations[b - 1]!.color));
          if (d <= 15) close.push(`${tags[a - 1]}-${tags[b - 1]} ΔE ${d.toFixed(1)}`);
        }
      }
    }
    expect(seen.size).toBeGreaterThan(150);
    expect(close).toEqual([]);
  });

  it('extra cores reference real admin-0/admin-1 units, and the dead keep cores to revive from', () => {
    const adm0 = new Set(meta.map((m) => m.adm0));
    const adm1 = new Set(meta.map((m) => m.adm1));
    for (const n of nations) {
      for (const c of n.extraCores?.countries ?? []) expect(adm0.has(c), `${n.tag} core ${c}`).toBe(true);
      for (const p of n.extraCores?.provinces ?? []) expect(adm1.has(p), `${n.tag} core ${p}`).toBe(true);
    }
    for (const n of nations.filter((x) => x.alive === false)) expect(n.extraCores?.countries?.length, n.tag).toBeGreaterThan(0);
  });

  it('starting diplomacy: Axis precursor, Comintern, Allied guarantees and the wars of 1938', () => {
    const al = (id: string): string[] => diplomacyJson.alliances.find((a) => a.id === id)!.members;
    expect(al('anti_comintern').sort()).toEqual(['GER', 'ITA', 'JAP']);
    expect(al('comintern')).toContain('SOV');
    expect(diplomacyJson.guarantees.filter((g) => g.target === 'CZS').map((g) => g.guarantor).sort()).toEqual(['FRA', 'SOV']);
    expect(diplomacyJson.wars.map((w) => w.id).sort()).toEqual(['second_sino_japanese_war', 'spanish_civil_war']);
  });

  it('colour helpers match reference CIELAB values', () => {
    const lab = rgbToLab(0xff0000);
    expect(lab[0]).toBeCloseTo(53.24, 1);
    expect(lab[1]).toBeCloseTo(80.09, 1);
    expect(lab[2]).toBeCloseTo(67.2, 1);
    expect(deltaE(0xffffff, 0x000000)).toBeCloseTo(100, 1);
  });
});
