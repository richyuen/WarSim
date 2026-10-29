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
  // The four templates of PLAN 3.1c are on the list by name, and nobody can order them in 1938.
  for (const [id, name] of [['panzer_div_2', 'Medium armoured division'], ['heavy_panzer_div', 'Heavy armoured division'], ['mech_div', 'Mechanised division'], ['mbt_div', 'Main battle tank division']] as const) {
    const button = page.getByTestId(`act-build-${names.indexOf(`template.${id}`)}`);
    await expect(button, id).toBeDisabled();
    await expect(button.locator('xpath=..'), id).toContainText(name);
    await expect(button.locator('xpath=..'), id).toContainText('not researched');
  }
  await page.getByTestId(`act-build-${names.indexOf('template.mbt_div')}`).scrollIntoViewIfNeeded();
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

// The user's request of 2026-10-29: war declared from the map. A right-click on another nation's
// ground opens its menu (a drag of the right button pans, and opens none; the player's own
// ground has none): Declare war; then, at war, Offer peace and no alliance. A refusal (a truce)
// is told in words where the menu was.
test('a right-click on a nation\'s ground: declare war from its menu, and a refusal told', async ({ page }, info) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1400, height: 800 });
  await page.goto('/?scenario=1938&paused=1&seed=1938');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null, null, { timeout: 60_000 });
  await page.waitForFunction((p) => window.__warsim!.view!.formationsOf(p).length > 3, POL, { timeout: 60_000 });
  const LIT = id('LIT');
  await page.evaluate((p) => window.__warsim!.view!.select(p), POL);
  await page.getByTestId('take-control').click();
  await expect(page.getByTestId('player-label')).toContainText('Poland');
  await page.evaluate(() => window.__warsim!.view!.select(0));

  // Lithuania and Poland on the screen: the camera over Poland's north-east at 16 px a cell.
  const at = (await page.evaluate((p) => window.__warsim!.view!.formationPos(window.__warsim!.view!.formationsOf(p)[0]!), POL))!;
  await page.evaluate(([x, y]) => window.__warsim!.view!.controller.set({ cx: x + 8, cy: y - 10, scale: 16 }), at);
  await page.waitForTimeout(300);
  const spot = (nation: number) =>
    page.evaluate((n) => {
      const v = window.__warsim!.view!;
      for (let y = 160; y <= 640; y += 20) for (let x = 360; x <= 1080; x += 20) if (v.nationAt(x, y) === n && v.nationAt(x + 10, y) === n && v.nationAt(x, y + 10) === n) return [x, y] as const;
      return null;
    }, nation);
  const lit = (await spot(LIT))!;
  const own = (await spot(POL))!;
  expect(lit, 'Lithuanian ground on the screen').not.toBeNull();
  expect(own, 'Polish ground on the screen').not.toBeNull();
  const menu = page.getByTestId('nation-menu');

  // Own ground: no menu. A drag of the right button pans: no menu.
  await page.mouse.click(own[0], own[1], { button: 'right' });
  await expect(menu).toHaveCount(0);
  await page.mouse.move(lit[0], lit[1]);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(lit[0] + 40, lit[1] + 20, { steps: 4 });
  await page.mouse.up({ button: 'right' });
  await expect(menu).toHaveCount(0);
  await page.evaluate(([x, y]) => window.__warsim!.view!.controller.set({ cx: x + 8, cy: y - 10, scale: 16 }), at);
  await page.waitForTimeout(200);

  // Lithuania's ground: its menu; Escape closes it.
  await page.mouse.click(lit[0], lit[1], { button: 'right' });
  await expect(menu).toBeVisible();
  await expect(page.getByTestId('nation-menu-name')).toHaveText('Lithuania');
  const out = info.outputPath();
  mkdirSync(out, { recursive: true });
  await page.screenshot({ path: path.join(out, 'nation-menu.png') });
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
  await expect(page.getByTestId('player-label')).toContainText('Poland'); // Escape closed the menu only

  // Declare war from it: the war is on, and the menu closed.
  await page.mouse.click(lit[0], lit[1], { button: 'right' });
  await page.getByTestId('nation-menu-war').click();
  await expect(menu).toHaveCount(0);
  await expect.poll(async () => (await pol(page)).enemies).toContain(LIT);
  // At war: the menu offers peace, and no alliance.
  await page.mouse.click(lit[0], lit[1], { button: 'right' });
  await expect(page.getByTestId('nation-menu-peace')).toBeVisible();
  await expect(page.getByTestId('nation-menu-war')).toHaveCount(0);
  await expect(page.getByTestId('nation-menu-ally')).toBeDisabled();
  // A left press on the map closes it.
  await page.mouse.click(lit[0], lit[1]);
  await expect(menu).toHaveCount(0);

  // Peace forced (God Mode's command): a truce. War declared again from the menu is refused, in words.
  const war = (await inspect(page)).wars.find((w) => w.attackers.includes(POL) && w.defenders.includes(LIT))!;
  await page.evaluate((w) => window.__warsim!.sim.command({ kind: 'forcePeace', war: w }, true), war.id);
  await expect.poll(async () => (await pol(page)).enemies).not.toContain(LIT);
  await page.mouse.click(lit[0], lit[1], { button: 'right' });
  await page.getByTestId('nation-menu-war').click();
  await expect(page.getByTestId('nation-menu-notice')).toContainText('truce');
  expect((await pol(page)).enemies).not.toContain(LIT);
});
