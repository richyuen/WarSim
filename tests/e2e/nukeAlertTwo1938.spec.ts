import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import { EventKind } from '../../src/shared/events';
import { cellOf } from '../../src/sim/data/terrain';
import { NATIONS_1938, SIZE_1938, TEMPLATES_LAND } from '../../src/sim/scenario1938';

// PLAN 7.109a (the critic's run 13: of two AI strikes a day apart only the second got a banner, and
// at Max the pause came 155 game hours after the first). The scene (seed 1, 1 January 1938), set by
// commands as in `nukeDemo1938.spec.ts`: Germany at war with France and with Poland, both fighting
// to the death with German divisions before their capitals, each given a warhead and missiles.
// Poland strikes in the first hour of 2 January, France a day later. At Max with the pause on, the
// game stops within 24 game hours of each strike; with it off, both strikes have a banner each.

const { w: W, h: H } = SIZE_1938;
const id = (tag: string): number => NATIONS_1938.findIndex((n) => n.tag === tag) + 1;
const [FRA, GER, POL] = [id('FRA'), id('GER'), id('POL')];
const reims = cellOf(4.03, 49.26, W, H);
const warsaw = cellOf(20.6, 52.3, W, H);
const infantry = TEMPLATES_LAND.findIndex((t) => t.id === 'infantry_div');
// The striker's name; its target is Germany or, as it falls, an ally of Germany's at war (France's
// strike in the page falls on an Italian army near Turin).
const STRIKE_BANNER = /^(Poland|France) struck [A-Z][a-z]+ with an atomic bomb/;

async function scene(page: Page, nukePause: boolean): Promise<void> {
  await page.setViewportSize({ width: 1400, height: 800 });
  await page.addInitScript((v) => localStorage.setItem('warsim.nukePause', v ? '1' : '0'), nukePause);
  await page.goto('/?scenario=1938&paused=1&seed=1');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null, null, { timeout: 60_000 });
  expect(await page.evaluate(() => window.__warsim!.settings.nukePause.value)).toBe(nukePause);
  await page.evaluate(
    async ({ FRA, GER, POL, reims, warsaw, infantry }) => {
      const s = window.__warsim!.sim;
      s.command({ kind: 'setSetting', key: 'nukesEnabled', value: true });
      for (const [nation, at] of [
        [FRA, reims],
        [POL, warsaw],
      ] as const) {
        s.command({ kind: 'grantWarheads', nation, count: 1 });
        s.command({ kind: 'grantTech', nation, tech: 'ballistic_missiles' });
        s.command({ kind: 'declareWar', attacker: GER, defender: nation });
        for (let k = 0; k < 6; k++) s.command({ kind: 'spawnFormation', nation: GER, x: at[0] + (k % 3) * 0.4, y: at[1] + Math.floor(k / 3) * 0.4, strength: 0, template: infantry });
      }
      await s.step(1);
      for (const w of (await s.inspect()).wars) if (w.attackers.includes(GER)) s.command({ kind: 'setWarFightToDeath', war: w.id, side: 1, value: true });
      await s.step(1);
    },
    { FRA, GER, POL, reims, warsaw, infantry },
  );
  // Max speed.
  await page.evaluate(() => window.__warsim!.hud.setSpeedLevel(99));
  expect(await page.evaluate(() => window.__warsim!.hud.speedLevel.value)).toBeGreaterThan(0);
}

/** The ticks of the strikes in the log. */
async function strikes(page: Page): Promise<number[]> {
  const rows = await page.evaluate(() => window.__warsim!.sim.history());
  return rows.filter((r) => r.kind === EventKind.NukeCasualties).map((r) => r.tick);
}

/** Runs until the worker pauses; its tick then. */
async function runToPause(page: Page): Promise<number> {
  await page.evaluate(() => window.__warsim!.hud.togglePause());
  await page.waitForFunction(() => window.__warsim!.hud.worker.value?.paused === false, null, { timeout: 30_000 });
  await page.waitForFunction(() => window.__warsim!.hud.paused.value && window.__warsim!.hud.worker.value?.paused === true, null, { timeout: 60_000 });
  await page.waitForTimeout(300);
  return page.evaluate(() => window.__warsim!.hud.tick.value);
}

test('at Max with the pause on, the game stops within a day of each AI strike, and each has its banner', async ({ page }, info) => {
  test.setTimeout(240_000);
  const out = process.env['EVIDENCE'] ? path.resolve(import.meta.dirname, '../../docs/evidence/7.109') : info.outputPath();
  mkdirSync(out, { recursive: true });
  await scene(page, true);

  const first = await runToPause(page);
  const [s1] = await strikes(page);
  expect(s1, 'a strike before the pause').toBeDefined();
  expect(first - s1!, `paused at tick ${first}, the strike at ${s1}`).toBeLessThanOrEqual(24);
  await expect(page.getByTestId('nuke-alert')).toHaveCount(1);

  const second = await runToPause(page);
  const all = await strikes(page);
  expect(all, 'two strikes').toHaveLength(2);
  expect(all[1]! - all[0]!, 'a day apart at most').toBeLessThanOrEqual(24);
  expect(second - all[1]!, `paused at tick ${second}, the strike at ${all[1]}`).toBeLessThanOrEqual(24);
  await expect(page.getByTestId('nuke-alert')).toHaveCount(2);
  await expect(page.getByTestId('nuke-alert-text').nth(0)).toHaveText(STRIKE_BANNER);
  await expect(page.getByTestId('nuke-alert-text').nth(1)).toHaveText(STRIKE_BANNER);
  await page.screenshot({ path: path.join(out, 'a-two-alerts-paused.png') });
});

test('at Max with the pause off, two AI strikes a day apart have a banner each', async ({ page }, info) => {
  test.setTimeout(240_000);
  const out = process.env['EVIDENCE'] ? path.resolve(import.meta.dirname, '../../docs/evidence/7.109') : info.outputPath();
  mkdirSync(out, { recursive: true });
  await scene(page, false);
  await page.evaluate(() => window.__warsim!.hud.togglePause());
  await page.waitForFunction(() => window.__warsim!.hud.tick.value > 24 * 4, null, { timeout: 60_000 });
  expect(await page.evaluate(() => window.__warsim!.hud.paused.value), 'the game runs on').toBe(false);
  const all = await strikes(page);
  expect(all, 'two strikes').toHaveLength(2);
  await expect(page.getByTestId('nuke-alert')).toHaveCount(2);
  const texts = await page.getByTestId('nuke-alert-text').allTextContents();
  expect(texts.map((t) => t.match(STRIKE_BANNER)?.[1]).sort()).toEqual(['France', 'Poland']);
  await page.screenshot({ path: path.join(out, 'a-two-alerts-running.png') });
});
