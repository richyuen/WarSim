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
