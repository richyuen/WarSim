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

// PLAN 7.159 (critic run 19, R19-B1): the map button's menu was drawn inside the bottom bar, which
// scrolls sideways on a phone, and so was cut off by it: no option could be tapped. Each option
// must be what a tap at its centre hits, inside the view, at a phone's width and a desktop's.
test.describe('the map-mode menu', () => {
  test.use({ hasTouch: true });
  for (const [W, H] of [[390, 844], [1280, 800]] as const) {
    test(`at ${W} × ${H} every option of the map-mode menu is in view and a tap picks it`, async ({ page }, info) => {
      test.setTimeout(120_000);
      await page.setViewportSize({ width: W, height: H });
      await page.goto('/?scenario=1938&paused=1&seed=1938');
      await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0, null, { timeout: 60_000 });
      const btn = page.getByTestId('mapmode-btn');
      await btn.scrollIntoViewIfNeeded();
      await btn.tap();
      await expect(page.getByTestId('mapmode-menu')).toBeVisible();
      const hits = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>('[data-testid="mapmode-menu"] [role="menuitemradio"]')].map((opt) => {
          const r = opt.getBoundingClientRect();
          const at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          const inView = r.left >= 0 && r.top >= 0 && r.right <= innerWidth + 0.5 && r.bottom <= innerHeight + 0.5;
          return { id: opt.dataset['testid'], hit: at !== null && opt.contains(at), inView };
        }),
      );
      expect(hits.length, 'every map mode listed').toBe(11);
      expect(hits.filter((h) => !h.hit || !h.inView), 'options in view and hit-testable').toEqual([]);
      await page.screenshot({ path: info.outputPath(`mapmode-menu-${W}.png`) });
      await page.getByTestId('mapmode-opt-terrain').tap({ timeout: 5_000 });
      await expect(btn).toHaveAttribute('data-mode', 'terrain');
      await expect(page.getByTestId('mapmode-menu')).toHaveCount(0);
    });
  }
});

// The user's report (2026-10-29): on mobile Safari a touch-drag selected the whole game. The page
// is not selectable outside a text field (Safari's prefixed property too), and a finger's move on
// the map is not the page's.
test('the game is not text a touch selects; a text field still is', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?scenario=1938&paused=1&seed=1938');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0, null, { timeout: 60_000 });
  const got = await page.evaluate(() => {
    const css = (el: Element, p: string): string => getComputedStyle(el).getPropertyValue(p);
    const select = (el: Node): boolean => !el.dispatchEvent(new Event('selectstart', { bubbles: true, cancelable: true }));
    const map = document.getElementById('map')!;
    const label = document.querySelector('[data-testid="date-label"]')!;
    const field = document.createElement('textarea');
    field.value = 'text';
    document.getElementById('ui')!.append(field);
    const move = new TouchEvent('touchmove', { bubbles: true, cancelable: true });
    map.dispatchEvent(move);
    const out = {
      body: [css(document.body, 'user-select'), css(document.body, '-webkit-user-select')],
      field: css(field, 'user-select'),
      blockedOnMap: select(map),
      blockedOnLabel: select(label.firstChild ?? label),
      blockedInField: select(field.firstChild ?? field),
      touchmoveKept: move.defaultPrevented,
    };
    field.remove();
    return out;
  });
  expect(got).toEqual({ body: ['none', 'none'], field: 'text', blockedOnMap: true, blockedOnLabel: true, blockedInField: false, touchmoveKept: true });
});

// The user's request (2026-10-29): a way out of a selection or an armed tool on a touch screen,
// which has no Escape. A Cancel button stands first in the bar while there is one, and a tap
// ends it.
test.describe('the Cancel button', () => {
  test.use({ hasTouch: true });
  test('cancels a selection and an armed God tool on a phone, and is gone with nothing to cancel', async ({ page }) => {
    test.setTimeout(150_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/?scenario=1938&paused=1&seed=1938');
    await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null, null, { timeout: 60_000 });
    await page.waitForFunction((p) => window.__warsim!.view!.formationsOf(p).length > 3, POL, { timeout: 60_000 });
    const cancel = page.getByTestId('cancel-btn');
    await expect(cancel).toHaveCount(0);

    // A selection of the played nation's formations: the button, in view at the bar's start.
    await page.evaluate((p) => window.__warsim!.view!.select(p), POL);
    await page.getByTestId('take-control').tap();
    await expect(page.getByTestId('release-control')).toBeVisible();
    await page.evaluate(() => window.__warsim!.player!.selectAll());
    await expect(page.getByTestId('player-label')).not.toContainText(' 0 selected');
    expect(await page.evaluate(() => window.__warsim!.player!.selectedCount.value)).toBeGreaterThan(0);
    await expect(cancel).toBeVisible();
    const [b, bar] = [(await box(page, 'cancel-btn'))!, (await box(page, 'bottombar'))!];
    expect(b.left >= bar.left && b.right <= bar.right, 'the button in view in the bar').toBe(true);
    await cancel.tap();
    expect(await page.evaluate(() => window.__warsim!.player!.selectedCount.value)).toBe(0);
    await expect(cancel).toHaveCount(0);

    // An armed God tool.
    await page.evaluate(() => {
      const h = window.__warsim!.hud;
      if (!h.godMode.value) h.toggleGod();
      h.setGodTool('revolt');
    });
    await expect(cancel).toBeVisible();
    await cancel.tap();
    expect(await page.evaluate(() => window.__warsim!.hud.godTool.value)).toBeNull();
    await expect(cancel).toHaveCount(0);
  });
});
