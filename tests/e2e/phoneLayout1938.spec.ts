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

// The user's choice (2026-10-29, ADR-760): on a phone the news took the map's lower half (the
// ticker's rows, a column of war banners and the legend over each other). At a phone's width the
// ticker is two rows, the war banners one row of two and a "+N" that opens the rest, the legend
// folded to its title top left; none lies on another or on the bar. A desktop's is as it was.
test.describe('the news at a phone\'s width', () => {
  test.use({ hasTouch: true });
  for (const [W, H] of [[390, 844], [844, 390], [1280, 800]] as const) {
    test(`at ${W} × ${H}: the ticker, the war banners and the legend`, async ({ page }) => {
      test.setTimeout(150_000);
      // A phone upright or on its side (the user's report: landscape too).
      const phone = W <= 600 || H <= 500;
      await page.setViewportSize({ width: W, height: H });
      await page.goto('/?scenario=1938&paused=1&seed=1938');
      await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null, null, { timeout: 60_000 });
      const wars = await page.evaluate(async () => {
        const sim = window.__warsim!.sim;
        const ids = window.__warsim!.hud.stats.value!.nations.map((n) => n.id);
        for (let k = 0; k + 1 < 20; k += 2) sim.command({ kind: 'declareWar', attacker: ids[k]!, defender: ids[k + 1]! });
        await sim.step(1);
        return (await sim.inspect()).wars.length;
      });
      expect(wars).toBeGreaterThanOrEqual(8);
      await expect(page.getByTestId('war-banner').first()).toBeVisible();
      await expect.poll(() => page.locator('[data-testid="ticker"] li').count()).toBeGreaterThanOrEqual(2);
      const rows = async (): Promise<number> => page.locator('[data-testid="ticker"] li').count();
      const banners = (): Promise<number> => page.getByTestId('war-banner').count();

      if (!phone) {
        expect(await rows(), 'the desktop ticker is not cut to two').toBeGreaterThan(2);
        expect(await banners()).toBe(6);
        await expect(page.getByTestId('legend-toggle')).toHaveCount(0);
        return;
      }
      expect(await rows(), 'two rows').toBe(2);
      expect(await banners(), 'two banners').toBe(2);
      const more = page.getByTestId('war-more');
      await expect(more).toHaveText(`+${wars - 2}`);
      await expect(page.getByTestId('legend-toggle')).toBeVisible();
      await expect(page.locator('[data-testid="map-legend"] .legend-row')).toHaveCount(0);

      // None on another, nor on the bar; all in view.
      const parts = ['ticker', 'war-banners', 'map-legend', 'bottombar', 'topbar', 'stats-ranking'];
      const boxes = await Promise.all(parts.map((p) => box(page, p)));
      for (let i = 0; i < parts.length; i++) {
        expect(boxes[i], `${parts[i]} shown`).not.toBeNull();
        expect(inside(boxes[i]!, W, H), `${parts[i]} in view`).toBe(true);
        for (let j = i + 1; j < parts.length; j++) expect(apart(boxes[i]!, boxes[j]!), `${parts[i]} and ${parts[j]} apart`).toBe(true);
      }

      // "+N" opens the rest, as many as a desktop shows, and closes them.
      await more.tap();
      expect(await banners()).toBe(6);
      await page.getByTestId('war-more').tap();
      expect(await banners()).toBe(2);
      // A tap on the legend's title opens it.
      await page.getByTestId('legend-toggle').tap();
      expect(await page.locator('[data-testid="map-legend"] .legend-row').count()).toBeGreaterThan(0);
      expect(inside((await box(page, 'map-legend'))!, W, H), 'the opened legend in view').toBe(true);
    });
  }
});

// The user's choice (2026-10-29, ADR-760): on a phone the ranking took a third of the view. It is
// folded to its title, top right, and a tap opens it, in view; a desktop's is open as it was.
test.describe('the ranking at a phone\'s width', () => {
  test.use({ hasTouch: true });
  for (const [W, H] of [[390, 844], [844, 390], [1280, 800]] as const) {
    test(`at ${W} × ${H}: the ranking folded to its title on a phone, open on a desktop`, async ({ page }) => {
      test.setTimeout(120_000);
      await page.setViewportSize({ width: W, height: H });
      await page.goto('/?scenario=1938&paused=1&seed=1938');
      await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null, null, { timeout: 60_000 });
      const rows = page.getByTestId('rank-row');
      if (W > 600 && H > 500) {
        await expect(page.getByTestId('ranking-toggle')).toHaveCount(0);
        await expect(rows).toHaveCount(15);
        return;
      }
      await expect(page.getByTestId('ranking-toggle')).toBeVisible();
      await expect(rows).toHaveCount(0);
      const folded = (await box(page, 'stats-ranking'))!;
      expect(folded.bottom - folded.top, 'a chip, not a list').toBeLessThan(40);
      expect(apart(folded, (await box(page, 'map-legend'))!), 'the ranking and the legend apart').toBe(true);
      await page.getByTestId('ranking-toggle').tap();
      await expect(rows).toHaveCount(15);
      expect(inside((await box(page, 'stats-ranking'))!, W, H), 'the opened ranking in view').toBe(true);
      await rows.nth(1).tap();
      await expect(page.getByTestId('nation-panel')).toBeVisible();
      await page.evaluate(() => window.__warsim!.view!.select(0));
      await page.getByTestId('ranking-toggle').tap();
      await expect(rows).toHaveCount(0);
    });
  }
});

// PLAN 7.169 AT (critic runs 19–21, `c21_p.json`: at 390 × 844 the bar scrolled sideways with Map,
// Statistics, History, Editor and Settings off the view and no sign of them, and God Mode's tools
// were cut to "Revol", "Spawn na", "Breakthr"): on a phone, upright and on its side, every button
// of the bar and every God tool is inside the view, is what is under its own centre, shows its
// label whole, and a tap opens or arms it. No scrolling.
test.describe('a phone, by touch', () => {
  test.use({ hasTouch: true });
  for (const [W, H] of [
    [390, 844],
    [844, 390],
  ] as const) {
    test(`at ${W} × ${H}: every tab of the bar and every God tool whole, in view and tapped`, async ({ page }, info) => {
      test.setTimeout(120_000);
      await page.setViewportSize({ width: W, height: H });
      await page.goto('/?scenario=1938&paused=1&seed=1938');
      await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null, null, { timeout: 60_000 });
      await page.getByTestId('god-btn').tap();
      const tools = ['revolt', 'nation', 'battle', 'brush', 'nuke', 'city', 'raze'].map((k) => `god-tool-${k}`);
      const tabs = ['pause-btn', 'speed-down', 'speed-up', 'god-btn', 'mapmode-btn', 'stats-btn', 'history-btn', 'editor-btn', 'settings-btn'];
      const look = () => page.evaluate((ids) => {
        return ids.map((id) => {
          const el = document.querySelector<HTMLElement>(`[data-testid="${id}"]`)!;
          const r = el.getBoundingClientRect();
          const at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          const cut = [el, ...el.querySelectorAll<HTMLElement>('*')].some((x) => x.scrollWidth > x.clientWidth + 1);
          return { id, inView: r.left >= 0 && r.top >= 0 && r.right <= innerWidth + 0.5 && r.bottom <= innerHeight + 0.5, hit: at !== null && (at === el || el.contains(at)), cut };
        });
      }, [...tabs, ...tools]);
      // The bar grows a row for the tools; the panels above it move up with its top on the next frame.
      const whole = async () => (await look()).filter((x) => !x.inView || !x.hit || x.cut).map((x) => x.id);
      await expect.poll(whole, { timeout: 5_000 }).toEqual([]);
      const seen = await look();
      const out = process.env['EVIDENCE'] ? path.resolve(import.meta.dirname, '../../docs/evidence/7.169') : info.outputPath();
      mkdirSync(out, { recursive: true });
      await page.screenshot({ path: path.join(out, `phone-bar-${W}x${H}.png`) });
      for (const s of seen) expect(s, s.id).toEqual({ id: s.id, inView: true, hit: true, cut: false });
      expect(await page.evaluate(() => { const b = document.querySelector('[data-testid=bottombar]')!; return b.scrollWidth <= b.clientWidth; }), 'the bar does not scroll').toBe(true);

      // Statistics shows the ranking or hides it.
      const ranking = page.getByTestId('stats-ranking');
      const shown = await ranking.count();
      await page.getByTestId('stats-btn').tap();
      await expect(ranking).toHaveCount(1 - shown);
      await page.getByTestId('stats-btn').tap();
      await expect(ranking).toHaveCount(shown);
      // A tap on each other tab opens what it names, and again closes it.
      for (const [id, opens] of [
        ['mapmode-btn', 'mapmode-menu'],
        ['history-btn', 'history-panel'],
        ['editor-btn', 'editor-panel'],
        ['settings-btn', 'settings-menu'],
      ] as const) {
        await page.getByTestId(id).tap();
        await expect(page.getByTestId(opens), id).toBeVisible();
        await page.getByTestId(id).tap();
        await expect(page.getByTestId(opens), id).toHaveCount(0);
      }
      // A tap on each God tool arms it, and again disarms it.
      for (const id of tools) {
        await page.getByTestId(id).tap();
        await expect(page.getByTestId(id), id).toHaveAttribute('aria-pressed', 'true');
        await page.getByTestId(id).tap();
        await expect(page.getByTestId(id), id).toHaveAttribute('aria-pressed', 'false');
      }
    });
  }
});
