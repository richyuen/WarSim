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
    await page.screenshot({ path: path.join(ev, `h-ticker-room-${scale}.png`) });
    // With no panel every row is told in full, and the banners are right of them still.
    await page.evaluate(() => window.__warsim!.hud.onSelectNation(0));
    await expect(page.getByTestId('nation-panel')).toHaveCount(0);
    await expect(row).toHaveCount(TICKER_ROWS);
    expect((await box('war-banners')).left, `banners right of five rows at ${scale}`).toBeGreaterThanOrEqual((await box('ticker')).right);
  }
  await page.evaluate(() => window.__warsim!.settings.setUiScale(1));
});
