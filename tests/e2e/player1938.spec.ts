import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import type { Command } from '../../src/shared/commands';
import { NATIONS_1938, TEMPLATES_LAND } from '../../src/sim/scenario1938';

// PLAN 1.33a AT: take control of Poland, order a move, and the formation moves. Selection is by a
// real click on the formation's marker and the order by a real click on the map; the player's
// nation has its AI off, so its other formations stay where they are.

const POL = NATIONS_1938.findIndex((n) => n.tag === 'POL') + 1;
const GER = NATIONS_1938.findIndex((n) => n.tag === 'GER') + 1;
const infantry = TEMPLATES_LAND.findIndex((t) => t.id === 'infantry_div');

test('take control of Poland, select a formation, order a move: it marches', async ({ page }, info) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 1400, height: 800 });
  await page.goto('/?scenario=1938&paused=1&seed=1938');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null, null, { timeout: 60_000 });
  await page.waitForFunction((p) => window.__warsim!.view!.formationsOf(p).length > 3, POL, { timeout: 60_000 });

  // Select Poland and take control from its panel.
  await page.evaluate((p) => window.__warsim!.view!.select(p), POL);
  await page.getByTestId('take-control').click();
  await expect(page.getByTestId('release-control')).toBeVisible();
  await expect(page.getByTestId('player-label')).toContainText('Poland');
  await expect.poll(async () => (await page.evaluate(() => window.__warsim!.sim.inspect())).nations.find((n) => n.id === POL)!.aiOff).toBe(true);

  // Centre the camera on one Polish formation and click its marker.
  const ids = await page.evaluate((p) => window.__warsim!.view!.formationsOf(p), POL);
  const unit = ids[0]!;
  const others = ids.slice(1);
  const start = (await page.evaluate((id) => window.__warsim!.view!.formationPos(id), unit))!;
  const othersBefore = await page.evaluate((os) => os.map((id) => window.__warsim!.view!.formationPos(id)), others);
  await page.evaluate(([x, y]) => window.__warsim!.view!.controller.set({ cx: x, cy: y, scale: 16 }), start);
  await page.waitForTimeout(200);
  // The marker sits at the screen centre; other units may overlap, so pick whichever is nearest.
  const picked = await page.evaluate((p) => window.__warsim!.view!.formationAt(700, 400, p), POL);
  expect(picked).not.toBe(0);
  await page.mouse.click(700, 400);
  await expect(page.getByTestId('player-label')).toContainText('1 selected');
  expect(await page.evaluate(() => [...window.__warsim!.view!.selectedFormations])).toEqual([picked]);

  // Order: a point 10 cells to the west (Polish land, 160 px at scale 16), clear of markers.
  const from = (await page.evaluate((id) => window.__warsim!.view!.formationPos(id), picked))!;
  const target = await page.evaluate(() => {
    const v = window.__warsim!.view!;
    const [tx, ty] = v.cellAt(540, 400)!;
    return [tx + 0.5, ty + 0.5] as const;
  });
  expect(await page.evaluate((p) => window.__warsim!.view!.formationAt(540, 400, p), POL)).toBe(0); // a move, not a reselect
  await page.mouse.click(540, 400);

  const out = process.env['EVIDENCE'] ? path.resolve(import.meta.dirname, '../../docs/evidence/1.33') : info.outputPath();
  mkdirSync(out, { recursive: true });
  await page.screenshot({ path: path.join(out, 'player-order.png') });

  // Run two days: the ordered formation approaches the target; the others stay put (AI off).
  await page.evaluate(() => window.__warsim!.sim.step(48));
  await page.waitForFunction((t) => window.__warsim!.view!.lastTick >= t, 48, { timeout: 30_000 });
  const after = (await page.evaluate((id) => window.__warsim!.view!.formationPos(id), picked))!;
  const d0 = Math.hypot(from[0] - target[0], from[1] - target[1]);
  const d1 = Math.hypot(after[0] - target[0], after[1] - target[1]);
  expect(d1).toBeLessThan(d0 - 2);
  const othersAfter = await page.evaluate((os) => os.map((id) => window.__warsim!.view!.formationPos(id)), others);
  othersAfter.forEach((p, i) => {
    if (others[i] !== picked) expect(p).toEqual(othersBefore[i]);
  });
  await page.screenshot({ path: path.join(out, 'player-moved.png') });

  // Control is sim state: a page reload resuming the autosave keeps Poland under player control.
  await page.evaluate(() => window.__warsim!.autosave.saveNow());
  await page.goto('/?scenario=1938&paused=1&seed=1938&continue=1');
  await page.waitForFunction((t) => window.__warsim?.hud.stats.value !== null && (window.__warsim?.hud.stats.value?.tick ?? 0) >= t, 48, { timeout: 60_000 });
  await expect(page.getByTestId('player-label')).toContainText('Poland');
  await page.evaluate((p) => window.__warsim!.view!.select(p), POL);
  await expect(page.getByTestId('release-control')).toBeVisible();

  // Escape clears the selection; releasing control hands Poland back to its AI.
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('player-label')).toContainText('0 selected');
  await page.getByTestId('release-control').click();
  await expect(page.getByTestId('player-label')).toHaveCount(0);
  await expect.poll(async () => (await page.evaluate(() => window.__warsim!.sim.inspect())).nations.find((n) => n.id === POL)!.aiOff).toBe(false);
});

// PLAN 2.16Rk (from 2.16Ri): a table gives a freed id to the next row made, and the selection
// knew its formations by the id alone. The player's selected formation is removed and Germany
// raises one in the same hour: it has the Polish one's id. (Before: it stayed selected, the bar
// said "1 selected", and a click on ground ordered the German division to march.) Nothing is
// selected, and a click on ground orders nothing. A load empties the selection too.
test('the selection drops a formation that is gone, though another nation\'s has taken its id', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1400, height: 800 });
  await page.goto('/?scenario=1938&paused=1&seed=1938');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null, null, { timeout: 60_000 });
  await page.waitForFunction((p) => window.__warsim!.view!.formationsOf(p).length > 3, POL, { timeout: 60_000 });
  const step = (cmds: Command[], ticks = 1): Promise<void> =>
    page.evaluate(async ({ cmds, ticks }) => {
      const sim = window.__warsim!.sim;
      for (const c of cmds) sim.command(c);
      const tick = (await sim.step(ticks)).tick;
      await new Promise<void>((done) => {
        const wait = (): void => (window.__warsim!.view!.lastTick === tick ? done() : void setTimeout(wait, 5));
        wait();
      });
    }, { cmds, ticks });
  const selected = (): Promise<number[]> => page.evaluate(() => [...window.__warsim!.view!.selectedFormations]);
  const where = (id: number): Promise<{ nation: number; x: number; y: number } | undefined> =>
    page.evaluate(async (id) => (await window.__warsim!.sim.inspect(true)).formations.find((f) => f.id === id), id);

  await step([{ kind: 'setSetting', key: 'aiEnabled', value: false }]);
  await page.evaluate((p) => window.__warsim!.view!.select(p), POL);
  await page.getByTestId('take-control').click();
  await expect(page.getByTestId('player-label')).toContainText('Poland');

  // One Polish formation selected by a click on its marker, as in the test above.
  const unit = (await page.evaluate((p) => window.__warsim!.view!.formationsOf(p), POL))[0]!;
  const at = (await page.evaluate((id) => window.__warsim!.view!.formationPos(id), unit))!;
  await page.evaluate(([x, y]) => window.__warsim!.view!.controller.set({ cx: x, cy: y, scale: 16 }), at);
  await page.waitForTimeout(200);
  const picked = await page.evaluate((p) => window.__warsim!.view!.formationAt(700, 400, p), POL);
  expect(picked).not.toBe(0);
  await page.mouse.click(700, 400);
  await expect(page.getByTestId('player-label')).toContainText('1 selected');
  expect(await selected()).toEqual([picked]);

  // It goes, and a German division comes with its id, at home beside a German formation (on
  // Polish land it would march home of itself).
  const home = (await page.evaluate((g) => {
    const v = window.__warsim!.view!;
    return v.formationPos(v.formationsOf(g)[0]!);
  }, GER))!;
  await step([
    { kind: 'removeFormation', id: picked },
    { kind: 'spawnFormation', nation: GER, x: home[0], y: home[1], strength: 0, template: infantry },
  ]);
  const german = (await where(picked))!;
  expect(german.nation, 'the freed id is given to the German division').toBe(GER);
  expect.soft(await selected(), 'the selection after its formation is gone').toEqual([]);
  await expect.soft(page.getByTestId('player-label'), 'the bar after its formation is gone').toContainText('0 selected', { timeout: 5_000 });

  // A click on ground, on Polish land clear of markers: no order. The German division stands.
  expect(await page.evaluate((p) => window.__warsim!.view!.formationAt(540, 400, p), POL)).toBe(0);
  await page.mouse.click(540, 400);
  await step([], 24);
  const later = (await where(picked))!;
  expect([later.nation, later.x, later.y], 'the German division a day after the click on ground').toEqual([GER, german.x, german.y]);

  // A loaded world's formations are others too, with the same ids: a load empties the selection.
  await page.evaluate((p) => {
    const v = window.__warsim!.view!;
    const [cx, cy] = v.formationPos(v.formationsOf(p)[0]!)!;
    v.controller.set({ cx, cy, scale: 16 });
  }, POL);
  await page.waitForTimeout(200);
  await page.mouse.click(700, 400);
  await expect(page.getByTestId('player-label')).toContainText('1 selected');
  await page.evaluate(async () => {
    const sim = window.__warsim!.sim;
    await sim.load(await sim.save());
  });
  await expect(page.getByTestId('player-label'), 'the bar after a load').toContainText('0 selected', { timeout: 10_000 });
  expect(await selected(), 'the selection after a load').toEqual([]);
});
