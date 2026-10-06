import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import { EventKind } from '../../src/shared/events';
import type { Inspection } from '../../src/shared/protocol';
import { cellOf } from '../../src/sim/data/terrain';
import { NATIONS_1938, SIZE_1938 } from '../../src/sim/scenario1938';
import { KILL_STATES } from '../../src/sim/systems/revival';

// PLAN 1.32b AT: every God action is driven through the God tab of the nation panel (and its map
// tools), and its effect is read back via `sim.inspect()`. Paused: commands apply at once.

const { w: W, h: H } = SIZE_1938;
const id = (tag: string): number => NATIONS_1938.findIndex((n) => n.tag === tag) + 1;
const inspect = (page: Page): Promise<Inspection> => page.evaluate(() => window.__warsim!.sim.inspect());
const nation = (s: Inspection, n: number) => s.nations.find((x) => x.id === n)!;
const atWar = (s: Inspection, a: number, b: number): boolean => s.wars.some((w) => (w.attackers.includes(a) && w.defenders.includes(b)) || (w.attackers.includes(b) && w.defenders.includes(a)));

/** Centres the camera on (lon, lat) at `scale` and returns the screen centre. */
async function lookAt(page: Page, lon: number, lat: number, scale = 8): Promise<void> {
  const [x, y] = cellOf(lon, lat, W, H);
  await page.evaluate(({ x, y, scale }) => window.__warsim!.view!.controller.set({ cx: x, cy: y, scale }), { x, y, scale });
  await page.waitForTimeout(150);
}

test('God Mode through the UI: every action reaches the sim', async ({ page }, info) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1400, height: 800 });
  await page.goto('/?scenario=1938&paused=1&seed=1938');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null, null, { timeout: 60_000 });
  await page.waitForFunction(() => window.__warsim!.sim.mapLayers !== null, null, { timeout: 60_000 });
  const GER = id('GER');

  // God Mode on; select Germany with a map click; open the God tab.
  await page.getByTestId('god-btn').click();
  await expect(page.getByTestId('god-btn')).toHaveAttribute('aria-pressed', 'true');
  await lookAt(page, 10.5, 51);
  await page.mouse.click(700, 400);
  await expect(page.getByTestId('nation-panel')).toHaveAttribute('data-nation', String(GER));
  await page.getByTestId('tab-god').click();
  await expect(page.getByTestId('panel-god')).toBeVisible();

  // Rename.
  await page.getByTestId('god-rename-input').fill('Greater Ostmark');
  await page.getByTestId('god-rename').click();
  await expect.poll(async () => nation(await inspect(page), GER).name).toBe('=Greater Ostmark');
  await expect(page.getByTestId('nation-name')).toHaveText('Greater Ostmark');
  // The curved map label follows the rename too (labels re-derive on renames, not only on control).
  await expect.poll(() => page.evaluate(() => (window.__warsim!.view!.draw(), window.__warsim!.view!.nationLabels.map((l) => l.text)))).toContain('Greater Ostmark');

  // Income bonus +10.
  const bonus = nation(await inspect(page), GER).incomeBonus;
  await page.getByTestId('god-bonus-up').click();
  await expect.poll(async () => nation(await inspect(page), GER).incomeBonus).toBe(bonus + 10);
  await expect(page.getByTestId('god-bonus')).toHaveText(`${bonus + 10}%`);

  // AI per nation and world AI.
  await page.getByTestId('god-ai').uncheck();
  await expect.poll(async () => nation(await inspect(page), GER).aiOff).toBe(true);
  await page.getByTestId('god-world-ai').uncheck();
  await expect.poll(async () => (await inspect(page)).settings.aiEnabled).toBe(false);

  // War on Poland, then peace from the war's row.
  await page.getByTestId('god-target').selectOption(String(id('POL')));
  await page.getByTestId('god-war').click();
  await expect.poll(async () => atWar(await inspect(page), GER, id('POL'))).toBe(true);
  const war = (await inspect(page)).wars.find((w) => w.attackers.includes(GER) && w.defenders.includes(id('POL')))!;
  await page.getByTestId(`god-peace-${war.id}`).click();
  await expect.poll(async () => atWar(await inspect(page), GER, id('POL'))).toBe(false);
  // The UI follows at once (paused God actions skip the 1 Hz stats throttle).
  await expect(page.getByTestId(`god-peace-${war.id}`)).toHaveCount(0, { timeout: 2_000 });

  // Ally: Hungary joins Germany's alliance; puppet: Lithuania becomes Germany's puppet.
  await page.getByTestId('god-target').selectOption(String(id('HUN')));
  await page.getByTestId('god-ally').click();
  await expect.poll(async () => nation(await inspect(page), id('HUN')).alliance?.leader).toBe(nation(await inspect(page), GER).alliance?.leader);
  await page.getByTestId('god-target').selectOption(String(id('LIT')));
  await page.getByTestId('god-puppet').click();
  await expect.poll(async () => nation(await inspect(page), id('LIT')).overlord).toBe(GER);

  // Buff.
  await page.getByTestId('god-buff-kind').selectOption('defense');
  await page.getByTestId('god-buff').click();
  await expect.poll(async () => (await inspect(page)).buffs.some((b) => b.target === GER && b.kind === 'defense')).toBe(true);

  const out = process.env['EVIDENCE'] ? path.resolve(import.meta.dirname, '../../docs/evidence/1.32') : info.outputPath();
  mkdirSync(out, { recursive: true });
  await page.screenshot({ path: path.join(out, 'god-tab.png') });

  // Map tool: revolt in the clicked province (Bavaria); the click does not change the selection.
  const before = await inspect(page);
  await page.getByTestId('god-tool-revolt').click();
  await expect(page.getByTestId('god-tool-hint')).toBeVisible();
  await lookAt(page, 11.6, 48.1);
  await page.mouse.click(700, 400);
  await expect.poll(async () => (await inspect(page)).nations.filter((n) => n.living && !before.nations.some((b) => b.id === n.id && b.living)).length).toBe(1);
  await expect(page.getByTestId('nation-panel')).toHaveAttribute('data-nation', String(GER));
  await expect(page.getByTestId('god-tool-hint')).toHaveCount(0); // one-shot tool

  // Map tool: breakthrough from two clicks.
  const corridors = (await inspect(page)).corridors;
  await page.getByTestId('god-tool-battle').click();
  await lookAt(page, 13.4, 52.5);
  await page.mouse.click(650, 400);
  await page.mouse.click(760, 400);
  await expect.poll(async () => (await inspect(page)).corridors).toBe(corridors + 1);

  // Map tool: territory brush paints Polish land for Germany (until switched off).
  await page.getByTestId('god-tool-brush').click();
  await lookAt(page, 19.5, 52);
  await page.mouse.click(700, 400);
  await expect.poll(() => page.evaluate(() => window.__warsim!.view!.nationAt(700, 400))).toBe(GER);
  await page.getByTestId('god-tool-brush').click();
  await expect(page.getByTestId('god-tool-hint')).toHaveCount(0);

  // Revive dead Ethiopia from the dropdown.
  await page.getByTestId('god-revive-target').selectOption(String(id('ETH')));
  await page.getByTestId('god-revive').click();
  await expect.poll(async () => nation(await inspect(page), id('ETH')).living).toBe(true);

  // Kill Yugoslavia: the first click only arms the button.
  await page.evaluate((y) => window.__warsim!.view!.select(y), id('YUG'));
  await expect(page.getByTestId('nation-panel')).toHaveAttribute('data-nation', String(id('YUG')));
  await page.getByTestId('tab-god').click();
  await page.getByTestId('god-kill').click();
  expect(nation(await inspect(page), id('YUG')).living).toBe(true);
  await page.getByTestId('god-kill').click();
  await expect.poll(async () => nation(await inspect(page), id('YUG')).living).toBe(false);

  // God Mode off: the God tab disappears.
  await page.getByTestId('god-btn').click();
  await expect(page.getByTestId('tab-god')).toHaveCount(0);
});

// PLAN 2.15a (ADR-99; critic R2-B6): a Kill of France through the God tab made 103 living nations
// 139 and left 40 wars. It founds a stated few, and nobody goes to war over it.
test('Kill through the God tab: a few new nations, no new war', async ({ page }, info) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1400, height: 800 });
  await page.goto('/?scenario=1938&paused=1&seed=1938');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null, null, { timeout: 60_000 });
  await page.waitForFunction(() => window.__warsim!.sim.mapLayers !== null, null, { timeout: 60_000 });
  const FRA = id('FRA');
  const before = await inspect(page);
  const living = (s: Inspection): number[] => s.nations.filter((n) => n.living).map((n) => n.id);

  await page.getByTestId('god-btn').click();
  await page.evaluate((f) => window.__warsim!.view!.select(f), FRA);
  await expect(page.getByTestId('nation-panel')).toHaveAttribute('data-nation', String(FRA));
  await page.getByTestId('tab-god').click();
  await page.getByTestId('god-kill').click();
  await page.getByTestId('god-kill').click();
  await expect.poll(async () => nation(await inspect(page), FRA).living).toBe(false);

  const after = await inspect(page);
  const born = living(after).filter((n) => !living(before).includes(n));
  expect(born.length).toBeGreaterThanOrEqual(1);
  expect(born.length).toBeLessThanOrEqual(KILL_STATES);
  expect(nation(after, FRA).cells).toBe(0);
  expect(after.wars.filter((w) => !before.wars.some((b) => b.id === w.id))).toEqual([]);
  // The new nations hold most of what France held; the rest went to its neighbours.
  const land = born.reduce((a, n) => a + nation(after, n).cells, 0);
  expect(land).toBeGreaterThan(nation(before, FRA).cells * 0.9);
  console.log(`Kill of France: ${living(before).length} -> ${living(after).length} living, ${born.length} founded (${born.map((n) => `${nation(after, n).name} ${nation(after, n).cells}`).join('; ')}), ${before.wars.length} -> ${after.wars.length} wars`);

  // Each of them flies a flag of its own, of two colours or more, with its colour on it (PLAN
  // 2.15c): they flew a plain one. The view knows the colour from the first snapshot after.
  const flagOf = (n: number): Promise<number[]> => page.evaluate((id) => [...new Set(window.__warsim!.view!.flags.pixelsOf(id))], n);
  const flags: number[][] = [];
  for (const n of born) {
    await expect.poll(async () => (await flagOf(n)).includes(nation(after, n).color), `nation ${n}: its colour on its flag`).toBe(true);
    flags.push(await flagOf(n));
    expect(flags.at(-1)!.length, `nation ${n}: the colours of its flag`).toBeGreaterThanOrEqual(2);
  }
  console.log(`their flags: ${born.map((n, i) => `${nation(after, n).name} ${flags[i]!.length} colours`).join('; ')}`);

  const out = process.env['EVIDENCE'] ? path.resolve(import.meta.dirname, '../../docs/evidence/2.15') : info.outputPath();
  mkdirSync(out, { recursive: true });

  // The history (PLAN 2.15d): a revolt for each nation founded and no other; the land that went
  // to a nation already there is "handed over", with a filter of its own. It read "Italy broke
  // away from France".
  const rows = await page.evaluate(() => window.__warsim!.sim.history());
  const revolts = rows.filter((r) => r.kind === EventKind.RevoltSpawned);
  const ceded = rows.filter((r) => r.kind === EventKind.LandCeded);
  expect(revolts.map((r) => r.a).sort((a, b) => a - b)).toEqual([...born].sort((a, b) => a - b));
  expect(ceded.length).toBeGreaterThanOrEqual(1);
  expect(ceded.every((r) => r.b === FRA)).toBe(true);
  const gained = living(before).filter((n) => n !== FRA && nation(after, n).cells > nation(before, n).cells);
  expect([...new Set(ceded.map((r) => r.a))].filter((n) => living(before).includes(n)).sort((a, b) => a - b)).toEqual(gained.sort((a, b) => a - b));
  await page.getByTestId('history-btn').click();
  await expect(page.getByTestId('history-panel')).toBeVisible();
  await page.getByTestId('history-kind').selectOption({ label: 'Land handed over' });
  await expect(page.getByTestId('history-row')).toHaveCount(ceded.length);
  const texts = await page.getByTestId('history-row').allInnerTexts();
  for (const t of texts) expect(t).toMatch(/Land of France went over to \S/);
  await page.getByTestId('history-kind').selectOption({ label: 'Revolt' });
  await expect(page.getByTestId('history-row')).toHaveCount(born.length);
  for (const t of await page.getByTestId('history-row').allInnerTexts()) expect(t).toMatch(/^.*Free .+ broke away from France$/s);
  await page.getByTestId('history-kind').selectOption('');
  await page.getByTestId('history-panel').screenshot({ path: path.join(out, 'kill-france-history.png') });
  console.log(`history: ${texts.map((t) => t.replace(/\s+/g, ' ')).join(' | ')}`);
  await page.getByTestId('history-close').click();

  // The panel of one of them: its flag beside its name.
  await page.evaluate((n) => window.__warsim!.view!.select(n), born[0]!);
  await expect(page.getByTestId('nation-panel')).toHaveAttribute('data-nation', String(born[0]!));
  await page.getByTestId('nation-panel').screenshot({ path: path.join(out, 'founded-flag-panel.png') });
  await page.evaluate(() => window.__warsim!.view!.select(0));
  await lookAt(page, 2.5, 46.5, 10);
  await page.waitForTimeout(1_500);
  await page.screenshot({ path: path.join(out, 'kill-france-europe.png') });
  await lookAt(page, 5, 25, 2.2);
  await page.waitForTimeout(1_500);
  await page.screenshot({ path: path.join(out, 'kill-france-africa.png') });
});

// PLAN 2.17a (the critic's R2-B8): Ally with a nation of another alliance did nothing and said
// nothing. The panel says why not, and the God tab has the button that makes it possible.
test('a God action that is refused says why: Ally with a nation of another alliance', async ({ page }, info) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1400, height: 800 });
  await page.goto('/?scenario=1938&paused=1&seed=1938');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null, null, { timeout: 60_000 });
  await page.waitForFunction(() => window.__warsim!.sim.mapLayers !== null, null, { timeout: 60_000 });
  const [FRA, ITA] = [id('FRA'), id('ITA')];
  const select = async (lon: number, lat: number, n: number): Promise<void> => {
    await lookAt(page, lon, lat);
    await page.mouse.click(700, 400);
    await expect(page.getByTestId('nation-panel')).toHaveAttribute('data-nation', String(n));
  };
  const leaderOf = async (n: number): Promise<number | undefined> => nation(await inspect(page), n).alliance?.leader;

  await page.getByTestId('god-btn').click();
  await select(2.5, 47, FRA);
  await page.getByTestId('tab-god').click();
  const [ofFrance, ofItaly] = [await leaderOf(FRA), await leaderOf(ITA)];
  expect(ofFrance).toBeDefined();
  expect(ofItaly).toBeDefined();
  expect(ofItaly).not.toBe(ofFrance);
  await expect(page.getByTestId('god-refusal')).toHaveCount(0);

  // Ally with Italy: refused, in words, and nothing has changed.
  await page.getByTestId('god-target').selectOption(String(ITA));
  await page.getByTestId('god-ally').click();
  await expect(page.getByTestId('god-refusal')).toContainText('in an alliance already');
  expect(await leaderOf(ITA)).toBe(ofItaly);
  const out = process.env['EVIDENCE'] ? path.resolve(import.meta.dirname, '../../docs/evidence/2.17') : info.outputPath();
  mkdirSync(out, { recursive: true });
  await page.screenshot({ path: path.join(out, 'god-refusal.png') });

  // The next action that is carried out takes the words away.
  const bonus = nation(await inspect(page), FRA).incomeBonus;
  await page.getByTestId('god-bonus-up').click();
  await expect.poll(async () => nation(await inspect(page), FRA).incomeBonus).toBe(bonus + 10);
  await expect(page.getByTestId('god-refusal')).toHaveCount(0);

  // Italy leaves its alliance; then France's Ally takes it in, and war on an ally says why not.
  await select(12.5, 43, ITA);
  await page.getByTestId('god-leave').click();
  await expect.poll(() => leaderOf(ITA)).toBeUndefined();
  await expect(page.getByTestId('god-leave')).toHaveCount(0);
  await select(2.5, 47, FRA);
  await page.getByTestId('god-target').selectOption(String(ITA));
  await page.getByTestId('god-ally').click();
  await expect.poll(() => leaderOf(ITA)).toBe(ofFrance);
  await expect(page.getByTestId('god-refusal')).toHaveCount(0);
  await page.getByTestId('god-war').click();
  await expect(page.getByTestId('god-refusal')).toContainText('they are allies');
  expect(atWar(await inspect(page), FRA, ITA)).toBe(false);
});

// PLAN 2.17b (the critic's R2-B8): the Territory brush set the controller and not the owner. A
// drag from France across the Alps left a hatched band, and France's cells rose by 0.
test('the Territory brush gives territory: a drag from France across the Alps', async ({ page }, info) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1400, height: 800 });
  await page.goto('/?scenario=1938&paused=1&seed=1938');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null, null, { timeout: 60_000 });
  await page.waitForFunction(() => window.__warsim!.sim.mapLayers !== null, null, { timeout: 60_000 });
  const FRA = id('FRA');
  const SCALE = 8;
  const holders = (points: [number, number][]): Promise<number[]> => page.evaluate((ps) => ps.map(([x, y]) => window.__warsim!.view!.nationAt(x, y)), points);

  await page.getByTestId('god-btn').click();
  await lookAt(page, 2.5, 47);
  await page.mouse.click(700, 400);
  await expect(page.getByTestId('nation-panel')).toHaveAttribute('data-nation', String(FRA));
  await page.getByTestId('tab-god').click();
  await page.getByTestId('god-tool-brush').click();

  // 250 px at 8 px a cell: from the Rhône valley over the Alps into the plain of the Po.
  await lookAt(page, 7, 45.2, SCALE);
  const from: [number, number] = [600, 400];
  const to: [number, number] = [850, 400];
  const way = Array.from({ length: 32 }, (_, i): [number, number] => [from[0] + ((to[0] - from[0]) * i) / 31, from[1]]);
  const held = await holders(way);
  expect(held[0]).toBe(FRA);
  const foreign = held.filter((n) => n !== FRA).length;
  expect(foreign).toBeGreaterThanOrEqual(10);
  const before = await inspect(page);
  const others = [...new Set(held.filter((n) => n !== FRA && n !== 0))];

  await page.mouse.move(from[0], from[1]);
  await page.mouse.down();
  await page.mouse.move(to[0], to[1], { steps: 12 });
  await page.mouse.up();
  await expect.poll(async () => (await holders(way)).filter((n) => n !== FRA).length).toBe(0);

  // France owns what it painted: its cells rose by what the nations under the stroke lost.
  await expect.poll(async () => nation(await inspect(page), FRA).cells).toBeGreaterThan(nation(before, FRA).cells);
  const after = await inspect(page);
  const gained = nation(after, FRA).cells - nation(before, FRA).cells;
  expect(gained).toBeGreaterThanOrEqual(foreign);
  expect(others.reduce((a, n) => a + nation(before, n).cells - nation(after, n).cells, 0)).toBe(gained);
  // No hatched band: owner and controller were painted as one edit, and one undo takes both back.
  expect(after.edits).toEqual({ undo: 1, redo: 0 });
  await expect(page.getByTestId('god-refusal')).toHaveCount(0);
  const out = process.env['EVIDENCE'] ? path.resolve(import.meta.dirname, '../../docs/evidence/2.17') : info.outputPath();
  mkdirSync(out, { recursive: true });
  await page.evaluate(() => window.__warsim!.view!.select(0));
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(out, 'god-brush-territory.png') });
  await page.evaluate(() => window.__warsim!.sim.command({ kind: 'editUndo' }, true));
  await expect.poll(async () => (await inspect(page)).rasters).toEqual(before.rasters);
});

// PLAN 2.17c (the critic's R2-B8): France, painted over the Alps, renamed "Gaul" and killed, kept
// the band it had painted and its name on it 30 days later, with Italian counters there.
test('a nation painted over a neighbour, renamed and killed holds nothing and has no name on the map', async ({ page }, info) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1400, height: 800 });
  await page.goto('/?scenario=1938&paused=1&seed=1938');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null, null, { timeout: 60_000 });
  await page.waitForFunction(() => window.__warsim!.sim.mapLayers !== null, null, { timeout: 60_000 });
  const FRA = id('FRA');
  const SCALE = 8;
  const holders = (points: [number, number][]): Promise<number[]> => page.evaluate((ps) => ps.map(([x, y]) => window.__warsim!.view!.nationAt(x, y)), points);
  const names = (): Promise<{ id: number; text: string }[]> => page.evaluate(() => (window.__warsim!.view!.draw(), window.__warsim!.view!.nationLabels.map((l) => ({ id: l.id, text: l.text }))));

  await page.getByTestId('god-btn').click();
  await lookAt(page, 2.5, 47);
  await page.mouse.click(700, 400);
  await expect(page.getByTestId('nation-panel')).toHaveAttribute('data-nation', String(FRA));
  await page.getByTestId('tab-god').click();

  // The band of PLAN 2.17b: from the Rhône valley over the Alps into the plain of the Po.
  await page.getByTestId('god-tool-brush').click();
  await lookAt(page, 7, 45.2, SCALE);
  const way = Array.from({ length: 32 }, (_, i): [number, number] => [600 + (250 * i) / 31, 400]);
  // Every 10 px of the view (the band and France west of it): the controller the map draws.
  const grid: [number, number][] = [];
  for (let y = 5; y < 800; y += 10) for (let x = 5; x < 1400; x += 10) grid.push([x, y]);
  const held = await holders(grid);
  const old = new Set((await inspect(page)).nations.filter((n) => n.living).map((n) => n.id));
  await page.mouse.move(600, 400);
  await page.mouse.down();
  await page.mouse.move(850, 400, { steps: 12 });
  await page.mouse.up();
  await expect.poll(async () => (await holders(way)).filter((n) => n !== FRA).length).toBe(0);
  const painted = (await holders(grid)).filter((n, i) => n === FRA && held[i] !== FRA).length;
  expect(painted, 'points of the view the stroke took from a neighbour').toBeGreaterThanOrEqual(10);
  await page.getByTestId('god-tool-brush').click();

  await page.getByTestId('god-rename-input').fill('Gaul');
  await page.getByTestId('god-rename').click();
  await expect.poll(async () => (await names()).some((l) => l.text === 'Gaul')).toBe(true);

  await page.getByTestId('god-kill').click();
  await page.getByTestId('god-kill').click();
  await expect.poll(async () => nation(await inspect(page), FRA).living).toBe(false);

  // At once, and 30 days later: no cell, no name, no formation.
  const out = process.env['EVIDENCE'] ? path.resolve(import.meta.dirname, '../../docs/evidence/2.17') : info.outputPath();
  mkdirSync(out, { recursive: true });
  for (const days of [0, 30]) {
    if (days > 0) await page.evaluate((h) => window.__warsim!.sim.step(h), 24 * days);
    const s = await page.evaluate(() => window.__warsim!.sim.inspect(true));
    expect(nation(s, FRA).living, `after ${days} days`).toBe(false);
    expect(nation(s, FRA).cells, `after ${days} days: cells owned`).toBe(0);
    expect(s.formations.filter((f) => f.nation === FRA), `after ${days} days: formations`).toEqual([]);
    await expect.poll(async () => (await holders(grid)).filter((n) => n === FRA).length, `after ${days} days: cells controlled in the view`).toBe(0);
    await expect.poll(async () => (await names()).filter((l) => l.id === FRA || l.text === 'Gaul'), `after ${days} days: the name on the map`).toEqual([]);
    // The neighbour's land under the stroke is the neighbour's again, and no piece of a nation the
    // Kill founded is left in it (PLAN 2.17c2, ADR-120: four spots of "Free Ain" in Italy's north).
    const now = await holders(grid);
    if (days === 0) expect(now.filter((n, i) => held[i] !== FRA && n !== held[i]), 'at once: points of the view not their first holder’s').toEqual([]);
    expect(now.filter((n, i) => held[i] !== FRA && n !== 0 && !old.has(n)), `after ${days} days: points outside France of a nation founded`).toEqual([]);
    await page.evaluate(() => window.__warsim!.view!.select(0));
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(out, `killed-painted-${days}d.png`) });
  }
});
