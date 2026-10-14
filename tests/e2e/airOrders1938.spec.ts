import { expect, test, type Page } from '@playwright/test';
import type {} from '../../src/app/testApi';
import { cellOf } from '../../src/sim/data/terrain';
import { NATIONS_1938, SIZE_1938, TEMPLATES_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { assets1938 } from '../helpers/earth';
import { lookAt, open1938 } from './mapView';

// PLAN 5.8v1: the page's orders for a wing. As Germany, the Actions tab lists its air wings;
// a fighter group's Strike armed, a click on the map near Poznań gives it there; Rebase armed
// and Escape disarms it, and the next click is no wing's. PLAN 5.8v2: a garrison brigade at the
// airbase of Germany's transports, selected, Paradrop armed and Warsaw clicked: it is there.

const GER = NATIONS_1938.findIndex((n) => n.tag === 'GER') + 1;
const wings = (page: Page) => page.evaluate(() => window.__warsim!.hud.stats.value?.wings ?? []);
/** A click at the middle of the map's canvas. */
async function clickMiddle(page: Page): Promise<void> {
  const box = (await page.locator('canvas.map-nations').boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

test('a wing\'s mission by the Actions tab and a click on the map; Escape disarms an order', async ({ page }) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 1400, height: 800 });
  await open1938(page);
  await page.evaluate((n) => window.__warsim!.view!.select(n), GER);
  await page.getByTestId('take-control').click();
  await page.getByTestId('tab-actions').click();
  await expect.poll(async () => (await wings(page)).length, { timeout: 30_000 }).toBeGreaterThan(20);
  const names = await page.evaluate(() => window.__warsim!.hud.templates.value.map((t) => t.nameKey));
  const list = await wings(page);
  const fighter = list.find((w) => w.template === names.indexOf('template.fighter_group') && !w.carrier)!;
  const transport = list.find((w) => w.transport)!;
  expect(fighter.mission).toBeNull();
  // A transport has Supply and no Strike; a fighter Strike and no Supply.
  await expect(page.getByTestId(`act-wing-${transport.id}-supply`)).toBeVisible();
  await expect(page.getByTestId(`act-wing-${transport.id}-strike`)).toHaveCount(0);
  await expect(page.getByTestId(`act-wing-${fighter.id}-supply`)).toHaveCount(0);

  const [px, py] = cellOf(16.9, 52.4, SIZE_1938.w, SIZE_1938.h);
  await lookAt(page, px, py, 1500);
  await page.getByTestId(`act-wing-${fighter.id}-strike`).click();
  await expect(page.getByTestId('act-wing-armed')).toContainText('strike a place');
  await clickMiddle(page);
  await expect(page.getByTestId('act-wing-armed')).toHaveCount(0);
  await page.evaluate(() => window.__warsim!.sim.step(1));
  await expect.poll(async () => (await wings(page)).find((w) => w.id === fighter.id)?.mission, { timeout: 30_000 }).toBe('strike');
  await expect(page.getByTestId(`act-wing-${fighter.id}`)).toContainText('striking');

  // Rebase armed, then Escape: disarmed, and the click after it gives the wing no order.
  await page.getByTestId(`act-wing-${transport.id}-rebase`).click();
  await expect(page.getByTestId('act-wing-armed')).toContainText('move to an airbase or carrier');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('act-wing-armed')).toHaveCount(0);
});

test('a paradrop of the selected brigade by the Actions tab and a click on Warsaw', async ({ page }) => {
  test.setTimeout(150_000);
  // Where Germany's first transport group is based, as the same start has it.
  const w = new Sim({ scenario: '1938', seed: 1938, assets: assets1938(SIZE_1938.w) }).world;
  const lifts = [...w.wingBase].filter(([id, b]) => w.formations.cols.nation[id] === GER && b > 0 && TEMPLATES_1938[w.formations.cols.template[id]!]!.id === 'air_transport_group').map(([id, b]) => [id, b] as const).sort((a, b) => a[0] - b[0]);
  const [bx, by] = w.cellPoint(w.airbases[lifts[0]![1] - 1]!.cell);
  const garrison = TEMPLATES_1938.findIndex((t) => t.id === 'garrison_brigade');
  await page.setViewportSize({ width: 1400, height: 800 });
  await open1938(page);
  await page.evaluate((n) => window.__warsim!.view!.select(n), GER);
  await page.getByTestId('take-control').click();
  await page.getByTestId('tab-actions').click();
  const POL = NATIONS_1938.findIndex((n) => n.tag === 'POL') + 1;
  // At war with Poland; the second group to the first's airbase; a garrison brigade there.
  await page.evaluate(({ GER, POL, second, bx, by, garrison }) => {
    const sim = window.__warsim!.sim;
    sim.command({ kind: 'declareWar', attacker: GER, defender: POL });
    sim.command({ kind: 'wingRebase', id: second, x: bx, y: by, nation: GER });
    sim.command({ kind: 'spawnFormation', nation: GER, x: bx, y: by, strength: 0, template: garrison });
    sim.step(1);
  }, { GER, POL, second: lifts[1]![0], bx, by, garrison });
  const brigade = await page.waitForFunction(({ bx, by }) => {
    const v = window.__warsim!.view!;
    if (v.lastTick < 1) return 0;
    return v.formationIds().find((id) => { const p = v.formationPos(id); return p !== null && Math.hypot(p[0] - bx, p[1] - by) < 0.01; }) ?? 0;
  }, { bx, by }, { timeout: 30_000 }).then((h) => h.jsonValue());
  expect(brigade).toBeGreaterThan(0);
  await expect(page.getByTestId('act-drop')).toBeDisabled();
  await page.evaluate((id) => {
    const { view, player } = window.__warsim!;
    view!.selectedFormations.add(id);
    player!.selectedCount.value = 1;
  }, brigade);
  await page.getByTestId('act-drop').click();
  await expect(page.getByTestId('act-wing-armed')).toContainText('drop the 1 selected there');
  const [wx, wy] = cellOf(21.0, 52.2, SIZE_1938.w, SIZE_1938.h);
  await lookAt(page, wx, wy, 1500);
  await clickMiddle(page);
  await page.evaluate(() => window.__warsim!.sim.step(1));
  await expect.poll(async () => page.evaluate((id) => window.__warsim!.view!.formationPos(id), brigade).then((p) => (p ? Math.hypot(p[0] - wx, p[1] - wy) : Infinity)), { timeout: 30_000 }).toBeLessThan(2);
});
