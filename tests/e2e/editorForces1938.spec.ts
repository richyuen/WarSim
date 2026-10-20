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
  // Britain has strategic bombers: no word that it cannot use them.
  await expect(page.getByTestId('editor-no-delivery')).toHaveCount(0);

  // PLAN 7.18b (critic R8-B1: "let warheads placed by the editor … be used by a desperate holder, or
  // say in the editor why they will not be"): Poland has no strategic bomber and no missiles in 1938.
  await page.getByTestId('editor-nation').selectOption(String(id('POL')));
  await page.getByTestId('editor-warheads').fill('3');
  await page.getByTestId('editor-warheads-add').click();
  await expect(page.getByTestId('editor-no-delivery')).toContainText('Poland cannot use them: it has no strategic bomber group at an airbase and no ballistic missiles');
  await page.getByTestId('editor-panel').screenshot({ path: path.resolve('docs/evidence/7.18/b-editor-no-delivery.png') });
  await page.getByTestId('editor-nation').selectOption(String(ENG));

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

// PLAN 7.37b2 (critic runs 9 and 10, `c10_g2_5309_CZS.json`: "the editor says only 'Czechoslovakia
// has 10 warheads'"): Czechoslovakia given a strategic bomber group at Prague and 10 warheads. The
// editor says how it would deliver them: the group, and Prague's airbase where it is kept.
test("the editor names a holder's means: Czechoslovakia's bomber group at Prague (PLAN 7.37b2)", async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1400, height: 800 });
  await page.goto('/?scenario=1938&paused=1&seed=5309');
  await ready(page);
  const CZS = id('CZS');
  await page.getByTestId('editor-btn').click();
  await page.getByTestId('editor-nation').selectOption(String(CZS));
  const before = await forces(page, CZS);
  await page.getByTestId('editor-tool-wing').click();
  await page.getByTestId('editor-template').selectOption({ label: 'Strategic bomber group' });
  await centre(page, 14.42, 50.08);
  await page.mouse.click(700, 400);
  await expect.poll(async () => (await forces(page, CZS)).wings).toBe(before.wings + 1);
  await page.getByTestId('editor-warheads').fill('10');
  await page.getByTestId('editor-warheads-add').click();
  await expect.poll(() => warheadsOf(page, CZS)).toBe(10);
  await expect(page.getByTestId('editor-means')).toHaveText('Czechoslovakia delivers them by its strategic bomber group at Prague; while it holds a warhead that group is kept for them.');
  await expect(page.getByTestId('editor-no-delivery')).toHaveCount(0);
  await page.getByTestId('editor-panel').screenshot({ path: path.resolve('docs/evidence/7.37/b2-editor-means.png') });
});

// PLAN 7.22c (critic run 8, naval 6: "placed fleets wander away at once: the North Sea point was
// empty on day 3", `critic/shots/c8g_5591_21_northsea_day3_30m.png`): the critic's standoff. Two
// German and two British battle squadrons placed by clicks in the North Sea, the scenario exported
// and started from the title, Germany at war with Britain, the AI on: on day 3 Britain's pair is at
// its places (Germany's met the Home Fleet; a fleet beaten lets go of its place, `fleetStation1938`).
test("the critic's North Sea standoff: fleets placed in the editor hold their places into the war (PLAN 7.22c)", async ({ page }, info) => {
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 1400, height: 800 });
  await page.goto('/?scenario=1938&paused=1&seed=5591');
  await ready(page);
  const ids = async (): Promise<number[]> => (await page.evaluate(() => window.__warsim!.sim.inspect(true))).formations.map((f) => f.id);
  const before = new Set(await ids());
  await page.getByTestId('editor-btn').click();
  await page.getByTestId('editor-tool-fleet').click();
  await page.getByTestId('editor-template').selectOption({ label: 'Battle squadron' });
  // The critic's North Sea point (`critic/c6_cells.json`) and its four places about it.
  const [nx, ny] = [1046.76, 248.13];
  const places = [
    [GER, nx + 8, ny + 2],
    [GER, nx + 6, ny + 4],
    [ENG, nx - 2, ny],
    [ENG, nx, ny - 3],
  ] as const;
  for (const [n, x, y] of places) {
    await page.getByTestId('editor-nation').selectOption(String(n));
    await page.evaluate(({ x, y }) => window.__warsim!.view!.controller.set({ cx: x, cy: y, scale: 3 }), { x, y });
    await page.waitForTimeout(200);
    const had = (await ids()).length;
    await page.mouse.click(700, 400);
    await expect.poll(async () => (await ids()).length).toBe(had + 1);
  }
  const placed = (await ids()).filter((f) => !before.has(f));
  expect(placed).toHaveLength(4);
  const at = await page.evaluate(async (placed) => {
    const s = await window.__warsim!.sim.inspect(true);
    return placed.map((id) => {
      const f = s.formations.find((f) => f.id === id)!;
      return { id, nation: f.nation, x: f.x, y: f.y };
    });
  }, placed);

  // Shared: exported, then started from the title screen.
  await page.getByTestId('scenario-name').fill('North Sea standoff');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('scenario-export').click()]);
  const file = path.join(info.outputPath(), dl.suggestedFilename());
  await dl.saveAs(file);
  await page.goto('/');
  await page.getByTestId('title-scenario-file').setInputFiles(file);
  await Promise.all([page.waitForURL(/load=scenario/), page.getByTestId('title-file-start').click()]);
  await ready(page);

  // Germany declares war on Britain; three days of the AI's war.
  await page.evaluate(([g, e]) => window.__warsim!.sim.command({ kind: 'declareWar', attacker: g!, defender: e! }), [GER, ENG]);
  await page.evaluate(async () => {
    const { sim, view } = window.__warsim!;
    const t = (await sim.step(3 * 24)).tick;
    await new Promise<void>((done) => {
      const wait = (): void => (view!.lastTick >= t ? done() : void setTimeout(wait, 10));
      wait();
    });
  });
  const now = await page.evaluate(async (placed) => {
    const s = await window.__warsim!.sim.inspect(true);
    return placed.map((id) => {
      const f = s.formations.find((f) => f.id === id);
      return f ? { id, x: f.x, y: f.y } : null;
    });
  }, placed);
  const offBy = at.map((a, i) => (now[i] ? Math.max(Math.abs(now[i]!.x - a.x), Math.abs(now[i]!.y - a.y)) : Infinity));
  console.log(`day 3 of the war: the placed fleets ${at.map((a, i) => `${a.id} (${a.nation === GER ? 'German' : 'British'}) ${Number.isFinite(offBy[i]!) ? `${offBy[i]!.toFixed(1)} cells off` : 'gone'}`).join(', ')}`);
  for (const [i, a] of at.entries()) {
    if (a.nation !== ENG) continue;
    expect(offBy[i], `British fleet ${a.id} at its place on day 3`).toBeLessThanOrEqual(3);
  }
  // The critic's view of the day: the British pair's point at 30 m/px.
  const [bx, by] = [(at[2]!.x + at[3]!.x) / 2, (at[2]!.y + at[3]!.y) / 2];
  await page.evaluate(({ x, y }) => {
    const v = window.__warsim!.view!;
    v.controller.set({ cx: x, cy: y, scale: (v.metresPerPx * v.controller.cam.scale) / 300 });
  }, { x: bx, y: by });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.resolve('docs/evidence/7.22/c-northsea-day3-300m.png') });
  await page.evaluate(({ x, y }) => {
    const v = window.__warsim!.view!;
    v.controller.set({ cx: x, cy: y, scale: (v.metresPerPx * v.controller.cam.scale) / 30 });
  }, { x: at[2]!.x, y: at[2]!.y });
  await page.waitForFunction(() => window.__warsim!.view!.individualCount > 0, null, { timeout: 15_000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.resolve('docs/evidence/7.22/c-northsea-day3-30m.png') });
});

// PLAN 7.24b (critic run 8, aircraft 6: "the editor refuses a Polish bomber group at Warsaw",
// `critic/c8_g_5591.json`): the critic's clicks. The camera on Warsaw at 2,000 m/px in a 1600 × 900
// view, the click at (700, 450), 100 px west of the middle: on Poland's land, the group goes to the
// airbase of Warsaw. A Polish group clicked in Berlin is refused, and the editor names the nearest
// airbase of Poland's with room and how far it is.
test("the critic's Polish bomber group at Warsaw is placed; one clicked in Berlin is refused with the base it needs (PLAN 7.24b)", async ({ page }, info) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto('/?scenario=1938&paused=1&seed=5591');
  await ready(page);
  const POL = id('POL');
  const before = await forces(page, POL);
  await page.getByTestId('editor-btn').click();
  await page.getByTestId('editor-nation').selectOption(String(POL));
  await page.getByTestId('editor-tool-wing').click();
  await page.getByTestId('editor-template').selectOption({ label: 'Strategic bomber group' });
  const lookAt = async (lon: number, lat: number, m: number): Promise<void> => {
    const [x, y] = cellOf(lon, lat, W, H);
    await page.evaluate(({ x, y, m }) => {
      const v = window.__warsim!.view!;
      v.controller.set({ cx: x, cy: y, scale: (v.metresPerPx * v.controller.cam.scale) / m });
    }, { x, y, m });
    await page.waitForTimeout(400);
  };
  await lookAt(20.9981, 52.2519, 2000);
  await page.mouse.click(700, 450);
  await expect.poll(async () => (await forces(page, POL)).wings).toBe(before.wings + 1);
  await expect(page.getByTestId('editor-refusal')).toHaveCount(0);
  const out = process.env['EVIDENCE'] !== undefined ? path.resolve('docs/evidence/7.24') : info.outputPath();
  await page.screenshot({ path: path.join(out, 'b-editor-warsaw-placed.png') });

  // In Berlin: refused, Warsaw named.
  await lookAt(13.4, 52.52, 2000);
  await page.mouse.click(800, 450);
  await expect(page.getByTestId('editor-refusal')).toContainText('no airbase of its with room is near the place');
  await expect(page.getByTestId('editor-refusal-base')).toHaveText(/^The nearest airbase of Poland with room for it: Warsaw, (4[5-9]\d|5\d\d) km away\. Click there\.$/);
  expect((await forces(page, POL)).wings).toBe(before.wings + 1);
  await page.getByTestId('editor-panel').screenshot({ path: path.join(out, 'b-editor-refusal-base.png') });
  // Another nation chosen: the words were Poland's, and go.
  await page.getByTestId('editor-nation').selectOption(String(GER));
  await expect(page.getByTestId('editor-refusal')).toHaveCount(0);
});
