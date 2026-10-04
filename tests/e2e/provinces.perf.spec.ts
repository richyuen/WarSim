import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import type {} from '../../src/app/testApi';
import { decodeAdmin1, type Admin1Meta } from '../../src/shared/admin1';
import { xxhash32View } from '../../src/sim/core/hash';
import { buildProvinceRaster } from '../../src/sim/data/provinces';

// PLAN 0.19: the admin-1 → province raster is built at load time in the sim worker, from the
// shipped assets (fetched, sha256-verified, gunzipped). The M raster must build in < 1.5 s in
// Chromium, contain every source province, and equal the Node build bit for bit. A `.perf` spec:
// it runs in the `perf` project after the parallel suite, so the budget is measured uncontended.

const dir = path.resolve(import.meta.dirname, '../../public/data/earth');
const manifest = JSON.parse(readFileSync(path.join(dir, 'manifest.json'), 'utf8')) as { assets: { kind: string; path: string }[] };
const file = (kind: string): Buffer => gunzipSync(readFileSync(path.join(dir, manifest.assets.find((a) => a.kind === kind)!.path)));
const geo = decodeAdmin1(file('admin1-geometry'));
const meta = JSON.parse(file('admin1-meta').toString('utf8')) as Admin1Meta[];

test('province raster builds in the worker at S and M sizes (Chromium == Node)', async ({ page }) => {
  await page.goto('/?scenario=toy&paused=1&view=0');
  await page.waitForFunction(() => window.__warsim !== undefined);
  for (const [w, h] of [[1024, 512], [2048, 1024]] as const) {
    const r = await page.evaluate(({ w, h }) => window.__warsim!.sim.buildProvinces(w, h), { w, h });
    console.log(`${w}×${h}: raster ${r.ms.raster.toFixed(0)} ms, decode ${r.ms.decode.toFixed(0)} ms, fetch ${r.ms.fetch.toFixed(0)} ms, total ${r.ms.total.toFixed(0)} ms; forced ${r.forced}`);
    expect(r.provinces).toBe(meta.length);
    expect(r.present).toBe(meta.length); // every source province (NE admin-1 has no water features)
    expect(r.missing).toBe(0);
    expect(r.ms.decode + r.ms.raster).toBeLessThan(1500);
    expect(r.hash).toBe(xxhash32View(buildProvinceRaster(geo, meta, w, h).ids));
  }
});
