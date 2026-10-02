import { expect, test } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import type {} from '../../src/app/bench/benchApi';
import straitsJson from '../../data/maps/earth/straits.json' with { type: 'json' };
import terrainJson from '../../data/terrain.json' with { type: 'json' };
import { xxhash32View } from '../../src/sim/core/hash';
import { cellOf, loadTerrain, type StraitDef } from '../../src/sim/data/terrain';

// PLAN 1.2: the terrain raster loads in the sim worker (sha256-verified asset + crossings from
// data) bit-identical to Node, and the terrain view draws each class in its data colour.
// Screenshots go to docs/evidence/1.2/ when EVIDENCE=1, else to the test output folder.

const dir = path.resolve(import.meta.dirname, '../../public/data/earth');
const straits = straitsJson.straits as unknown as StraitDef[];
const W = 2048;
const H = 1024;

test('terrain loads in the worker == Node and renders in data colours', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1600, height: 800 });
  await page.goto('/bench.html?b=T');
  await page.waitForFunction(() => window.__bench !== undefined, null, { timeout: 60_000 });
  const r = (await page.evaluate(() => window.__bench!.run())) as { hash: number; counts: number[]; crossings: { id: string; linked: boolean }[] };

  const node = loadTerrain(new Uint8Array(gunzipSync(readFileSync(path.join(dir, `terrain-${W}x${H}.u8.wsz`)))), W, H, straits).terrain;
  expect(r.hash).toBe(xxhash32View(node));
  expect(r.crossings.filter((c) => !c.linked)).toEqual([]);
  expect(r.counts[1]).toBeGreaterThan(straits.length); // crossings painted

  // Fit the world, then read back the colour at known places.
  const scale = 1600 / W;
  await page.evaluate(([cx, cy, s]) => window.__bench!.setCamera(cx!, cy!, s!), [W / 2, H / 2, scale]);
  const out = process.env['EVIDENCE'] ? path.resolve(import.meta.dirname, '../../docs/evidence/1.2') : info.outputPath();
  mkdirSync(out, { recursive: true });
  await page.screenshot({ path: path.join(out, 'terrain-world.png') });
  const colourAt = (lon: number, lat: number): Promise<number[]> => {
    const [x, y] = cellOf(lon, lat, W, H);
    return page.evaluate(
      ([sx, sy]) => {
        const c = document.getElementById('map') as HTMLCanvasElement;
        const gl = c.getContext('webgl2')!;
        const dpr = c.width / c.clientWidth;
        const px = new Uint8Array(4);
        gl.readPixels(Math.floor(sx! * dpr), Math.floor(c.height - sy! * dpr), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
        return [px[0]!, px[1]!, px[2]!];
      },
      [(x - W / 2) * scale + 800, (y - H / 2) * scale + 400],
    );
  };
  const hex = (id: string): number[] => {
    const c = terrainJson.terrain.find((t) => t.id === id)!.color;
    return [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  };
  // Points whose 7×7 cell neighbourhood is a single class (checked in Node), so the smoothed
  // class boundaries cannot tint the sample.
  const samples = [[27, 26, 'desert'], [50, 20, 'desert'], [-62, -5, 'forest'], [-40, 75, 'ice'], [62, 49, 'grassland'], [100, 72, 'tundra'], [-30, 30, 'water']] as const;
  for (const [lon, lat, id] of samples) {
    const got = await colourAt(lon, lat);
    const want = hex(id);
    expect(Math.max(...got.map((v, i) => Math.abs(v - want[i]!))), `${id} at ${lon},${lat}: ${got}`).toBeLessThanOrEqual(6);
  }

  const [ex, ey] = cellOf(15, 50, W, H);
  await page.evaluate(([cx, cy]) => window.__bench!.setCamera(cx!, cy!, 4), [ex, ey]);
  await page.screenshot({ path: path.join(out, 'terrain-europe.png') });
  const [bx, by] = cellOf(27.5, 40.8, W, H);
  await page.evaluate(([cx, cy]) => window.__bench!.setCamera(cx!, cy!, 28), [bx, by]);
  await page.screenshot({ path: path.join(out, 'terrain-straits-turkey.png') });
  expect(errors).toEqual([]);
});
