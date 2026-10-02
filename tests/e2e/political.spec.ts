import { expect, test } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import type {} from '../../src/app/bench/benchApi';
import straitsJson from '../../data/maps/earth/straits.json' with { type: 'json' };
import nationsJson from '../../data/scenarios/1938/nations.json' with { type: 'json' };
import rulesJson from '../../data/scenarios/1938/ownership.json' with { type: 'json' };
import { decodeAdmin1, type Admin1Meta } from '../../src/shared/admin1';
import { xxhash32View } from '../../src/sim/core/hash';
import { buildOwnership, reconcileIslands, type OwnershipRules } from '../../src/sim/data/ownership';
import { buildProvinceRaster } from '../../src/sim/data/provinces';
import { cellOf, loadTerrain, type StraitDef } from '../../src/sim/data/terrain';

// PLAN 1.3: the 1938 political map builds in the sim worker bit-identical to Node, and renders.
// PLAN 1.5: city dots and names are drawn on top; names appear at T1.
// Screenshots go to docs/evidence/1.3/ when EVIDENCE=1, else to the test output folder.

const dir = path.resolve(import.meta.dirname, '../../public/data/earth');
const manifest = JSON.parse(readFileSync(path.join(dir, 'manifest.json'), 'utf8')) as { assets: { kind: string; path: string; width: number }[] };
const file = (kind: string, w?: number): Buffer =>
  gunzipSync(readFileSync(path.join(dir, manifest.assets.find((a) => a.kind === kind && (w === undefined || a.width === w))!.path)));
const W = 2048;
const H = 1024;

test('1938 political map: worker == Node, rendered at three zooms', async ({ page }, info) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1600, height: 800 });
  await page.goto('/bench.html?b=W');
  await page.waitForFunction(() => window.__bench !== undefined, null, { timeout: 90_000 });
  const r = (await page.evaluate(() => window.__bench!.run())) as { ownerHash: number; controllerHash: number; cells: number[]; ms: { total: number } };

  const meta = JSON.parse(file('admin1-meta').toString('utf8')) as Admin1Meta[];
  const pr = buildProvinceRaster(decodeAdmin1(file('admin1-geometry')), meta, W, H);
  const { terrain } = loadTerrain(new Uint8Array(file('terrain', W)), W, H, straitsJson.straits as unknown as StraitDef[]);
  reconcileIslands(terrain, pr.ids, meta, W, H);
  const node = buildOwnership({ w: W, h: H, provinceIds: pr.ids, provinces: meta, terrain, tags: nationsJson.nations.map((n) => n.tag), rules: rulesJson as unknown as OwnershipRules });
  expect(r.ownerHash).toBe(xxhash32View(node.owner));
  expect(r.controllerHash).toBe(xxhash32View(node.controller));
  const alive = nationsJson.nations.map((n) => (n as { alive?: boolean }).alive !== false);
  expect(r.cells.slice(1).every((c, i) => (alive[i] ? c > 0 : c === 0))).toBe(true);
  console.log(`political build in worker: ${r.ms.total.toFixed(0)} ms`);

  const out = process.env['EVIDENCE'] ? path.resolve(import.meta.dirname, '../../docs/evidence/1.3') : info.outputPath();
  mkdirSync(out, { recursive: true });
  const shot = async (name: string, lon: number, lat: number, scale: number): Promise<void> => {
    const [x, y] = cellOf(lon, lat, W, H);
    await page.evaluate(([cx, cy, s]) => window.__bench!.setCamera(cx!, cy!, s!), [x, y, scale]);
    await page.screenshot({ path: path.join(out, `${name}.png`) });
  };
  await shot('political-world', 0, 8, 1600 / W);
  await shot('political-europe', 18, 50, 3.2);
  await shot('political-east-asia', 115, 37, 2.6);
  await shot('political-danzig-corridor', 19.5, 53.5, 22);

  // PLAN 1.5: city names render at T1 (300–2000 m/px; scale 16 px/cell ≈ 1.2 km/px at M).
  const t1 = process.env['EVIDENCE'] ? path.resolve(import.meta.dirname, '../../docs/evidence/1.5') : out;
  mkdirSync(t1, { recursive: true });
  const [bx, by] = cellOf(13.4, 52.52, W, H);
  await page.evaluate(([cx, cy]) => window.__bench!.setCamera(cx!, cy!, 16), [bx, by]);
  const labels = await page.evaluate(() => window.__bench!.labels!());
  expect(labels.names).toEqual(expect.arrayContaining(['Berlin', 'Warsaw', 'Prague', 'Danzig', 'Königsberg', 'Breslau']));
  expect(labels.names.length).toBeGreaterThan(20);
  await page.screenshot({ path: path.join(t1, 'city-names-t1-central-europe.png') });
  const [ex, ey] = cellOf(116.4, 39.9, W, H);
  await page.evaluate(([cx, cy]) => window.__bench!.setCamera(cx!, cy!, 16), [ex, ey]);
  expect((await page.evaluate(() => window.__bench!.labels!())).names).toEqual(expect.arrayContaining(['Peiping', 'Tientsin', 'Kalgan']));
  await page.screenshot({ path: path.join(t1, 'city-names-t1-north-china.png') });
  expect(errors).toEqual([]);
});
