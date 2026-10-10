import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import type { Inspection } from '../../src/shared/protocol';
import { NATIONS_1938 } from '../../src/sim/scenario1938';

// PLAN 4.2f AT: the build list of the Actions tab offers the fleets to a nation with a
// shipyard: the United Kingdom builds a destroyer flotilla and it is in its queue; Switzerland's
// fleets are on the list and disabled ("no port").

const id = (tag: string): number => NATIONS_1938.findIndex((n) => n.tag === tag) + 1;
const inspect = (page: Page): Promise<Inspection> => page.evaluate(() => window.__warsim!.sim.inspect());

async function control(page: Page, nation: number): Promise<void> {
  await page.evaluate((p) => window.__warsim!.view!.select(p), nation);
  await page.getByTestId('take-control').click();
  await page.getByTestId('tab-actions').click();
  await expect(page.getByTestId('panel-actions')).toBeVisible();
}

test('the build list: fleets for a nation with a port, disabled for one with none', async ({ page }, info) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto('/?scenario=1938&paused=1&seed=1938');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null && window.__warsim!.hud.templates.value.length > 0, null, { timeout: 60_000 });
  const names = await page.evaluate(() => window.__warsim!.hud.templates.value.map((t) => t.nameKey));
  const fleets = ['battle_squadron', 'carrier_group', 'cruiser_squadron', 'destroyer_flotilla', 'submarine_flotilla', 'transport_group'];
  for (const f of fleets) expect(names, f).toContain(`template.${f}`);
  const flotilla = names.indexOf('template.destroyer_flotilla');

  // Switzerland: on the list, disabled, "no port"; a division it can order.
  await control(page, id('SWI'));
  for (const f of fleets) {
    const button = page.getByTestId(`act-build-${names.indexOf(`template.${f}`)}`);
    await expect(button, f).toBeDisabled();
    await expect(button.locator('xpath=..'), f).toContainText('no port');
  }
  await expect(page.getByTestId('act-build-0')).toBeEnabled();
  expect((await inspect(page)).nations.find((n) => n.id === id('SWI'))!.shipyard).toBe(false);

  // The United Kingdom: the flotilla is built and in its queue, its gold paid.
  const ENG = id('ENG');
  await control(page, ENG);
  const button = page.getByTestId(`act-build-${flotilla}`);
  await expect(button).toBeEnabled();
  await expect(button.locator('xpath=..')).toContainText('Destroyer flotilla');
  await expect(button.locator('xpath=..')).not.toContainText('no port');
  const t = await page.evaluate((i) => window.__warsim!.hud.templates.value[i]!, flotilla);
  const before = (await inspect(page)).nations.find((n) => n.id === ENG)!;
  expect(before.shipyard).toBe(true);
  await button.click();
  await expect.poll(async () => (await inspect(page)).nations.find((n) => n.id === ENG)!.gold).toBeCloseTo(before.gold - t.gold, 3);
  await expect(page.getByTestId('act-queue-row')).toHaveCount(1);
  await expect(page.getByTestId('act-queue-row')).toContainText('Destroyer flotilla');
  await expect(page.getByTestId('act-queue-row')).toContainText(`ready in ${t.days} days`);
  await button.scrollIntoViewIfNeeded();
  const out = process.env['SHOTS'] ?? info.outputPath();
  mkdirSync(out, { recursive: true });
  await page.screenshot({ path: path.join(out, 'build-fleet.png') });
});
