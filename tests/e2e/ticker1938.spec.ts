import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import { EventKind } from '../../src/shared/events';
import { TICKER_HOURS, TICKER_KINDS, TICKER_ROWS } from '../../src/shared/history';
import { NATIONS_1938 } from '../../src/sim/scenario1938';

// PLAN 3.12c AT (critic R3-B6): a war declared by God Mode appears in the ticker as it happens,
// and a click on its row moves the camera to the capital of the nation it was declared on.

const id = (tag: string): number => NATIONS_1938.findIndex((n) => n.tag === tag) + 1;

test('the ticker: a God Mode war is told at once, and its row flies the camera there', async ({ page }, info) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1400, height: 800 });
  await page.goto('/?scenario=1938&paused=1&seed=1938');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null, null, { timeout: 60_000 });
  await page.waitForFunction(() => window.__warsim!.sim.mapLayers !== null, null, { timeout: 60_000 });
  const [GER, POL] = [id('GER'), id('POL')];

  // A live region with no row: nothing has happened yet.
  const ticker = page.getByTestId('ticker');
  await expect(ticker).toHaveAttribute('role', 'log');
  await expect(ticker).toHaveAttribute('aria-live', 'polite');
  await expect(page.getByTestId('ticker-row')).toHaveCount(0);

  // War on Poland from the God tab, the game paused.
  await page.getByTestId('god-btn').click();
  await page.evaluate((n) => window.__warsim!.hud.onSelectNation(n), GER);
  await expect(page.getByTestId('nation-panel')).toHaveAttribute('data-nation', String(GER));
  await page.getByTestId('tab-god').click();
  await page.getByTestId('god-target').selectOption(String(POL));
  await page.getByTestId('god-war').click();
  const row = page.getByTestId('ticker-row');
  await expect(row).toHaveCount(1);
  await expect(row).toHaveAttribute('data-kind', String(EventKind.WarDeclared));
  await expect(row).toHaveText(/^1 January 1938\s+Germany declared war on Poland$/);

  // The row's place is Poland's capital: the camera is not there, and flies there on a click.
  const warsaw = await page.evaluate(async (pol) => (await window.__warsim!.sim.inspect(true)).cities.find((c) => c.capitalOf === pol)!, POL);
  const from = await page.evaluate(() => ({ ...window.__warsim!.view!.controller.cam }));
  expect(Math.hypot(from.cx - warsaw.x, from.cy - warsaw.y)).toBeGreaterThan(1);
  const ev = process.env['EVIDENCE'] ? path.resolve(import.meta.dirname, '../../docs/evidence/3.12') : info.outputPath();
  mkdirSync(ev, { recursive: true });
  await page.screenshot({ path: path.join(ev, 'c-ticker-war.png') });
  await row.click();
  // The flight can be over before the wait for it begins: it is known by where the camera is.
  const to = await page.evaluate(async (from) => {
    const c = window.__warsim!.view!.controller;
    const asked = performance.now();
    while (!c.animating && c.cam.cx === from.cx && c.cam.cy === from.cy && c.cam.scale === from.scale) {
      if (performance.now() - asked > 20_000) throw new Error('no flight began');
      await new Promise((done) => setTimeout(done, 1));
    }
    while (c.animating) await new Promise((done) => requestAnimationFrame(done));
    return { ...c.cam, kmAcross: (window.__warsim!.view!.metresPerPx * window.innerWidth) / 1000 };
  }, from);
  expect(to.cx).toBeCloseTo(warsaw.x, 3);
  expect(to.cy).toBeCloseTo(warsaw.y, 3);
  // A country and its neighbours across the view.
  expect(to.kmAcross).toBeCloseTo(1500, 0);
  await page.evaluate(() => window.__warsim!.view!.draw(performance.now()));
  await page.screenshot({ path: path.join(ev, 'c-ticker-flown.png') });

  // The peace is told below the war: the newest row is the last.
  const war = (await page.evaluate(() => window.__warsim!.sim.inspect())).wars.find((w) => w.attackers.includes(GER) && w.defenders.includes(POL))!;
  await page.getByTestId(`god-peace-${war.id}`).click();
  await expect(row).toHaveCount(2);
  await expect(row.nth(0)).toHaveText(/Germany declared war on Poland$/);
  await expect(row.nth(1)).toHaveAttribute('data-kind', String(EventKind.PeaceSigned));
  await expect(row.nth(1)).toHaveText(/made peace with/);
  for (const t of await row.allInnerTexts()) expect(t).not.toMatch(/#\d/);

  // Three months of the world's own events: the ticker has the last major rows of the log, no
  // more than TICKER_ROWS and none older than TICKER_HOURS, each with a place on the map.
  await page.evaluate(() => window.__warsim!.sim.step(24 * 90));
  const log = await page.evaluate(() => window.__warsim!.sim.history());
  const now = await page.evaluate(() => window.__warsim!.sim.inspect().then((s) => s.tick));
  const major = log.filter((r) => TICKER_KINDS.has(r.kind) && now - r.tick <= TICKER_HOURS);
  expect(major.length).toBeGreaterThan(0);
  await expect.poll(() => page.evaluate(() => window.__warsim!.hud.stats.value!.tick)).toBe(now);
  const shown = await page.evaluate(() => window.__warsim!.hud.stats.value!.ticker);
  expect(shown.length).toBeGreaterThan(0);
  expect(shown.length).toBeLessThanOrEqual(TICKER_ROWS);
  const geo = await page.evaluate(() => window.__warsim!.sim.mapLayers!.terrain);
  for (const r of shown) {
    expect(major.some((m) => m.tick === r.tick && m.kind === r.kind && m.a === r.a && m.b === r.b), JSON.stringify(r)).toBe(true);
    expect(r.x >= 0 && r.x < geo.w && r.y >= 0 && r.y < geo.h, JSON.stringify(r)).toBe(true);
  }
  expect(shown.at(-1)!.tick).toBe(major.at(-1)!.tick);
  // Under a panel the last two only; with the panel closed, all of them.
  await expect(row).toHaveCount(Math.min(2, shown.length));
  await page.screenshot({ path: path.join(ev, 'c-ticker-under-panel.png') });
  await page.evaluate(() => window.__warsim!.hud.onSelectNation(0));
  await expect(page.getByTestId('nation-panel')).toHaveCount(0);
  await expect(row).toHaveCount(shown.length);
  await page.screenshot({ path: path.join(ev, 'c-ticker-rows.png') });
  console.log(`ticker: ${(await row.allInnerTexts()).map((t) => t.replace(/\s+/g, ' ')).join(' | ')}`);
});

// PLAN 3.12Rh: the ticker's room at every UI size. Beside a panel at its full height a row of
// long names (three lines in full) is two lines and stands below the panel; the war banners, as wide as they get,
// begin to the right of the ticker.
test('the ticker keeps its room beside a panel at its full height and the war banners, at every UI size', async ({ page }, info) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1400, height: 640 });
  await page.goto('/?scenario=1938&paused=1&seed=1938');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null, null, { timeout: 60_000 });
  const [GER, POL, SWE, NOR] = [id('GER'), id('POL'), id('SWE'), id('NOR')];

  // Wars enough for the banners to fill their width, the last two of long names.
  const wars = await page.evaluate(
    async ({ GER, POL, SWE, NOR }) => {
      const sim = window.__warsim!.sim;
      sim.command({ kind: 'renameNation', nation: GER, name: 'The United Provinces of Central Europe' });
      sim.command({ kind: 'renameNation', nation: SWE, name: 'The Kingdoms of the Northern Mountains' });
      sim.command({ kind: 'renameNation', nation: POL, name: 'The Commonwealth of Vistula and Baltic' });
      sim.command({ kind: 'renameNation', nation: NOR, name: 'The Free Towns of the Western Fjords' });
      const ids = window.__warsim!.hud.stats.value!.nations.map((n) => n.id).filter((n) => ![GER, POL, SWE, NOR].includes(n));
      for (let k = 0; k + 1 < 40; k += 2) sim.command({ kind: 'declareWar', attacker: ids[k]!, defender: ids[k + 1]! });
      sim.command({ kind: 'declareWar', attacker: GER, defender: POL });
      sim.command({ kind: 'declareWar', attacker: SWE, defender: NOR });
      await sim.step(1);
      return (await sim.inspect()).wars.length;
    },
    { GER, POL, SWE, NOR },
  );
  expect(wars).toBeGreaterThanOrEqual(8);
  await page.getByTestId('god-btn').click();
  const row = page.getByTestId('ticker-row');
  const box = (testid: string): Promise<{ left: number; right: number; top: number; bottom: number }> =>
    page.evaluate((testid) => {
      const r = document.querySelector(`[data-testid="${testid}"]`)!.getBoundingClientRect();
      return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
    }, testid);
  const ev = process.env['EVIDENCE'] ? path.resolve(import.meta.dirname, '../../docs/evidence/3.12') : info.outputPath();
  mkdirSync(ev, { recursive: true });

  for (const scale of [1, 1.15, 1.3]) {
    await page.evaluate((v) => window.__warsim!.settings.setUiScale(v), scale);
    const rem = 16 * scale;
    await page.evaluate((n) => window.__warsim!.hud.onSelectNation(n), GER);
    await page.getByTestId('tab-god').click();
    await expect(row).toHaveCount(2);
    await expect(row.nth(0)).toHaveText(/The United Provinces of Central Europe declared war on The Commonwealth of Vistula and Baltic$/);
    await expect(row.nth(1)).toHaveText(/The Kingdoms of the Northern Mountains declared war on The Free Towns of the Western Fjords$/);
    // The panel is at its full height, and the ticker below it.
    const panel = await box('nation-panel');
    expect(panel.bottom - panel.top, `panel at ${scale}`).toBeGreaterThan(640 - 12.5 * rem);
    const short = await box('ticker');
    expect(short.top, `ticker below the panel at ${scale}`).toBeGreaterThanOrEqual(panel.bottom - 0.5);
    // The banners fill their width and begin right of the ticker.
    const banners = await box('war-banners');
    expect(banners.left, `banners right of the ticker at ${scale}`).toBeGreaterThanOrEqual(short.right);
    // And right of the panel, which is wider than the ticker by its padding (PLAN 3.12Rh4).
    expect(banners.left, `banners right of the panel at ${scale}`).toBeGreaterThanOrEqual(panel.right);
    await page.screenshot({ path: path.join(ev, `h-ticker-room-${scale}.png`) });
    // With no panel every row is told in full, and the banners are right of them still.
    await page.evaluate(() => window.__warsim!.hud.onSelectNation(0));
    await expect(page.getByTestId('nation-panel')).toHaveCount(0);
    await expect(row).toHaveCount(TICKER_ROWS);
    expect((await box('war-banners')).left, `banners right of five rows at ${scale}`).toBeGreaterThanOrEqual((await box('ticker')).right);
  }
  await page.evaluate(() => window.__warsim!.settings.setUiScale(1));
});

// PLAN 3.12Rh1: the bottom bar is one line with the longest date and "Paused" (it was two, and
// its top inside the ticker's last row), and as wide paused as running: no button steps.
test('the bottom bar is one line under the ticker, and no button steps at a pause, at every UI size', async ({ page }, info) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1400, height: 800 });
  await page.goto('/?scenario=1938&paused=1&seed=1938');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null, null, { timeout: 60_000 });
  const box = (testid: string): Promise<{ left: number; right: number; top: number; bottom: number }> =>
    page.evaluate((testid) => {
      const r = document.querySelector(`[data-testid="${testid}"]`)!.getBoundingClientRect();
      return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
    }, testid);
  const date = page.getByTestId('date-label');
  await expect(date).toHaveText('1 January 1938 · Paused');
  const short: Record<number, { left: number; right: number; top: number; bottom: number }> = {};
  for (const scale of [1, 1.15, 1.3]) {
    await page.evaluate((v) => window.__warsim!.settings.setUiScale(v), scale);
    short[scale] = await box('bottombar');
  }
  // The longest month, a day of two digits.
  await page.evaluate(() => window.__warsim!.sim.step(24 * 272));
  await expect(date).toHaveText('30 September 1938 · Paused', { timeout: 120_000 });
  const ev = process.env['EVIDENCE'] ? path.resolve(import.meta.dirname, '../../docs/evidence/3.12') : info.outputPath();
  mkdirSync(ev, { recursive: true });

  for (const scale of [1, 1.15, 1.3]) {
    await page.evaluate((v) => window.__warsim!.settings.setUiScale(v), scale);
    const paused = { bar: await box('bottombar'), pause: await box('pause-btn'), speed: await box('speed-up'), date: await box('date-label') };
    // One line, as the short date's bar is, and no wider or narrower than it.
    expect(paused.bar.bottom - paused.bar.top, `bar height paused at ${scale}`).toBeCloseTo(short[scale]!.bottom - short[scale]!.top, 1);
    expect(paused.bar.left, `bar left with the long date at ${scale}`).toBeCloseTo(short[scale]!.left, 1);
    expect(paused.bar.right, `bar right with the long date at ${scale}`).toBeCloseTo(short[scale]!.right, 1);
    // The ticker's foot (and the banners', at the same height) is above the bar.
    expect((await box('ticker')).bottom, `ticker above the bar at ${scale}`).toBeLessThanOrEqual(paused.bar.top + 0.5);
    await page.screenshot({ path: path.join(ev, `h1-bar-paused-${scale}.png`) });
    console.log(`bar at ${scale}: ${(paused.bar.right - paused.bar.left).toFixed(1)} x ${(paused.bar.bottom - paused.bar.top).toFixed(1)} px, its top ${(paused.bar.top - (await box('ticker')).bottom).toFixed(1)} px below the ticker`);

    // Resumed: the same bar, every button where it was.
    await page.getByTestId('pause-btn').click();
    await expect(page.getByTestId('pause-btn')).toHaveAttribute('aria-pressed', 'false');
    await expect(date).not.toContainText('Paused');
    const running = { bar: await box('bottombar'), pause: await box('pause-btn'), speed: await box('speed-up'), date: await box('date-label') };
    await page.getByTestId('pause-btn').click();
    await expect(page.getByTestId('pause-btn')).toHaveAttribute('aria-pressed', 'true');
    await expect(date).toContainText('Paused');
    expect(running.bar.bottom - running.bar.top, `bar height running at ${scale}`).toBeCloseTo(paused.bar.bottom - paused.bar.top, 1);
    expect(running.bar.left, `bar left running at ${scale}`).toBeCloseTo(paused.bar.left, 1);
    expect(running.pause.right, `pause button's right running at ${scale}`).toBeCloseTo(paused.pause.right, 1);
    expect(running.speed.left, `speed button running at ${scale}`).toBeCloseTo(paused.speed.left, 1);
    expect(running.date.left, `date running at ${scale}`).toBeCloseTo(paused.date.left, 1);
  }
  await page.evaluate(() => window.__warsim!.settings.setUiScale(1));
});

// PLAN 3.12Rh4: a view 1,100 px wide is narrower than the bar at 115 and 130% (1,135 and
// 1,281 px). A size the view is too narrow for is not offered and not applied; the choice is kept.
test('a view 1,100 px wide: the bar is inside the view at every UI size offered there, and a wider size is not', async ({ page }, info) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1100, height: 600 });
  await page.goto('/?scenario=1938&paused=1&seed=1938');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null, null, { timeout: 60_000 });
  const box = (testid: string): Promise<{ left: number; right: number; top: number; bottom: number }> =>
    page.evaluate((testid) => {
      const r = document.querySelector(`[data-testid="${testid}"]`)!.getBoundingClientRect();
      return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
    }, testid);
  const rootPx = (): Promise<string> => page.evaluate(() => getComputedStyle(document.documentElement).fontSize);
  const BUTTONS = ['pause-btn', 'speed-down', 'speed-up', 'mapmode-btn', 'stats-btn', 'history-btn', 'settings-btn', 'editor-btn', 'god-btn', 'date-label'];
  const MODES = 8;
  const ev = process.env['EVIDENCE'] ? path.resolve(import.meta.dirname, '../../docs/evidence/3.12') : info.outputPath();
  mkdirSync(ev, { recursive: true });
  /** The bar and each of its buttons inside the view, in every map mode (the mode's name is the one label with no room kept). */
  const barInView = async (what: string, width: number): Promise<number> => {
    let widest = 0;
    for (let m = 0; m < MODES; m++) {
      const bar = await box('bottombar');
      widest = Math.max(widest, bar.right - bar.left);
      for (const b of BUTTONS) {
        const r = await box(b);
        expect(r.left, `${b} left, ${what}, mode ${m}`).toBeGreaterThanOrEqual(0);
        expect(r.right, `${b} right, ${what}, mode ${m}`).toBeLessThanOrEqual(width);
        // And as wide as its text: no button is pressed narrower than its label.
        const cut = await page.evaluate((b) => {
          const e = document.querySelector(`[data-testid="${b}"]`)!;
          return e.scrollWidth - e.clientWidth;
        }, b);
        expect(cut, `${b} holds its text, ${what}, mode ${m}`).toBeLessThanOrEqual(0);
      }
      expect(bar.left, `bar left, ${what}, mode ${m}`).toBeGreaterThanOrEqual(0);
      expect(bar.right, `bar right, ${what}, mode ${m}`).toBeLessThanOrEqual(width);
      await page.getByTestId('mapmode-btn').click();
    }
    return widest;
  };

  // 85 and 100% are laid out for 1,100 px; 115 and 130% are not, and the size stays 100%.
  for (const [scale, px] of [[0.85, '13.6px'], [1, '16px'], [1.15, '16px'], [1.3, '16px']] as const) {
    await page.evaluate((v) => window.__warsim!.settings.setUiScale(v), scale);
    expect(await rootPx(), `root font at ${scale}`).toBe(px);
    const widest = await barInView(`at ${scale}`, 1100);
    console.log(`bar at ${scale} in 1,100 px: root ${px}, ${widest.toFixed(1)} px at its widest mode`);
    await page.screenshot({ path: path.join(ev, `h4-bar-1100-${scale}.png`) });
  }

  // The settings panel offers what fits and shows the size in use; the choice of 130% is kept.
  await page.getByTestId('settings-btn').click();
  const select = page.getByTestId('settings-ui-scale');
  await expect(select).toHaveValue('1');
  expect(await select.locator('option').evaluateAll((os) => os.map((o) => `${(o as HTMLOptionElement).value}:${(o as HTMLOptionElement).disabled}`))).toEqual(['0.85:false', '1:false', '1.15:true', '1.3:true']);
  await page.screenshot({ path: path.join(ev, 'h4-settings-1100.png') });

  // A wider window has the size chosen, a narrower one loses it again: nothing is pressed.
  await page.setViewportSize({ width: 1400, height: 800 });
  await expect.poll(rootPx).toBe('20.8px');
  await expect(select).toHaveValue('1.3');
  expect(await select.locator('option').evaluateAll((os) => os.filter((o) => (o as HTMLOptionElement).disabled).length)).toBe(0);
  await page.setViewportSize({ width: 1200, height: 700 });
  await expect.poll(rootPx).toBe('18.4px');
  await page.getByTestId('settings-close').click();
  await barInView('at 115% in 1,200 px', 1200);
  await page.setViewportSize({ width: 1100, height: 600 });
  await expect.poll(rootPx).toBe('16px');

  // The History panel is right of a nation's panel (at 130% it stood over its right 79 px).
  await page.evaluate((n) => window.__warsim!.view!.select(n), id('ENG'));
  await page.getByTestId('history-btn').click();
  expect((await box('history-panel')).left, 'history right of the nation panel').toBeGreaterThanOrEqual((await box('nation-panel')).right);
  await page.screenshot({ path: path.join(ev, 'h4-panels-1100.png') });
  await page.getByTestId('history-btn').click();

  // A played nation's label is the one item that gives way: the buttons stay in the view.
  await page.getByTestId('take-control').click();
  await expect(page.getByTestId('player-label')).toContainText('United Kingdom');
  await page.evaluate(() => window.__warsim!.hud.onSelectNation(0));
  await barInView('playing', 1100);
  const label = await box('player-label');
  expect(label.right - label.left, 'the played label has room').toBeGreaterThan(40);
  await page.screenshot({ path: path.join(ev, 'h4-bar-1100-playing.png') });
  await page.evaluate(() => window.__warsim!.settings.setUiScale(1));
});
