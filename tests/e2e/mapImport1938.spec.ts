import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import terrainJson from '../../data/terrain.json' with { type: 'json' };
import type {} from '../../src/app/testApi';
import type { Inspection } from '../../src/shared/protocol';
import { Terrain } from '../../src/shared/terrain';
import { NATIONS_1938 } from '../../src/sim/scenario1938';
import { CELLS_PER_PIXEL, nationFixture, NATION_FIXTURE_PIXELS, terrainFixture, TERRAIN_FIXTURE_PIXELS } from '../helpers/importFixture';

// PLAN 1.37a AT: importing a fixture PNG yields the expected cell counts (terrain, then nations),
// through the editor's file input; land and water changed, so coasts follow the cells; undo
// brings the original map (and the fine coastline) back.

const color = (id: string): number => parseInt(terrainJson.terrain.find((t) => t.id === id)!.color.slice(1), 16);
const GER = NATIONS_1938.findIndex((n) => n.tag === 'GER') + 1;
const POL = NATIONS_1938.findIndex((n) => n.tag === 'POL') + 1;
const inspect = (page: Page): Promise<Inspection> => page.evaluate(() => window.__warsim!.sim.inspect());

test('map import: a fixture PNG becomes terrain and nations with exact cell counts', async ({ page }, info) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1400, height: 800 });
  await page.goto('/?scenario=1938&paused=1&seed=1938');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null && window.__warsim!.view!.hasFineCoast, null, { timeout: 60_000 });
  const start = await inspect(page);
  await page.getByTestId('editor-btn').click();

  // Terrain import.
  const png = terrainFixture({ water: color('water'), plains: color('plains'), forest: color('forest'), mountains: color('mountains') });
  await page.getByTestId('editor-import-layer').selectOption('terrain');
  await page.getByTestId('editor-import-file').setInputFiles({ name: 'terrain.png', mimeType: 'image/png', buffer: png });
  await expect.poll(async () => (await inspect(page)).terrainCounts[Terrain.Forest], { timeout: 30_000 }).toBe(TERRAIN_FIXTURE_PIXELS.forest * CELLS_PER_PIXEL);
  const t = await inspect(page);
  expect(t.terrainCounts[Terrain.Water]).toBe(TERRAIN_FIXTURE_PIXELS.water * CELLS_PER_PIXEL);
  expect(t.terrainCounts[Terrain.Plains]).toBe(TERRAIN_FIXTURE_PIXELS.plains * CELLS_PER_PIXEL);
  expect(t.terrainCounts[Terrain.Mountains]).toBe(TERRAIN_FIXTURE_PIXELS.mountains * CELLS_PER_PIXEL);
  // Land and water moved: the renderer drops the fine coastline of the original mask.
  await expect.poll(() => page.evaluate(() => window.__warsim!.view!.hasFineCoast)).toBe(false);

  // Nation import on top (black = unowned).
  const colors = await page.evaluate(({ g, p }) => {
    const n = window.__warsim!.hud.stats.value!.nations;
    return [n.find((x) => x.id === g)!.color, n.find((x) => x.id === p)!.color];
  }, { g: GER, p: POL });
  await page.getByTestId('editor-import-layer').selectOption('nation');
  await page.getByTestId('editor-import-file').setInputFiles({ name: 'nations.png', mimeType: 'image/png', buffer: nationFixture(colors[0]!, colors[1]!) });
  const owned = async (n: number) => (await inspect(page)).nations.find((x) => x.id === n)?.cells ?? 0;
  await expect.poll(() => owned(GER), { timeout: 30_000 }).toBe(NATION_FIXTURE_PIXELS.ger * CELLS_PER_PIXEL);
  expect(await owned(POL)).toBe(NATION_FIXTURE_PIXELS.pol * CELLS_PER_PIXEL);

  const out = process.env['EVIDENCE'] ? path.resolve(import.meta.dirname, '../../docs/evidence/1.37') : info.outputPath();
  mkdirSync(out, { recursive: true });
  await page.evaluate(() => window.__warsim!.view!.controller.set({ cx: 1536, cy: 512, scale: 0.7 }));
  await page.getByTestId('editor-close').click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(out, 'imported.png') });

  // Two undos: nations, then terrain with its linked owner clearing. The original world returns.
  await page.keyboard.press('Escape');
  await page.getByTestId('editor-btn').click();
  await page.getByTestId('editor-undo').click();
  await page.getByTestId('editor-undo').click();
  await expect.poll(async () => (await inspect(page)).rasters, { timeout: 30_000 }).toEqual(start.rasters);
  await expect.poll(() => page.evaluate(() => window.__warsim!.view!.hasFineCoast)).toBe(true);
});
