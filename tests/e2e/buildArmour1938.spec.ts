import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import type { Inspection } from '../../src/shared/protocol';
import { NATIONS_1938 } from '../../src/sim/scenario1938';

// PLAN 7.4f33 (the critic of 2026-10-07: "a player building an armoured division" was not tested;
// a step of its own script failed on a selector). As Germany, which knows the medium tank, the
// Actions tab's Build of the armoured division: the order in the queue and the gold paid, and when
// it is ready a formation of that template with its tanks, whose panel names it and lists them,
// drawn at T1 as armour.

const id = (tag: string): number => NATIONS_1938.findIndex((n) => n.tag === tag) + 1;
const GER = id('GER');
const inspect = (page: Page): Promise<Inspection> => page.evaluate(() => window.__warsim!.sim.inspect(true));

test('a player builds an armoured division from the Actions tab, and it takes the field', async ({ page }) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 1400, height: 800 });
  await page.goto('/?scenario=1938&paused=1&seed=1938');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null && window.__warsim!.hud.templates.value.length > 0, null, { timeout: 60_000 });
  // The AI off everywhere: no other order of Germany's in the queue, no war in the days waited.
  await page.evaluate(() => window.__warsim!.sim.command({ kind: 'setSetting', key: 'aiEnabled', value: false }, true));

  await page.evaluate((n) => window.__warsim!.view!.select(n), GER);
  await page.getByTestId('take-control').click();
  await page.getByTestId('tab-actions').click();
  const templates = await page.evaluate(() => window.__warsim!.hud.templates.value);
  const panzer = templates.findIndex((t) => t.nameKey === 'template.panzer_div');
  expect(panzer).toBeGreaterThanOrEqual(0);
  // Gold and men enough for one.
  await page.evaluate(([n, g]) => window.__warsim!.sim.command({ kind: 'setGold', nation: n!, value: g! }, true), [GER, templates[panzer]!.gold * 2]);
  const build = page.getByTestId(`act-build-${panzer}`);
  await expect(build).toBeEnabled();
  await expect(build.locator('xpath=..')).toContainText('Armoured division');

  const before = await inspect(page);
  const gold = before.nations.find((n) => n.id === GER)!.gold;
  const had = new Set(before.formations.filter((f) => f.nation === GER).map((f) => f.id));
  await build.click();
  await expect(page.getByTestId('act-queue-row')).toHaveCount(1);
  await expect(page.getByTestId('act-queue-row')).toContainText('Armoured division');
  await expect.poll(async () => (await inspect(page)).nations.find((n) => n.id === GER)!.gold).toBeCloseTo(gold - templates[panzer]!.gold, 3);

  // Ready after its days: a new German formation of the template.
  await page.evaluate((d) => window.__warsim!.sim.step(24 * (d + 1)), templates[panzer]!.days);
  await expect(page.getByTestId('act-queue-row')).toHaveCount(0);
  const raised = (await inspect(page)).formations.filter((f) => f.nation === GER && !had.has(f.id));
  expect(raised).toHaveLength(1);
  const f = raised[0]!;

  // Of the template: its panel names it and lists its tanks.
  await page.evaluate((fid) => window.__warsim!.hud.selectFormation(fid), f.id);
  await expect(page.getByTestId('formation-panel')).toBeVisible();
  await expect(page.getByTestId('formation-kind')).toContainText('Armoured division');
  const info = await page.evaluate(() => window.__warsim!.hud.formationInfo.value);
  expect(info?.template).toBe(panzer);
  const tanks = info!.units.filter((u) => u.cls.startsWith('armor'));
  expect(tanks.reduce((s, u) => s + u.elements, 0), 'tank elements').toBe(34);
  await expect(page.getByTestId('formation-units')).toContainText('tank');

  // At T1 its marker is drawn with the armour symbol.
  expect(templates[info!.template]!.symbol).toBe('armour');
  await page.evaluate(([x, y]) => window.__warsim!.view!.controller.set({ cx: x!, cy: y!, scale: 16 }), [f.x, f.y]);
  await expect.poll(() => page.evaluate((fid) => window.__warsim!.view!.markerRects.some((m) => m.members.includes(fid) && m.alpha > 0.5), f.id), { timeout: 10_000 }).toBe(true);
  const dir = path.resolve('docs/evidence/7.4');
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: path.join(dir, 'f33-armour-built.png') });
});
