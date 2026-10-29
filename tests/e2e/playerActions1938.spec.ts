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

// The user's request of 2026-10-29: with God Mode on, the played nation's Actions tab places any
// unit at once, researched or not, for no gold: a division on its land and on another's, a fleet
// on the water by the click, a wing at an airbase of its. A fleet where no sea is near is refused
// in words. Escape disarms; God Mode off takes the section away.
test('God Mode places any unit of the played nation at once: a division, a fleet, a wing', async ({ page }, info) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 1400, height: 800 });
  await page.goto('/?scenario=1938&paused=1&seed=1938');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null && window.__warsim!.hud.templates.value.length > 0, null, { timeout: 60_000 });
  await page.waitForFunction((p) => window.__warsim!.view!.formationsOf(p).length > 3, POL, { timeout: 60_000 });
  await page.evaluate(() => window.__warsim!.sim.command({ kind: 'setSetting', key: 'aiEnabled', value: false }, true));
  await page.evaluate((p) => window.__warsim!.view!.select(p), POL);
  await page.getByTestId('take-control').click();
  await page.getByTestId('tab-actions').click();
  const names = await page.evaluate(() => window.__warsim!.hud.templates.value.map((t) => t.nameKey));
  const panzer = names.indexOf('template.panzer_div');
  const destroyers = names.indexOf('template.destroyer_flotilla');
  const fighters = names.indexOf('template.fighter_group');
  expect([panzer, destroyers, fighters].every((i) => i >= 0)).toBe(true);
  // Without God Mode there is no placing.
  await expect(page.getByTestId(`act-place-${panzer}`)).toHaveCount(0);
  await page.getByTestId('god-btn').click();
  await page.getByTestId('tab-actions').click();
  await expect(page.getByTestId(`act-place-${panzer}`)).toBeVisible();

  // Poland's ground, Germany's, the Baltic, and Polish ground far from the sea, on the screen.
  const at = (await page.evaluate((p) => window.__warsim!.view!.formationPos(window.__warsim!.view!.formationsOf(p)[0]!), POL))!;
  await page.evaluate(([x, y]) => window.__warsim!.view!.controller.set({ cx: x - 4, cy: y - 6, scale: 12 }), at);
  await page.waitForTimeout(300);
  const spots = await page.evaluate(([pol, ger]) => {
    const v = window.__warsim!.view!;
    const pts: [number, number, number][] = [];
    for (let y = 120; y <= 680; y += 16) for (let x = 360; x <= 1100; x += 16) pts.push([x, y, v.nationAt(x, y)]);
    const sea = pts.filter((p) => p[2] === 0);
    const near = (p: [number, number, number]): number => Math.min(...sea.map((s) => Math.hypot(s[0] - p[0], s[1] - p[1])));
    const of = (n: number) => pts.filter((p) => p[2] === n);
    const polish = of(pol).sort((a, b) => near(b) - near(a));
    const coast = of(pol).sort((a, b) => near(a) - near(b))[0];
    const seaSpot = coast ? sea.sort((a, b) => Math.hypot(a[0] - coast[0], a[1] - coast[1]) - Math.hypot(b[0] - coast[0], b[1] - coast[1]))[0] : undefined;
    return { inland: polish[0], german: of(ger)[0], sea: seaSpot, own: polish[Math.floor(polish.length / 2)] };
  }, [POL, id('GER')] as const);
  expect(spots.inland && spots.german && spots.sea && spots.own, JSON.stringify(spots)).toBeTruthy();
  const polish = async () => (await page.evaluate(() => window.__warsim!.sim.inspect(true))).formations.filter((f) => f.nation === POL);
  const gold = (await pol(page)).gold;
  const before = (await polish()).length;

  // A division not researched (the panzer division), on Polish ground and on German ground.
  await page.getByTestId(`act-place-${panzer}`).click();
  await expect(page.getByTestId('act-place-armed')).toContainText('Armoured division');
  await page.mouse.click(spots.own![0], spots.own![1]);
  await expect.poll(async () => (await polish()).length).toBe(before + 1);
  await page.mouse.click(spots.german![0], spots.german![1]);
  await expect.poll(async () => (await polish()).length).toBe(before + 2);
  const placed = (await polish()).slice(-2);
  const cellOf = (s: readonly [number, number, number]) => page.evaluate(([x, y]) => window.__warsim!.view!.cellAt(x, y)!, [s[0], s[1]] as const);
  const [gx, gy] = await cellOf(spots.german!);
  expect(placed.some((f) => Math.hypot(f.x - gx - 0.5, f.y - gy - 0.5) < 2), 'a division on German ground').toBe(true);
  expect(placed.every((f) => f.elements > 0 && f.strength > 0), 'with its elements').toBe(true);

  // A fleet: refused where no sea is near (told in words), placed on the water by the coast.
  await page.getByTestId(`act-place-${destroyers}`).click();
  await page.mouse.click(spots.inland![0], spots.inland![1]);
  await expect(page.getByTestId('act-place-refusal')).toContainText('no water of a sea');
  await page.mouse.click(spots.sea![0], spots.sea![1]);
  await expect.poll(async () => (await polish()).length).toBe(before + 3);
  await expect(page.getByTestId('act-place-refusal')).toHaveCount(0);

  // A wing, at a Polish airbase with room.
  await page.getByTestId(`act-place-${fighters}`).click();
  await page.mouse.click(spots.own![0], spots.own![1]);
  await expect.poll(async () => (await polish()).filter((f) => f.wing).length).toBeGreaterThan(0);
  expect((await polish()).length).toBe(before + 4);

  // No gold was spent; the queue is empty.
  expect((await pol(page)).gold).toBeCloseTo(gold, 3);
  const out = info.outputPath();
  mkdirSync(out, { recursive: true });
  await page.screenshot({ path: path.join(out, 'god-placed.png') });

  // Escape disarms: a click on ground places nothing.
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('act-place-armed')).toHaveCount(0);
  await page.mouse.click(spots.own![0], spots.own![1]);
  await page.waitForTimeout(300);
  expect((await polish()).length).toBe(before + 4);
  // God Mode off: no placing. (The click above selected a formation and opened its panel: closed first.)
  await page.evaluate((p) => {
    window.__warsim!.hud.selectFormation(0);
    window.__warsim!.view!.select(p);
  }, POL);
  await page.getByTestId('tab-actions').click();
  await page.getByTestId(`act-place-${panzer}`).click();
  await expect(page.getByTestId('act-place-armed')).toBeVisible();
  await page.getByTestId('god-btn').click();
  await expect(page.getByTestId(`act-place-${panzer}`)).toHaveCount(0);
  expect(await page.evaluate(() => window.__warsim!.player!.placing.value)).toBeNull();
});
