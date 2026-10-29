import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import type { Command } from '../../src/shared/commands';
import { PLAYER_AI_DEFAULT } from '../../src/sim/ai/layers';
import { NATIONS_1938, TEMPLATES_LAND } from '../../src/sim/scenario1938';

// PLAN 1.33a AT: take control of Poland, order a move, and the formation moves. Selection is by a
// real click on the formation's marker and the order by a real click on the map. Since ADR-759
// control leaves the nation's AI on (the player's boxes, all but nuclear strikes at first); at
// peace its army's AI sends nothing, so Poland's other formations stay where they are.

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
  const assist = async () => {
    const i = await page.evaluate(() => window.__warsim!.sim.inspect());
    return { aiOff: i.nations.find((n) => n.id === POL)!.aiOff, player: i.settings.player, playerAi: i.playerAi };
  };
  await expect.poll(assist).toEqual({ aiOff: false, player: POL, playerAi: PLAYER_AI_DEFAULT });

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

  // Run two days: the ordered formation approaches the target; the others stay put (at peace).
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

  // Escape clears the selection; with none, it closes the nearest panel (PLAN 7.4f1): Poland's,
  // opened again to release control, which hands Poland back to its AI.
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('player-label')).toContainText('0 selected');
  await expect(page.getByTestId('release-control')).toHaveCount(0);
  await page.evaluate((p) => window.__warsim!.view!.select(p), POL);
  await page.getByTestId('release-control').click();
  await expect(page.getByTestId('player-label')).toHaveCount(0);
  await expect.poll(assist).toEqual({ aiOff: false, player: 0, playerAi: PLAYER_AI_DEFAULT });
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

// PLAN 7.4f23: as above, but the formation that takes the freed id is Poland's own. The nation
// is the player's, so the check of 2.16Rk lets it be; it is another division, which the player
// did not select (before: it stayed selected, ringed, and a click on ground ordered it to march).
test('the selection drops a formation that is gone, though one of its own nation has taken its id', async ({ page }) => {
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

  const ids = await page.evaluate((p) => window.__warsim!.view!.formationsOf(p), POL);
  const at = (await page.evaluate((id) => window.__warsim!.view!.formationPos(id), ids[0]!))!;
  await page.evaluate(([x, y]) => window.__warsim!.view!.controller.set({ cx: x, cy: y, scale: 16 }), at);
  await page.waitForTimeout(200);
  const picked = await page.evaluate((p) => window.__warsim!.view!.formationAt(700, 400, p), POL);
  expect(picked).not.toBe(0);
  await page.mouse.click(700, 400);
  await expect(page.getByTestId('player-label')).toContainText('1 selected');
  expect(await selected()).toEqual([picked]);

  // It goes, and a Polish division is raised in the same hour by another Polish formation: it has the id.
  const other = ids.find((id) => id !== picked)!;
  const home = (await page.evaluate((id) => window.__warsim!.view!.formationPos(id), other))!;
  await step([
    { kind: 'removeFormation', id: picked },
    { kind: 'spawnFormation', nation: POL, x: home[0], y: home[1], strength: 0, template: infantry },
  ]);
  const raised = (await where(picked))!;
  expect([raised.nation, raised.x, raised.y], 'the freed id is given to the new Polish division').toEqual([POL, home[0], home[1]]);
  expect.soft(await selected(), 'the selection after its formation is gone').toEqual([]);
  await expect.soft(page.getByTestId('player-label'), 'the bar after its formation is gone').toContainText('0 selected', { timeout: 5_000 });

  // A click on ground clear of markers: no order. The new division stands.
  await page.evaluate(([x, y]) => window.__warsim!.view!.controller.set({ cx: x, cy: y, scale: 16 }), at);
  await page.waitForTimeout(200);
  expect(await page.evaluate((p) => window.__warsim!.view!.formationAt(540, 400, p), POL)).toBe(0);
  await page.mouse.click(540, 400);
  await step([], 24);
  const later = (await where(picked))!;
  expect([later.nation, later.x, later.y], 'the new division a day after the click on ground').toEqual([POL, raised.x, raised.y]);
});

// The player's selection, seen and followed: a click that selects a formation has the camera
// follow it, as it marches too, until the user pans; its mark is a frame around its T1 marker
// far out and, close in, a frame around its elements that grows with the zoom.
test('a selected formation is marked at every zoom, and the camera follows it until a pan', async ({ page }, info) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 1400, height: 800 });
  await page.goto('/?scenario=1938&paused=1&seed=1938');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null, null, { timeout: 60_000 });
  await page.waitForFunction((p) => window.__warsim!.view!.formationsOf(p).length > 3, POL, { timeout: 60_000 });
  await page.evaluate((p) => window.__warsim!.view!.select(p), POL);
  await page.getByTestId('take-control').click();
  await expect(page.getByTestId('player-label')).toContainText('Poland');
  const out = info.outputPath();
  mkdirSync(out, { recursive: true });

  // Select by a click on a marker beside the middle of the view: the camera brings it to the middle.
  const unit = (await page.evaluate((p) => window.__warsim!.view!.formationsOf(p), POL))[0]!;
  const at = (await page.evaluate((id) => window.__warsim!.view!.formationPos(id), unit))!;
  await page.evaluate(([x, y]) => window.__warsim!.view!.controller.set({ cx: x - 5, cy: y, scale: 16 }), at);
  await page.waitForTimeout(200);
  const picked = await page.evaluate((p) => window.__warsim!.view!.formationAt(780, 400, p), POL);
  expect(picked).not.toBe(0);
  await page.mouse.click(780, 400);
  await expect(page.getByTestId('player-label')).toContainText('1 selected');
  expect(await page.evaluate(() => window.__warsim!.view!.controller.following)).toBe(true);
  const offMiddle = (): Promise<number> =>
    page.evaluate(() => {
      const v = window.__warsim!.view!;
      const p = v.followPoint()!;
      return Math.hypot(p[0] - v.controller.cam.cx, p[1] - v.controller.cam.cy) * v.controller.cam.scale;
    });
  await expect.poll(offMiddle, { timeout: 5_000 }).toBeLessThan(1);
  const far = await page.evaluate(() => window.__warsim!.view!.selectionMarks);
  expect(far.map((m) => m.kind)).toEqual(['marker']);
  await page.screenshot({ path: path.join(out, 'selected-far.png') });

  // Close in (100 m/px), zoomed by the wheel about a point off the middle: the follow keeps the
  // formation in the middle, and its mark is a frame around its elements, wider than the ring.
  const scale = await page.evaluate(() => window.__warsim!.view!.geo.kmPerCell * 10);
  await page.evaluate((s) => window.__warsim!.view!.controller.zoomTo(s, [300, 200]), scale);
  await page.waitForFunction(() => window.__warsim!.view!.selectionMarks.some((m) => m.kind === 'frame') && !window.__warsim!.view!.controller.animating, null, { timeout: 30_000 });
  expect(await page.evaluate(() => window.__warsim!.view!.controller.following)).toBe(true);
  await expect.poll(offMiddle, { timeout: 5_000 }).toBeLessThan(1);
  const frame = (await page.evaluate(() => window.__warsim!.view!.selectionMarks.find((m) => m.kind === 'frame')))!;
  expect(frame.y1 - frame.y0, 'the frame is taller than the marker box').toBeGreaterThan(far[0]!.y1 - far[0]!.y0);
  expect(frame.x0 < 700 && frame.x1 > 700 && frame.y0 < 400 && frame.y1 > 400, 'the frame is around the middle of the view').toBe(true);
  await page.screenshot({ path: path.join(out, 'selected-close.png') });

  // It marches (ordered by a command: a click close in is a few hundred metres off); a day on,
  // the camera has come with it.
  const before = await page.evaluate(() => [window.__warsim!.view!.controller.cam.cx, window.__warsim!.view!.controller.cam.cy]);
  await page.evaluate(([id, x, y, n]) => window.__warsim!.sim.command({ kind: 'moveFormation', id: id!, x: x! - 8, y: y!, nation: n! }), [picked, at[0], at[1], POL]);
  await page.evaluate(() => window.__warsim!.sim.step(24));
  await page.waitForFunction(() => window.__warsim!.view!.lastTick >= 24, null, { timeout: 30_000 });
  expect(await page.evaluate(() => window.__warsim!.view!.controller.following), 'still following after the march').toBe(true);
  await expect.poll(offMiddle, { timeout: 10_000 }).toBeLessThan(1);
  const after = await page.evaluate(() => [window.__warsim!.view!.controller.cam.cx, window.__warsim!.view!.controller.cam.cy]);
  expect(Math.hypot(after[0]! - before[0]!, after[1]! - before[1]!), 'the camera moved with the march, cells').toBeGreaterThan(0.5);
  // Close in, its order arrow is drawn too (the markers draw it far out), from where it is drawn.
  await expect.poll(() => page.evaluate((id) => window.__warsim!.view!.orderLineIds.includes(id), picked)).toBe(true);
  await page.screenshot({ path: path.join(out, 'marching-close.png') });

  // A drag of the map is the user's pan: the follow ends, and the camera stays where it was put.
  await page.mouse.move(400, 300);
  await page.mouse.down();
  await page.mouse.move(460, 330, { steps: 5 });
  await page.mouse.up();
  expect(await page.evaluate(() => window.__warsim!.view!.controller.following)).toBe(false);
  await expect(page.getByTestId('player-label')).toContainText('1 selected');
});
