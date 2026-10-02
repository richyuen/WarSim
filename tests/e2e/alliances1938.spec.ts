import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import { NON_ALIGNED_COLOR } from '../../src/shared/mapModes';
import { cellOf } from '../../src/sim/data/terrain';
import { NATIONS_1938, SIZE_1938 } from '../../src/sim/scenario1938';

// PLAN 1.17: the alliance map mode (bottom-bar button) recolours every member with its
// alliance leader's colour and non-aligned nations grey, as a palette swap.

const { w: W, h: H } = SIZE_1938;
const hex = (tag: string): number => parseInt(NATIONS_1938.find((n) => n.tag === tag)!.color.slice(1), 16);
const rgb = (c: number): number[] => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
const dist = (a: number[], b: number[]): number => Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!);

/** Median-ish pixel at the centre of the view after centring on (lon, lat). */
async function colourAt(page: Page, lon: number, lat: number): Promise<number[]> {
  const [x, y] = cellOf(lon, lat, W, H);
  return page.evaluate(
    ({ x, y }) => {
      const v = window.__warsim!.view!;
      v.controller.set({ cx: x, cy: y, scale: 16 });
      v.draw();
      const c = document.getElementById('map') as HTMLCanvasElement;
      const gl = c.getContext('webgl2')!;
      const p = new Uint8Array(4);
      gl.readPixels(Math.floor(c.width / 2), Math.floor(c.height / 2), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, p);
      return [p[0]!, p[1]!, p[2]!];
    },
    { x, y },
  );
}

test('alliance map mode colours members by alliance and non-aligned nations grey', async ({ page }, info) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1400, height: 800 });
  await page.goto('/?scenario=1938&paused=1&seed=1938');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.view!.lastTick === 0, null, { timeout: 60_000 });
  await page.evaluate(() => localStorage.removeItem('warsim.mapMode'));

  const btn = page.getByTestId('mapmode-btn');
  await expect(btn).toHaveAttribute('data-mode', 'political');
  const italyPolitical = await colourAt(page, 12.5, 42.5);
  expect(dist(italyPolitical, rgb(hex('ITA')))).toBeLessThan(30);

  await btn.click();
  await expect(btn).toHaveAttribute('data-mode', 'alliances');
  await expect(btn).toHaveText(/Alliances/);
  const ger = rgb(hex('GER'));
  const eng = rgb(hex('ENG'));
  // Anti-Comintern: Germany (leader) and Italy share Germany's colour.
  expect(dist(await colourAt(page, 10.5, 51.0), ger)).toBeLessThan(30);
  expect(dist(await colourAt(page, 12.5, 42.5), ger)).toBeLessThan(30);
  // Anglo-French: France takes Britain's colour.
  expect(dist(await colourAt(page, 2.5, 46.5), eng)).toBeLessThan(30);
  // Switzerland is in no alliance.
  expect(dist(await colourAt(page, 8.2, 46.8), rgb(NON_ALIGNED_COLOR))).toBeLessThan(30);
  // The choice persists.
  expect(await page.evaluate(() => localStorage.getItem('warsim.mapMode'))).toBe('alliances');

  const out = process.env['EVIDENCE'] ? path.resolve(import.meta.dirname, '../../docs/evidence/1.17') : info.outputPath();
  mkdirSync(out, { recursive: true });
  const [ex, ey] = cellOf(15, 48, W, H);
  await page.evaluate(({ x, y }) => window.__warsim!.view!.controller.set({ cx: x, cy: y, scale: 3.2 }), { x: ex, y: ey });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(out, 'alliances-europe.png') });
  await btn.click(); // back to political for later tests sharing storage
  await expect(btn).toHaveAttribute('data-mode', 'political');
});
