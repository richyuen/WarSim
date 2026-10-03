import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import terrainJson from '../../data/terrain.json' with { type: 'json' };
import type {} from '../../src/app/testApi';
import type { Inspection } from '../../src/shared/protocol';
import { Terrain } from '../../src/shared/terrain';
import { NATIONS_1938, SIZE_1938 } from '../../src/sim/scenario1938';
import { CELLS_PER_PIXEL, decode, FIX_H, FIX_W, importedCounts, nationFixture, NATION_FIXTURE_PIXELS, terrainFixture, TERRAIN_FIXTURE_PIXELS } from '../helpers/importFixture';
import { paletteMap } from '../../src/shared/mapImport';
import { Sim } from '../../src/sim/sim';
import { assets1938 } from '../helpers/earth';

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
  // Exact counts: the fixture's, except that city cells keep their land (PLAN 1.41).
  const node = new Sim({ scenario: '1938', seed: 1938, assets: assets1938(SIZE_1938.w) });
  const cityCells: number[] = [];
  node.world.cities.forEach((id) => cityCells.push(node.world.cities.cols.cell[id]!));
  const values = paletteMap(decode(png), FIX_W, FIX_H, SIZE_1938.w, SIZE_1938.h, terrainJson.terrain.map((tt, value) => ({ rgb: parseInt(tt.color.slice(1), 16), value })), 1000, 0);
  const expected = importedCounts(values, node.world.cells.terrain, cityCells, terrainJson.terrain.length, Terrain.Water);
  await expect.poll(async () => (await inspect(page)).terrainCounts[Terrain.Forest], { timeout: 30_000 }).toBe(expected[Terrain.Forest]);
  const t = await inspect(page);
  expect(t.terrainCounts).toEqual(expected);
  // The fixture's classes dominate: city islands are well under 1% of the imported water.
  expect(TERRAIN_FIXTURE_PIXELS.water * CELLS_PER_PIXEL - t.terrainCounts[Terrain.Water]!).toBeLessThan(0.01 * TERRAIN_FIXTURE_PIXELS.water * CELLS_PER_PIXEL);
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
