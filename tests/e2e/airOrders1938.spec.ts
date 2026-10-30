import { expect, test, type Page } from '@playwright/test';
import type {} from '../../src/app/testApi';
import { cellOf } from '../../src/sim/data/terrain';
import { NATIONS_1938, SIZE_1938, TEMPLATES_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { orderFerry } from '../../src/sim/systems/air';
import { assets1938 } from '../helpers/earth';
import { lookAt, open1938 } from './mapView';

// PLAN 5.8v1: the page's orders for a wing. As Germany, the Actions tab lists its air wings;
// a fighter group's Strike armed, a click on the map near Poznań gives it there; Rebase armed
// and Escape disarms it, and the next click is no wing's. PLAN 5.8v2: a garrison brigade at the
// airbase of Germany's transports, selected, Paradrop armed and Warsaw clicked: it is there.
// PLAN 5.8v4: an air template on the build list, built where an airfield has room; refused its
// button where none has.

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

test('a fighter group built from the Actions tab; with no airfield of room, its button disabled', async ({ page }) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 1400, height: 800 });
  await open1938(page);
  await page.evaluate((n) => window.__warsim!.view!.select(n), GER);
  await page.getByTestId('take-control').click();
  await page.getByTestId('tab-actions').click();
  const tps = await page.evaluate(() => window.__warsim!.hud.templates.value);
  const fighter = tps.findIndex((t) => t.nameKey === 'template.fighter_group');
  expect(tps[fighter]!.domain).toBe(2);
  expect(tps[fighter]!.aircraft).toBeGreaterThan(0);
  expect(tps[0]!.aircraft).toBe(0);
  const build = page.getByTestId(`act-build-${fighter}`);
  await expect(build).toBeEnabled();
  await build.click();
  await expect(page.getByTestId('act-queue-row')).toHaveCount(1);
  await expect(page.getByTestId('act-queue-row')).toContainText('Fighter group');
  // A nation that knows the fighter's techs, its airbases painted Germany's (God Mode): its
  // button disabled, and why.
  const w = new Sim({ scenario: '1938', seed: 1938, assets: assets1938(SIZE_1938.w) }).world;
  const need = w.rules!.templates[fighter]!.techs;
  const knows = (n: number): boolean => (w.nations.cols.tech0[n]! & need[0]) >>> 0 === need[0] && (w.nations.cols.tech1[n]! & need[1]) >>> 0 === need[1];
  const bases = (n: number): number[] => w.airbases.filter((b) => w.cells.controller[b.cell] === n).map((b) => b.cell);
  const none = [...w.nations.ids()].find((n) => n !== GER && w.nations.cols.living[n] === 1 && knows(n) && bases(n).length > 0 && bases(n).length <= 3)!;
  expect(none, 'a nation with the techs and few airbases').toBeGreaterThan(0);
  await page.getByTestId('release-control').click();
  await page.evaluate(({ cells, W, GER }) => {
    const sim = window.__warsim!.sim;
    for (const c of cells) sim.command({ kind: 'paintControl', nation: GER, x: (c % W) + 0.5, y: Math.floor(c / W) + 0.5, r: 0 }, true);
  }, { cells: bases(none), W: SIZE_1938.w, GER });
  await page.evaluate(() => window.__warsim!.sim.step(1));
  await expect.poll(async () => page.evaluate((n) => window.__warsim!.hud.stats.value!.nations.find((x) => x.id === n)?.airRoom ?? -1, none), { timeout: 30_000 }).toBe(0);
  await page.evaluate((n) => window.__warsim!.view!.select(n), none);
  await page.getByTestId('take-control').click();
  await page.getByTestId('tab-actions').click();
  await expect(page.getByTestId(`act-build-${fighter}`)).toBeDisabled();
  await expect(page.getByTestId(`act-build-${fighter}`).locator('xpath=..')).toContainText('no airfield with room');
});

// PLAN 7.142: a wing at sea on its way to a new base (the sea ferry, ADR-723) says so on its row of
// the Actions tab, with the days left, and its order buttons are off
// (it takes none at sea); a wing at its airbase says that. A US fighter group ordered over
// the Atlantic to a British base in Node, the United States and Britain at war
// with Germany, the save loaded into the page, the United States taken.
test('a wing at sea to its new base says so on its row, with the days left', async ({ page }) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 1400, height: 800 });
  const USA = NATIONS_1938.findIndex((n) => n.tag === 'USA') + 1;
  const ENG = NATIONS_1938.findIndex((n) => n.tag === 'ENG') + 1;
  const node = new Sim({ scenario: '1938', seed: 1938, assets: assets1938(SIZE_1938.w) });
  const w = node.world;
  const fighter = TEMPLATES_1938.findIndex((t) => t.id === 'fighter_group');
  const ids = [...w.wingBase].filter(([id, b]) => b > 0 && w.formations.cols.nation[id] === USA && w.formations.cols.template[id] === fighter).map(([id]) => id).sort((a, b) => a - b);
  const [sailing, home] = [ids[0]!, ids[1]!];
  // Britain of its side: both at war with Germany.
  w.wars.start([USA, ENG], [NATIONS_1938.findIndex((n) => n.tag === 'GER') + 1], 0);
  const eng = w.airbases.findIndex((b) => w.cells.controller[b.cell] === ENG) + 1;
  expect(orderFerry(w, sailing, eng)).toBe(0);
  const days = Math.ceil((w.wingFerry.get(sailing)! - w.tick) / 24);
  expect(days).toBeGreaterThan(1);
  const saved = Buffer.from(node.save()).toString('base64');

  await open1938(page);
  await page.evaluate(async (b64) => {
    const sim = window.__warsim!.sim;
    const before = window.__warsim!.view!.snapshots;
    await sim.load(Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0)));
    await new Promise<void>((done) => {
      const wait = (): void => (window.__warsim!.view!.snapshots > before ? done() : void setTimeout(wait, 5));
      wait();
    });
  }, saved);
  await page.evaluate((n) => window.__warsim!.view!.select(n), USA);
  await page.getByTestId('take-control').click();
  await page.getByTestId('tab-actions').click();
  await expect.poll(async () => (await wings(page)).find((x) => x.id === sailing)?.ferryDays, { timeout: 30_000 }).toBe(days);
  await expect(page.getByTestId(`act-wing-${sailing}`)).toContainText(`at sea to its new base, ${days} days`);
  await expect(page.getByTestId(`act-wing-${sailing}-strike`)).toBeDisabled();
  await expect(page.getByTestId(`act-wing-${home}-strike`)).toBeEnabled();
  await expect(page.getByTestId(`act-wing-${home}`)).toContainText('at an airbase');
  await expect(page.getByTestId(`act-wing-${home}`)).not.toContainText('at sea');
  await page.getByTestId('tab-actions').locator('xpath=ancestor::aside[1]').screenshot({ path: 'docs/evidence/7.142/a-wing-at-sea-row.png' });
});

test('a wing\'s name in the Actions tab selects it and the camera follows it; again, it lets go (ADR-766)', async ({ page }) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 1400, height: 800 });
  await open1938(page);
  await page.evaluate((n) => window.__warsim!.view!.select(n), GER);
  await page.getByTestId('take-control').click();
  await page.getByTestId('tab-actions').click();
  await expect.poll(async () => (await wings(page)).length, { timeout: 30_000 }).toBeGreaterThan(20);
  const wing = (await wings(page)).find((w) => !w.carrier && !w.flying)!;
  // Each wing has an icon and a place.
  await expect(page.getByTestId(`act-wing-${wing.id}`).locator('.unit-icon')).toHaveCount(1);
  expect(Number.isFinite(wing.x) && Number.isFinite(wing.y)).toBe(true);
  // The camera is elsewhere first: far from the wing.
  await lookAt(page, (wing.x + 300) % SIZE_1938.w, wing.y, 1500);
  await page.getByTestId(`act-wing-${wing.id}-name`).click();
  await expect(page.getByTestId(`act-wing-${wing.id}`)).toHaveClass(/followed/);
  expect(await page.evaluate(() => window.__warsim!.view!.controller.following)).toBe(true);
  await expect
    .poll(async () => page.evaluate(([x, y]) => {
      const c = window.__warsim!.view!.controller.cam;
      return Math.hypot(c.cx - x!, c.cy - y!);
    }, [wing.x, wing.y]), { timeout: 15_000 })
    .toBeLessThan(2);
  // The name again: the follow ends, the row is no more lit.
  await page.getByTestId(`act-wing-${wing.id}-name`).click();
  await expect(page.getByTestId(`act-wing-${wing.id}`)).not.toHaveClass(/followed/);
  expect(await page.evaluate(() => window.__warsim!.view!.controller.following)).toBe(false);
  // Selected again, Escape lets go.
  await page.getByTestId(`act-wing-${wing.id}-name`).click();
  await expect(page.getByTestId(`act-wing-${wing.id}`)).toHaveClass(/followed/);
  await page.keyboard.press('Escape');
  await expect(page.getByTestId(`act-wing-${wing.id}`)).not.toHaveClass(/followed/);
  expect(await page.evaluate(() => window.__warsim!.view!.controller.following)).toBe(false);
});
