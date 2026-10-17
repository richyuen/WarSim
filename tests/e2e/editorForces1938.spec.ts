import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import { cellOf } from '../../src/sim/data/terrain';
import { NATIONS_1938, SIZE_1938 } from '../../src/sim/scenario1938';

// PLAN 7.13a (critic run 7, editor 6: "warheads, fleets, airbases and wings still cannot be placed,
// so a scenario cannot set up a nuclear standoff or a navy"): in the editor a British fleet off
// Portsmouth, an air wing at the base by London and five warheads; a German fleet inland is refused
// with its reason. The scenario exported, then started from the title screen: all three are there.

const { w: W, h: H } = SIZE_1938;
const id = (tag: string): number => NATIONS_1938.findIndex((n) => n.tag === tag) + 1;
const [ENG, GER] = [id('ENG'), id('GER')];

async function ready(page: Page): Promise<void> {
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null && window.__warsim!.sim.mapLayers !== null, null, { timeout: 60_000 });
}

async function centre(page: Page, lon: number, lat: number, scale = 3): Promise<void> {
  const [x, y] = cellOf(lon, lat, W, H);
  await page.evaluate(({ x, y, scale }) => window.__warsim!.view!.controller.set({ cx: x + 0.5, cy: y + 0.5, scale }), { x, y, scale });
  await page.waitForTimeout(200);
}

/** Britain's formations: all, and its wings. */
async function forces(page: Page, n: number): Promise<{ all: number; wings: number }> {
  const s = await page.evaluate(() => window.__warsim!.sim.inspect(true)); // full: the formations
  const f = s.formations.filter((x) => x.nation === n);
  return { all: f.length, wings: f.filter((x) => x.wing).length };
}

const warheadsOf = (page: Page, n: number): Promise<number> => page.evaluate((n) => window.__warsim!.hud.stats.value!.nations.find((x) => x.id === n)!.warheads, n);

test('the editor places a fleet, an air wing and warheads; a shared scenario has them', async ({ page }, info) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1400, height: 800 });
  await page.goto('/?scenario=1938&paused=1&seed=1938');
  await ready(page);
  await page.evaluate(() => window.__warsim!.sim.command({ kind: 'setSetting', key: 'aiEnabled', value: false }, true));
  const before = await forces(page, ENG);

  await page.getByTestId('editor-btn').click();
  await page.getByTestId('editor-nation').selectOption(String(ENG));

  // A battle squadron off Portsmouth.
  await page.getByTestId('editor-tool-fleet').click();
  await page.getByTestId('editor-template').selectOption({ label: 'Battle squadron' });
  await centre(page, -1.09, 50.75);
  await page.mouse.click(700, 400);
  await expect.poll(async () => (await forces(page, ENG)).all).toBe(before.all + 1);

  // A strategic bomber group at the airbase by London.
  await page.getByTestId('editor-tool-wing').click();
  await page.getByTestId('editor-template').selectOption({ label: 'Strategic bomber group' });
  await centre(page, -0.12, 51.5);
  await page.mouse.click(700, 400);
  await expect.poll(async () => (await forces(page, ENG)).wings).toBe(before.wings + 1);

  // Five warheads.
  await page.getByTestId('editor-warheads').fill('5');
  await page.getByTestId('editor-warheads-add').click();
  await expect.poll(() => warheadsOf(page, ENG)).toBe(5);
  await expect(page.getByTestId('editor-warheads-of')).toContainText('5');
  await page.screenshot({ path: path.resolve('docs/evidence/7.13/a-editor-forces.png') });

  // A German fleet in Berlin is refused, and says why.
  await page.getByTestId('editor-nation').selectOption(String(GER));
  await page.getByTestId('editor-tool-fleet').click();
  await centre(page, 13.4, 52.52);
  await page.mouse.click(700, 400);
  await expect(page.getByTestId('editor-refusal')).toContainText('no water of a sea is near the place');
  await page.getByTestId('editor-panel').screenshot({ path: path.resolve('docs/evidence/7.13/a-editor-refusal.png') });
  const placed = await forces(page, ENG);

  // Shared: exported, then started from the title screen.
  await page.getByTestId('scenario-name').fill('British standoff');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('scenario-export').click()]);
  const file = path.join(info.outputPath(), dl.suggestedFilename());
  await dl.saveAs(file);
  await page.goto('/');
  await page.getByTestId('title-scenario-file').setInputFiles(file);
  await expect(page.getByTestId('title-file-name')).toHaveText('British standoff');
  await Promise.all([page.waitForURL(/load=scenario/), page.getByTestId('title-file-start').click()]);
  await ready(page);
  await expect.poll(() => forces(page, ENG), { timeout: 30_000 }).toEqual(placed);
  await expect.poll(() => warheadsOf(page, ENG), { timeout: 30_000 }).toBe(5);
  // Played: a week on, the fleet and the wing are still Britain's.
  await page.evaluate(() => window.__warsim!.sim.command({ kind: 'setSetting', key: 'aiEnabled', value: false }, true));
  await page.evaluate(() => window.__warsim!.sim.step(24 * 7));
  const after = await forces(page, ENG);
  expect(after).toEqual(placed);
});
