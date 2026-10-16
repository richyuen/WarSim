import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import { NATIONS_1938 } from '../../src/sim/scenario1938';

// PLAN 7.4f2 (the critic's N8, again in the report of 2026-10-07): at a phone's width (390 × 844)
// the panels lay on each other and the bottom bar ran off the view. The top bar, the ranking and
// a nation's panel now stand clear of each other inside the view, and every button of the bottom
// bar can be scrolled to.

const POL = NATIONS_1938.findIndex((n) => n.tag === 'POL') + 1;
type Box = { left: number; top: number; right: number; bottom: number };

const box = (page: Page, testid: string): Promise<Box | null> =>
  page.evaluate((testid) => {
    const el = document.querySelector(`[data-testid="${testid}"]`);
    if (!el || getComputedStyle(el).display === 'none') return null;
    const r = el.getBoundingClientRect();
    return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
  }, testid);
const apart = (a: Box, b: Box): boolean => a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top;
const inside = (a: Box, w: number, h: number): boolean => a.left >= 0 && a.top >= 0 && a.right <= w + 0.5 && a.bottom <= h + 0.5;

test('a phone\'s width: the top bar, the ranking and a nation\'s panel apart and in view; every button of the bar in reach', async ({ page }, info) => {
  test.setTimeout(120_000);
  const [W, H] = [390, 844];
  await page.setViewportSize({ width: W, height: H });
  await page.goto('/?scenario=1938&paused=1&seed=1938');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null, null, { timeout: 60_000 });
  const out = process.env['EVIDENCE'] ? path.resolve(import.meta.dirname, '../../docs/evidence/7.4') : info.outputPath();
  mkdirSync(out, { recursive: true });

  // Nothing open: the top bar and the ranking, apart, in view.
  const top = (await box(page, 'topbar'))!;
  const ranking = (await box(page, 'stats-ranking'))!;
  expect(top, 'the top bar').not.toBeNull();
  expect(ranking, 'the ranking shown').not.toBeNull();
  expect(inside(top, W, H), 'the top bar in view').toBe(true);
  expect(inside(ranking, W, H), 'the ranking in view').toBe(true);
  expect(apart(top, ranking), 'the top bar and the ranking apart').toBe(true);
  await page.screenshot({ path: path.join(out, 'f2-phone-ranking.png') });

  // A nation's panel open: in view, clear of the top bar; the ranking gives way.
  await page.evaluate((p) => window.__warsim!.view!.select(p), POL);
  await expect(page.getByTestId('nation-panel')).toBeVisible();
  const panel = (await box(page, 'nation-panel'))!;
  expect(inside(panel, W, H), 'the panel in view').toBe(true);
  expect(apart(top, panel), 'the top bar and the panel apart').toBe(true);
  expect(await box(page, 'stats-ranking'), 'the ranking gives way').toBeNull();
  await page.screenshot({ path: path.join(out, 'f2-phone-panel.png') });
  await page.evaluate(() => window.__warsim!.view!.select(0));
  await expect(page.getByTestId('stats-ranking')).toBeVisible();

  // The bottom bar in view, and each of its buttons inside it once scrolled to.
  const bar = (await box(page, 'bottombar'))!;
  expect(inside(bar, W, H), 'the bar in view').toBe(true);
  for (const id of ['pause-btn', 'speed-down', 'speed-up', 'mapmode-btn', 'stats-btn', 'history-btn', 'settings-btn', 'editor-btn', 'god-btn', 'date-label']) {
    await page.getByTestId(id).scrollIntoViewIfNeeded();
    const b = (await box(page, id))!;
    const now = (await box(page, 'bottombar'))!;
    expect(b.left >= now.left - 0.5 && b.right <= now.right + 0.5, `${id} inside the bar once scrolled to`).toBe(true);
  }
});
