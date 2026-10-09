import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import { NATIONS_1938 } from '../../src/sim/scenario1938';

// PLAN 1.39a AT: e2e toggles each setting and verifies the effect (UI size, unit size, speed
// persistence, seed + new game); F2 downloads a PNG of the map.

const tag = (t: string): number => NATIONS_1938.findIndex((n) => n.tag === t) + 1;
const POL = tag('POL');

async function open(page: Page, query = 'scenario=1938&paused=1&seed=1938'): Promise<void> {
  await page.setViewportSize({ width: 1400, height: 800 });
  await page.goto(`/?${query}`);
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null, null, { timeout: 60_000 });
}

/**
 * RGBA of a (2r+1)² box at the screen centre, freshly drawn: the map with the overlay on top
 * (T0 counters and T1 markers are on the overlay since PLAN 2.1/2.2).
 */
const box = (page: Page, r: number): Promise<number[]> =>
  page.evaluate((r) => {
    window.__warsim!.view!.draw();
    const c = document.getElementById('map') as HTMLCanvasElement;
    const o = document.querySelector('canvas.map-nations') as HTMLCanvasElement;
    const out = document.createElement('canvas');
    out.width = c.width;
    out.height = c.height;
    const ctx = out.getContext('2d')!;
    ctx.drawImage(c, 0, 0);
    ctx.drawImage(o, 0, 0, c.width, c.height);
    const n = 2 * r + 1;
    return Array.from(ctx.getImageData(Math.floor(c.width / 2) - r, Math.floor(c.height / 2) - r, n, n).data);
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
  // The camera jump starts a T0 counter split/merge animation (PLAN 2.2): let it finish.
  await page.evaluate(() => window.__warsim!.view!.draw()); // starts it, if the RAF has not yet
  await page.waitForFunction(() => !window.__warsim!.view!.counters.animating(performance.now()));
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

// PLAN 3.12Rh5: in a view 600 px high the panel is taller than its `max-height`: its last rows
// were drawn below its box and "New game" under the war banners.
test('a low view: the settings panel keeps its rows in its box, and "New game" can be reached and pressed', async ({ page }, info) => {
  test.setTimeout(180_000);
  const rect = (testid: string): Promise<{ left: number; right: number; top: number; bottom: number }> =>
    page.evaluate((testid) => {
      const r = document.querySelector(`[data-testid="${testid}"]`)!.getBoundingClientRect();
      return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
    }, testid);
  /** What of a panel's content is below its box and not clipped by it (px). */
  const spilt = (testid: string): Promise<number> =>
    page.evaluate((testid) => {
      const e = document.querySelector(`[data-testid="${testid}"]`)!;
      return getComputedStyle(e).overflowY === 'visible' ? e.scrollHeight - e.clientHeight : 0;
    }, testid);
  const VIEWS = [
    { w: 1100, h: 600, scales: [0.85, 1] },
    { w: 1400, h: 640, scales: [0.85, 1, 1.15, 1.3] },
  ];
  await page.setViewportSize({ width: 1400, height: 640 });
  await page.goto('/?scenario=1938&paused=1&seed=1938');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null, null, { timeout: 60_000 });
  await page.getByTestId('settings-btn').click();
  const start = page.getByTestId('settings-new-game');
  for (const { w, h, scales } of VIEWS) {
    await page.setViewportSize({ width: w, height: h });
    for (const scale of scales) {
      const what = `${w} x ${h} at ${scale}`;
      await page.evaluate((v) => window.__warsim!.settings.setUiScale(v), scale);
      await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).fontSize), what).toBe(`${Math.round(160 * scale) / 10}px`);
      const panel = await rect('settings-panel');
      const bar = await rect('bottombar');
      expect(panel.top, `panel's top, ${what}`).toBeGreaterThanOrEqual(0);
      expect(panel.bottom, `panel above the bar, ${what}`).toBeLessThanOrEqual(bar.top);
      expect(await spilt('settings-panel'), `rows below the panel's box, ${what}`).toBeLessThanOrEqual(0);
      // The banners are above the bar, and the panel's foot is above them.
      const banners = await page.getByTestId('war-banner').count();
      if (banners > 0) expect(panel.bottom, `panel above the banners, ${what}`).toBeLessThanOrEqual((await rect('war-banners')).top);
      await page.screenshot({ path: path.join(info.outputPath(), `h5-settings-${w}-${scale}.png`) });
      // "New game" comes into the panel's box and takes the pointer there.
      await start.scrollIntoViewIfNeeded();
      const btn = await rect('settings-new-game');
      expect(btn.top, `"New game" below the panel's top, ${what}`).toBeGreaterThanOrEqual(panel.top);
      expect(btn.bottom, `"New game" in the panel's box, ${what}`).toBeLessThanOrEqual(panel.bottom);
      await start.hover({ timeout: 5_000 });
      await page.screenshot({ path: path.join(info.outputPath(), `h5-settings-${w}-${scale}-foot.png`) });
      console.log(`settings panel, ${what}: ${(panel.bottom - panel.top).toFixed(1)} px high to ${panel.bottom.toFixed(1)}, ${banners} banners, "New game" to ${btn.bottom.toFixed(1)}`);
    }
  }

  // The panels that share its box, in the lowest view at 100%: nothing below their boxes or the bar.
  await page.evaluate(() => window.__warsim!.settings.setUiScale(1));
  await page.setViewportSize({ width: 1100, height: 600 });
  await page.getByTestId('settings-close').click();
  const inBox = async (testid: string): Promise<void> => {
    await expect(page.getByTestId(testid)).toBeVisible();
    const p = await rect(testid);
    expect(p.top, `${testid}'s top`).toBeGreaterThanOrEqual(0);
    expect(p.bottom, `${testid} above the bar`).toBeLessThanOrEqual((await rect('bottombar')).top);
    expect(await spilt(testid), `${testid}: rows below its box`).toBeLessThanOrEqual(0);
    await page.screenshot({ path: path.join(info.outputPath(), `h5-${testid}-1100.png`) });
    console.log(`${testid} at 1100 x 600: ${p.top.toFixed(1)} to ${p.bottom.toFixed(1)}`);
  };
  // A game some months old: the History panel has more rows than its box, the chart its lines.
  await page.getByTestId('history-btn').click();
  await page.evaluate(() => {
    window.__warsim!.hud.setSpeedLevel(99);
    if (window.__warsim!.hud.paused.value) window.__warsim!.hud.togglePause();
  });
  await expect.poll(() => page.getByTestId('history-row').count(), { timeout: 90_000 }).toBeGreaterThanOrEqual(40);
  // And as many wars as there are banners for: wars forced between nations far from one another's allies.
  const pairs = [['BRA', 'ARG'], ['MEX', 'COL'], ['CHL', 'PER'], ['VEN', 'ECU'], ['TUR', 'GRC'], ['SWE', 'NOR'], ['SIA', 'AFG'], ['BOL', 'PRY']].map(([x, y]) => [tag(x!), tag(y!)] as const);
  await page.evaluate((pairs) => {
    for (const [attacker, defender] of pairs) if (attacker > 0 && defender > 0) window.__warsim!.hud.command({ kind: 'declareWar', attacker, defender });
  }, pairs);
  await expect.poll(() => page.getByTestId('war-banner').count(), { timeout: 30_000 }).toBe(8);
  await page.evaluate(() => {
    if (!window.__warsim!.hud.paused.value) window.__warsim!.hud.togglePause();
    window.__warsim!.hud.setSpeedLevel(4);
  });
  await inBox('history-panel');
  await page.getByTestId('history-close').click();
  if (!(await page.getByTestId('stats-ranking').isVisible())) await page.getByTestId('stats-btn').click();
  await page.getByTestId('ranking-charts').click();
  await expect(page.getByTestId('chart-svg')).toBeVisible();
  await inBox('stats-chart');
  await page.getByTestId('ranking-charts').click();
  await page.getByTestId('editor-btn').click();
  await inBox('editor-panel');
  await page.getByTestId('editor-btn').click();

  // And pressed, with every banner there is room for: the rows of banners reach above the panel's
  // foot, and the panel is drawn over them.
  await page.getByTestId('settings-btn').click();
  await page.getByTestId('settings-seed').fill('4243');
  await start.scrollIntoViewIfNeeded();
  const foot = await rect('settings-panel');
  const rows = await rect('war-banners');
  console.log(`eight banners at 1100 x 600: ${rows.top.toFixed(1)} to ${rows.bottom.toFixed(1)}, the panel's foot at ${foot.bottom.toFixed(1)}`);
  expect(rows.top, 'the banners reach above the foot of the panel').toBeLessThan(foot.bottom);
  await start.hover({ timeout: 5_000 });
  await page.screenshot({ path: path.join(info.outputPath(), 'h5-settings-1100-banners.png') });
  await Promise.all([page.waitForURL(/seed=4243/), start.click()]);
});
