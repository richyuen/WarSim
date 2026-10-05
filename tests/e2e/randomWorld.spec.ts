import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import presetsJson from '../../data/flags/presets.json' with { type: 'json' };
import type {} from '../../src/app/testApi';
import type { FlagPresets } from '../../src/shared/flags';
import { foundedFlag, specToPixels } from '../../src/shared/flagPixels';
import type { Inspection } from '../../src/shared/protocol';
import { decodeScenarioFile } from '../../src/shared/scenarioFile';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { assets1938 } from '../helpers/earth';

// PLAN 2.16d AT (critic R2-B7): from the title screen a game starts on a random world with a
// chosen number of nations: the same seed gives the same world (hash); every nation has a name,
// a flag and a capital. And what 2.16a and 2.16c left untried: a scenario file exported from a
// random world and loaded again, a continue URL without the number, and the range said once.

const { w: W } = SIZE_1938;
const PRESETS = presetsJson.presets as unknown as FlagPresets;
const NATIONS = 40;
const SEED = 11;

const evidence = (info: { outputPath: () => string }): string => {
  const out = process.env['EVIDENCE'] ? path.resolve(import.meta.dirname, '../../docs/evidence/2.16') : info.outputPath();
  mkdirSync(out, { recursive: true });
  return out;
};
const ready = (page: Page): Promise<unknown> =>
  page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null && window.__warsim!.view!.nationName(1) !== null, null, { timeout: 60_000 });

/** Starts a random world from the title screen and waits for its first frames. */
async function startFromTitle(page: Page, nations: number, seed: number): Promise<void> {
  await page.goto('/');
  await page.getByTestId('title-scenario-random').click();
  await page.getByTestId('settings-nations').fill(String(nations));
  await page.getByTestId('settings-seed').fill(String(seed));
  await Promise.all([page.waitForURL(/scenario=random/), page.getByTestId('settings-new-game').click()]);
  await ready(page);
}

/**
 * What the page knows of each nation: who holds the ground at its capital, its flag, its name on
 * the map. A city's position is its true one, which on a coast can lie in a cell of sea: the
 * holders are those of that cell and the eight around it (the unit test of 2.16a has the cell).
 */
function seen(page: Page, world: Inspection): Promise<{ id: number; holders: number[]; flag: number[]; label: string | null }[]> {
  const capitals = world.cities.filter((c) => c.capitalOf !== 0).map((c) => ({ id: c.capitalOf, x: Math.floor(c.x), y: Math.floor(c.y) }));
  return page.evaluate(
    ({ capitals, w }) => {
      const v = window.__warsim!.view!;
      const grid = (v as unknown as { controlGrid: Uint16Array }).controlGrid;
      const around = (x: number, y: number): number[] => [-1, 0, 1].flatMap((dy) => [-1, 0, 1].map((dx) => grid[(y + dy) * w + ((x + dx + w) % w)] ?? 0));
      return capitals.map((c) => ({ id: c.id, holders: around(c.x, c.y), flag: [...v.flags.pixelsOf(c.id)], label: v.nationName(c.id) }));
    },
    { capitals, w: W },
  );
}

test('a random world from the title screen: every nation has a name, a flag and a capital; the same seed gives the same world', async ({ page }, info) => {
  test.setTimeout(300_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1400, height: 800 });

  // The title screen says the range once: among the scenario's facts, not again beside the field.
  await page.goto('/');
  await page.getByTestId('title-scenario-random').click();
  await expect(page.getByTestId('title-nations')).toHaveText('2 to 200');
  await expect(page.getByText('2 to 200')).toHaveCount(1);

  await startFromTitle(page, NATIONS, SEED);
  for (const p of [`seed=${SEED}`, `nations=${NATIONS}`]) expect(page.url()).toContain(p);
  const world: Inspection = await page.evaluate(() => window.__warsim!.sim.inspect(true));
  const living = world.nations.filter((n) => n.living);
  expect(world.tick).toBe(0);
  expect(world.seed).toBe(SEED);
  expect(living.length).toBe(NATIONS);
  expect(world.nations.length).toBe(NATIONS);

  // A name each: its own, a literal, and no two the same.
  for (const n of living) expect(n.name, `nation ${n.id}`).toMatch(/^=\p{L}/u);
  expect(living.filter((n) => /^=Free state \d+$/.test(n.name)).map((n) => n.name)).toEqual([]);
  expect(new Set(living.map((n) => n.name)).size).toBe(NATIONS);

  // A capital each, on land it holds; a flag each, made from its id and colour (no nation of
  // this world has a flag in any table); and its name on the map.
  const capitals = world.cities.filter((c) => c.capitalOf !== 0);
  expect(capitals.map((c) => c.capitalOf).sort((a, b) => a - b)).toEqual(living.map((n) => n.id));
  const page1 = await seen(page, world);
  const flags = new Set<string>();
  for (const n of living) {
    const s = page1.find((p) => p.id === n.id)!;
    expect(s.holders, `the capital of ${n.name}`).toContain(n.id);
    expect(s.flag, `the flag of ${n.name}`).toEqual([...specToPixels(foundedFlag(n.id, n.color), PRESETS)]);
    expect(s.label, `the name of nation ${n.id} on the map`).toBe(n.name.slice(1));
    expect(n.cells, n.name).toBeGreaterThan(0);
    expect(n.formations, n.name).toBeGreaterThan(0);
    flags.add(s.flag.join());
  }
  expect(flags.size).toBe(NATIONS); // no two fly the same

  // The world Node builds from that seed and number.
  const node = new Sim({ scenario: 'random', seed: SEED, options: { nations: NATIONS }, assets: assets1938(W) });
  const first = await page.evaluate(() => window.__warsim!.sim.hash());
  expect(first.hash).toBe(node.hash());
  await page.waitForTimeout(500); // let the first frames draw
  const out = evidence(info);
  await page.screenshot({ path: path.join(out, 'random-40-world.png') });

  // Flags stand at the capitals: closer in, over the nation with the most land, its own is drawn.
  const big = [...living].sort((a, b) => b.cells - a.cells)[0]!;
  const cap = capitals.find((c) => c.capitalOf === big.id)!;
  for (const scale of [6, 24]) {
    await page.evaluate(({ x, y, scale }) => window.__warsim!.view!.controller.set({ cx: x, cy: y, scale }), { x: cap.x, y: cap.y, scale });
    await expect.poll(() => page.evaluate((id) => (window.__warsim!.view!.draw(), window.__warsim!.view!.flagRects.some((f) => f.id === id && f.alpha > 0.9)), big.id), { message: `${scale} px` }).toBe(true);
    await page.waitForTimeout(700); // names and counters settle
    await page.screenshot({ path: path.join(out, `random-40-${scale}px.png`) });
  }

  // A month of it in the page is the month Node runs.
  node.step(24 * 30);
  const month = await page.evaluate(() => window.__warsim!.sim.step(24 * 30));
  expect(month).toEqual({ tick: 24 * 30, hash: node.hash() });

  // The same seed and number again: the same world. Another seed: another.
  await startFromTitle(page, NATIONS, SEED);
  expect(await page.evaluate(() => window.__warsim!.sim.hash())).toEqual(first);
  await startFromTitle(page, NATIONS, SEED + 1);
  const other: Inspection = await page.evaluate(() => window.__warsim!.sim.inspect());
  expect((await page.evaluate(() => window.__warsim!.sim.hash())).hash).not.toBe(first.hash);
  expect(other.nations.map((n) => n.name)).not.toEqual(world.nations.map((n) => n.name));
  expect(errors).toEqual([]);
});

test('a scenario file exported from a random world loads again from the title screen', async ({ page }, info) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1400, height: 800 });
  await page.goto(`/?scenario=random&paused=1&seed=${SEED}&nations=24`);
  await ready(page);
  await page.evaluate(() => {
    window.__warsim!.sim.command({ kind: 'renameNation', nation: 1, name: 'Lyonesse' }, true);
    return window.__warsim!.sim.step(24 * 10);
  });
  const before: Inspection = await page.evaluate(() => window.__warsim!.sim.inspect(true));
  const flag1 = (await seen(page, before)).find((p) => p.id === 1)!.flag;

  await page.getByTestId('editor-btn').click();
  await page.getByTestId('scenario-name').fill('Random 24');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('scenario-export').click()]);
  const file = path.join(info.outputPath(), dl.suggestedFilename());
  await dl.saveAs(file);
  const { header } = await decodeScenarioFile(new Uint8Array(readFileSync(file)));
  expect(header).toMatchObject({ name: 'Random 24', base: 'random', w: 2048, h: 1024 });

  // From the title screen: the game of the random world starts with the file's state, its
  // names and its made flags, and its new-game form has the number of nations the world has.
  await page.goto('/');
  await Promise.all([page.waitForURL(/load=scenario/), page.getByTestId('title-scenario-file').setInputFiles(file)]);
  expect(page.url()).toContain('scenario=random');
  await ready(page);
  await page.waitForFunction((tick) => window.__warsim!.hud.tick.value === tick, header.tick, { timeout: 30_000 });
  expect(await page.evaluate(() => window.__warsim!.sim.hash())).toEqual({ tick: header.tick, hash: header.hash });
  const after: Inspection = await page.evaluate(() => window.__warsim!.sim.inspect(true));
  expect(after.seed).toBe(SEED);
  expect(after.nations.map((n) => n.name)).toEqual(before.nations.map((n) => n.name));
  expect(after.nations[0]!.name).toBe('=Lyonesse');
  expect(after.rasters).toEqual(before.rasters);
  const loaded = await seen(page, after);
  expect(loaded.find((p) => p.id === 1)!.flag).toEqual(flag1);
  expect(flag1).toEqual([...specToPixels(foundedFlag(1, after.nations[0]!.color), PRESETS)]);
  await expect.poll(() => page.evaluate(() => window.__warsim!.view!.nationName(1))).toBe('Lyonesse');
  await page.getByTestId('settings-btn').click();
  await expect(page.getByTestId('settings-nations')).toHaveValue(String(after.nations.filter((n) => n.living).length));
  await expect(page.getByTestId('settings-nations-range')).toHaveText('2 to 200');
  await page.getByTestId('settings-close').click();
  await page.waitForTimeout(500); // let the first frames draw
  await page.screenshot({ path: path.join(evidence(info), 'random-24-from-file.png') });
  expect(errors).toEqual([]);
});

test('a continue URL without the number of nations: the new-game form has the number the saved world has', async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1400, height: 800 });
  await page.goto('/?scenario=random&paused=1&seed=7&nations=24');
  await ready(page);
  const left = await page.evaluate(async () => {
    const at = await window.__warsim!.sim.step(48);
    await window.__warsim!.autosave.saveNow();
    return at;
  });
  await page.goto('/?scenario=random&paused=1&seed=7&continue=1');
  await ready(page);
  await page.waitForFunction(() => window.__warsim!.hud.tick.value === 48, null, { timeout: 30_000 });
  expect(await page.evaluate(() => window.__warsim!.sim.hash())).toEqual(left);
  await page.getByTestId('settings-btn').click();
  await expect(page.getByTestId('settings-nations')).toHaveValue('24');

  // The save made from here keeps the number, as the title screen's Continue needs it.
  await page.evaluate(() => window.__warsim!.autosave.saveNow());
  await page.goto('/');
  await Promise.all([page.waitForURL(/continue=1/), page.getByTestId('title-continue').click()]);
  expect(page.url()).toContain('nations=24');
});
