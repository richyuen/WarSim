import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import { NATIONS_1938 } from '../../src/sim/scenario1938';

// PLAN 1.39a AT: e2e toggles each setting and verifies the effect (UI size, unit size, speed
// persistence, seed + new game); F2 downloads a PNG of the map.

const POL = NATIONS_1938.findIndex((n) => n.tag === 'POL') + 1;

async function open(page: Page, query = 'scenario=1938&paused=1&seed=1938'): Promise<void> {
  await page.setViewportSize({ width: 1400, height: 800 });
  await page.goto(`/?${query}`);
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null, null, { timeout: 60_000 });
}

/** RGBA of a (2r+1)² box at the screen centre, freshly drawn. */
const box = (page: Page, r: number): Promise<number[]> =>
  page.evaluate((r) => {
    window.__warsim!.view!.draw();
    const c = document.getElementById('map') as HTMLCanvasElement;
    const gl = c.getContext('webgl2')!;
    const n = 2 * r + 1;
    const px = new Uint8Array(n * n * 4);
    gl.readPixels(Math.floor(c.width / 2) - r, Math.floor(c.height / 2) - r, n, n, gl.RGBA, gl.UNSIGNED_BYTE, px);
    return Array.from(px);
  }, r);
const diff = (a: number[], b: number[]): number => {
  let n = 0;
  for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i]! - b[i]!) + Math.abs(a[i + 1]! - b[i + 1]!) + Math.abs(a[i + 2]! - b[i + 2]!) > 30) n++;
  return n;
};

test('settings: UI size, unit size, screenshot, seed and speed persistence', async ({ page }, info) => {
  test.setTimeout(180_000);
  await open(page);
  await page.getByTestId('settings-btn').click();
  await expect(page.getByTestId('settings-panel')).toBeVisible();
  await expect(page.getByTestId('settings-current-seed')).toContainText('1938');

  // UI size: the root font and the bar grow; the choice persists.
  const barBefore = (await page.getByTestId('bottombar').boundingBox())!.height;
  await page.getByTestId('settings-ui-scale').selectOption('1.3');
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).fontSize)).toBe('20.8px');
  expect((await page.getByTestId('bottombar').boundingBox())!.height).toBeGreaterThan(barBefore * 1.2);

  // Unit size: markers around a Polish formation change size with the setting.
  const f = await page.evaluate((p) => window.__warsim!.view!.formationsOf(p)[0]!, POL);
  const [fx, fy] = (await page.evaluate((id) => window.__warsim!.view!.formationPos(id), f))!;
  await page.evaluate(({ fx, fy }) => window.__warsim!.view!.controller.set({ cx: fx, cy: fy, scale: 6 }), { fx, fy });
  await page.getByTestId('settings-unit-scale').selectOption('0.5');
  const small = await box(page, 30);
  expect(diff(small, await box(page, 30))).toBe(0); // same setting, same picture
  await page.getByTestId('settings-unit-scale').selectOption('2');
  expect(await page.evaluate(() => window.__warsim!.view!.unitScale)).toBe(2);
  expect(diff(small, await box(page, 30))).toBeGreaterThan(20);

  // F2: a PNG of the map, at the canvas size.
  const [dl] = await Promise.all([page.waitForEvent('download'), page.keyboard.press('F2')]);
  expect(dl.suggestedFilename()).toMatch(/^warsim-1938-01-01\.png$/);
  const file = path.join(info.outputPath(), dl.suggestedFilename());
  await dl.saveAs(file);
  const png = readFileSync(file);
  expect(png.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe(true);
  const size = await page.evaluate(() => [(document.getElementById('map') as HTMLCanvasElement).width, (document.getElementById('map') as HTMLCanvasElement).height]);
  expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual(size);
  // The button does the same.
  const [dl2] = await Promise.all([page.waitForEvent('download'), page.getByTestId('settings-screenshot').click()]);
  expect(dl2.suggestedFilename()).toMatch(/\.png$/);

  // Speed persists (PLAN 1.8): set level 2, reload, still level 2; UI and unit sizes persist too.
  await page.getByTestId('speed-down').click();
  const level = await page.getByTestId('speed-label').getAttribute('data-level');
  await open(page);
  await expect(page.getByTestId('speed-label')).toHaveAttribute('data-level', level!);
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).fontSize)).toBe('20.8px');
  expect(await page.evaluate(() => window.__warsim!.view!.unitScale)).toBe(2);

  // Seed: a new game with a chosen seed, and a random one is a number.
  await page.getByTestId('settings-btn').click();
  await page.getByTestId('settings-random-seed').click();
  expect(await page.getByTestId('settings-seed').inputValue()).toMatch(/^\d+$/);
  await page.getByTestId('settings-seed').fill('4242');
  await Promise.all([page.waitForURL(/seed=4242/), page.getByTestId('settings-new-game').click()]);
  await page.waitForFunction(() => window.__warsim?.hud.stats.value !== null && window.__warsim?.hud.stats.value !== undefined, null, { timeout: 60_000 });
  expect((await page.evaluate(() => window.__warsim!.sim.inspect())).seed).toBe(4242);

  // Back to defaults for the other tests (settings persist per origin).
  await page.evaluate(() => {
    window.__warsim!.settings.setUiScale(1);
    window.__warsim!.settings.setUnitScale(1);
  });
});
