import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import type { Inspection } from '../../src/shared/protocol';
import { NATIONS_1938 } from '../../src/sim/scenario1938';

// PLAN 1.33b AT: as Poland, queue a formation (gold drops, it appears when ready) and declare
// war; a peace offer at an even score is refused; an alliance proposal to an unallied nation is
// accepted. All through the Actions tab of the controlled nation.

const id = (tag: string): number => NATIONS_1938.findIndex((n) => n.tag === tag) + 1;
const POL = id('POL');
const inspect = (page: Page): Promise<Inspection> => page.evaluate(() => window.__warsim!.sim.inspect());
const pol = async (page: Page) => (await inspect(page)).nations.find((n) => n.id === POL)!;

test('player actions: build a formation, declare war, offer peace, propose an alliance', async ({ page }, info) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 1400, height: 800 });
  await page.goto('/?scenario=1938&paused=1&seed=1938');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null && window.__warsim!.hud.templates.value.length > 0, null, { timeout: 60_000 });

  await page.evaluate((p) => window.__warsim!.view!.select(p), POL);
  await expect(page.getByTestId('tab-actions')).toHaveCount(0); // only for the controlled nation
  await page.getByTestId('take-control').click();
  await page.getByTestId('tab-actions').click();
  await expect(page.getByTestId('panel-actions')).toBeVisible();

  // A template whose techs Poland does not know cannot be ordered (PLAN 3.1a): the panzer
  // division asks for the medium tank. The tank brigade of its own army is known to it (whether
  // it has the gold for one is another matter).
  const names = await page.evaluate(() => window.__warsim!.hud.templates.value.map((t) => t.nameKey));
  const panzer = page.getByTestId(`act-build-${names.indexOf('template.panzer_div')}`);
  await expect(panzer).toBeDisabled();
  await expect(panzer.locator('xpath=..')).toContainText('not researched');
  await expect(page.getByTestId(`act-build-${names.indexOf('template.tank_brigade')}`).locator('xpath=..')).not.toContainText('not researched');
  if (process.env['EVIDENCE']) {
    const dir = path.resolve(import.meta.dirname, '../../docs/evidence/3.1');
    mkdirSync(dir, { recursive: true });
    await page.screenshot({ path: path.join(dir, 'build-list-poland.png') });
  }

  // Production: build template 0 (infantry division).
  const t0 = await page.evaluate(() => window.__warsim!.hud.templates.value[0]!);
  const before = await pol(page);
  await page.getByTestId('act-build-0').click();
  await expect.poll(async () => (await pol(page)).gold).toBeCloseTo(before.gold - t0.gold, 3);
  await expect(page.getByTestId('act-queue-row')).toHaveCount(1);
  await expect(page.getByTestId('act-queue-row')).toContainText(`ready in ${t0.days} days`);
  // It appears when ready: one more Polish formation after t0.days + 1 days.
  await page.evaluate((d) => window.__warsim!.sim.step(24 * (d + 1)), t0.days);
  await expect.poll(async () => (await pol(page)).formations, { timeout: 30_000 }).toBe(before.formations + 1);
  await expect(page.getByTestId('act-queue-row')).toHaveCount(0);

  // Declare war on Lithuania.
  await page.getByTestId('act-target').selectOption(String(id('LIT')));
  await page.getByTestId('act-war').click();
  await expect.poll(async () => (await pol(page)).enemies).toContain(id('LIT'));
  const war = (await inspect(page)).wars.find((w) => w.attackers.includes(POL) && w.defenders.includes(id('LIT')))!;
  // A peace offer at an even score is refused: the war goes on.
  await page.getByTestId(`act-peace-${war.id}`).click();
  await page.waitForTimeout(300);
  expect((await inspect(page)).wars.some((w) => w.id === war.id)).toBe(true);

  // Alliance: a nation in no alliance, no puppet and at peace with Poland accepts (picked now:
  // the AI forms alliances while days pass). Poland leads the new pact, or the target joins its.
  const now = await inspect(page);
  const me = now.nations.find((n) => n.id === POL)!;
  const partner = now.nations.find((n) => n.living && n.id !== POL && n.alliance === null && n.overlord === 0 && !me.enemies.includes(n.id))!;
  expect(partner).toBeTruthy();
  await page.getByTestId('act-target').selectOption(String(partner.id));
  await page.getByTestId('act-ally').click();
  const leader = me.alliance?.leader ?? POL;
  await expect.poll(async () => (await inspect(page)).nations.find((n) => n.id === partner.id)!.alliance?.leader).toBe(leader);

  const out = process.env['EVIDENCE'] ? path.resolve(import.meta.dirname, '../../docs/evidence/1.33') : info.outputPath();
  mkdirSync(out, { recursive: true });
  await page.screenshot({ path: path.join(out, 'player-actions.png') });
});
