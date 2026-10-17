import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import { cellOf } from '../../src/sim/data/terrain';
import { NATIONS_1938, SIZE_1938 } from '../../src/sim/scenario1938';

// PLAN 7.16a, 7.16b (critic run 7, God Mode 7: "the nuke has no size"; "the tools are hidden.
// Pressing God Mode changes nothing on screen … at 1600 × 900 the map tools are below the fold"):
// God Mode pressed with no nation selected shows its map tools on the bottom bar, all on screen;
// the Nuke tool has a size, and a thermonuclear bomb bursts as one.

const { w: W, h: H } = SIZE_1938;
const id = (tag: string): number => NATIONS_1938.findIndex((n) => n.tag === tag) + 1;
const TOOLS = ['revolt', 'nation', 'battle', 'brush', 'nuke', 'city', 'raze'];

async function lookAt(page: Page, lon: number, lat: number, scale = 8): Promise<void> {
  const [x, y] = cellOf(lon, lat, W, H);
  await page.evaluate(({ x, y, scale }) => window.__warsim!.view!.controller.set({ cx: x, cy: y, scale }), { x, y, scale });
  await page.waitForTimeout(150);
}

test('God Mode shows its map tools at once; the Nuke tool has a size', async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto('/?scenario=1938&paused=1&seed=1938');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null && window.__warsim!.sim.mapLayers !== null, null, { timeout: 60_000 });
  expect(await page.evaluate(() => window.__warsim!.hud.selected.value)).toBe(0);
  await expect(page.getByTestId('god-tools')).toHaveCount(0);

  // Pressed: the tools, every one inside the view, with no nation selected.
  await page.getByTestId('god-btn').click();
  await expect(page.getByTestId('god-tools')).toBeVisible();
  for (const k of TOOLS) {
    const b = (await page.getByTestId(`god-tool-${k}`).boundingBox())!;
    expect(b, k).not.toBeNull();
    expect(b.y + b.height, `${k} inside the view`).toBeLessThanOrEqual(900);
    expect(b.x + b.width, `${k} inside the view`).toBeLessThanOrEqual(1600);
  }
  // A tool that acts for a nation says to pick one first.
  await page.getByTestId('god-tool-brush').click();
  await expect(page.getByTestId('god-tool-hint')).toHaveText('Select a nation first: this tool acts for it.');
  await page.getByTestId('god-tool-brush').click();

  // The Nuke tool: its size, thermonuclear, on Warsaw.
  await page.getByTestId('god-tool-nuke').click();
  await expect(page.getByTestId('god-nuke-size')).toBeVisible();
  await page.getByTestId('god-nuke-size').selectOption('thermonuclear');
  await page.screenshot({ path: path.resolve('docs/evidence/7.16/a-god-tools.png') });
  await lookAt(page, 21.01, 52.23);
  await page.mouse.click(800, 450);
  await expect(page.getByTestId('nuke-alert-text')).toContainText('a hydrogen bomb', { timeout: 15_000 });
  // An atomic one after it, on Prague.
  await page.getByTestId('nuke-close').click();
  await page.getByTestId('god-tool-nuke').click();
  await page.getByTestId('god-nuke-size').selectOption('fission');
  await lookAt(page, 14.42, 50.09);
  await page.mouse.click(800, 450);
  await expect(page.getByTestId('nuke-alert-text')).toContainText('an atomic bomb', { timeout: 15_000 });

  // The God tab of a nation keeps its powers, not the map tools.
  await lookAt(page, 10.5, 51);
  await page.mouse.click(800, 450);
  await expect(page.getByTestId('nation-panel')).toHaveAttribute('data-nation', String(id('GER')));
  await page.getByTestId('tab-god').click();
  await expect(page.getByTestId('god-tools')).toBeVisible();
  await expect(page.getByTestId('god-tool-nuke')).toHaveCount(1);
});
