import { expect, test, type Page } from '@playwright/test';
import type {} from '../../src/app/testApi';
import type { Command } from '../../src/shared/commands';
import type { Inspection } from '../../src/shared/protocol';
import { cellOf } from '../../src/sim/data/terrain';
import { NATIONS_1938, SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { assets1938 } from '../helpers/earth';

// PLAN 1.32a AT: one e2e per God Mode command in SPEC §9, each asserting the sim effect via
// `__warsim` (commands go through the worker; `sim.inspect()` reads the result back). Nuclear
// commands arrive with Phase 6 (PLAN 6.1); taking control with PLAN 1.33.

const { w: W, h: H } = SIZE_1938;
const id = (tag: string): number => NATIONS_1938.findIndex((n) => n.tag === tag) + 1;

async function open(page: Page): Promise<void> {
  await page.goto('/?scenario=1938&paused=1&seed=1938');
  await page.waitForFunction(() => window.__warsim?.hud.stats.value !== null && window.__warsim?.hud.stats.value !== undefined, null, { timeout: 60_000 });
}

/** Sends God commands, applies them with one tick, and returns the world summary. */
async function god(page: Page, ...cmds: Command[]): Promise<Inspection> {
  return page.evaluate(async (cs) => {
    const sim = window.__warsim!.sim;
    for (const c of cs) sim.command(c);
    await sim.step(1);
    return sim.inspect();
  }, cmds);
}

const inspect = (page: Page): Promise<Inspection> => page.evaluate(() => window.__warsim!.sim.inspect());
const nation = (s: Inspection, n: number) => s.nations.find((x) => x.id === n)!;
const atWar = (s: Inspection, a: number, b: number): boolean =>
  s.wars.some((w) => (w.attackers.includes(a) && w.defenders.includes(b)) || (w.attackers.includes(b) && w.defenders.includes(a)));

test.describe('God Mode commands (SPEC §9)', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(120_000);
    await open(page);
  });

  test('rename: the new name reaches the nation panel; an empty name restores it', async ({ page }) => {
    let s = await god(page, { kind: 'renameNation', nation: id('GER'), name: '  Greater Ostmark  ' });
    expect(nation(s, id('GER')).name).toBe('=Greater Ostmark');
    await page.evaluate((g) => window.__warsim!.view!.select(g), id('GER'));
    await expect(page.getByTestId('nation-name')).toHaveText('Greater Ostmark', { timeout: 20_000 });
    s = await god(page, { kind: 'renameNation', nation: id('GER'), name: '' });
    expect(nation(s, id('GER')).name).toBe('nation.GER');
  });

  test('force war', async ({ page }) => {
    expect(atWar(await inspect(page), id('GER'), id('POL'))).toBe(false);
    expect(atWar(await god(page, { kind: 'declareWar', attacker: id('GER'), defender: id('POL') }), id('GER'), id('POL'))).toBe(true);
  });

  test('force peace', async ({ page }) => {
    const before = await inspect(page);
    const spain = before.wars.find((w) => w.attackers.includes(id('NSP')) || w.defenders.includes(id('NSP')))!;
    expect(spain).toBeTruthy();
    const after = await god(page, { kind: 'forcePeace', war: spain.id });
    expect(after.wars.some((w) => w.id === spain.id)).toBe(false);
    expect(atWar(after, id('NSP'), id('REP'))).toBe(false);
  });

  test('force alliance', async ({ page }) => {
    const s = await god(page, { kind: 'createAlliance', leader: id('SWE'), members: [id('NOR'), id('DEN')], nameKey: 'alliance.defensive' });
    const a = s.alliances.find((x) => x.leader === id('SWE'))!;
    expect(a.members.sort()).toEqual([id('SWE'), id('NOR'), id('DEN')].sort());
    expect(nation(s, id('NOR')).alliance?.leader).toBe(id('SWE'));
  });

  test('force collapse (Kill): the nation is gone, its land split into new nations', async ({ page }) => {
    const before = await inspect(page);
    expect(nation(before, id('YUG')).living).toBe(true);
    const s = await god(page, { kind: 'collapseNation', nation: id('YUG') });
    expect(nation(s, id('YUG')).living).toBe(false);
    const born = s.nations.filter((n) => n.living && !before.nations.some((b) => b.id === n.id && b.living));
    expect(born.length).toBeGreaterThanOrEqual(2);
    const land = born.reduce((a, n) => a + n.cells, 0);
    expect(land).toBeGreaterThanOrEqual(nation(before, id('YUG')).cells * 0.9);
  });

  test('spawn nation: dead Ethiopia revives on its cores', async ({ page }) => {
    const before = await inspect(page);
    expect(nation(before, id('ETH')).living).toBe(false);
    const s = await god(page, { kind: 'reviveNation', nation: id('ETH') });
    expect(nation(s, id('ETH')).living).toBe(true);
    expect(nation(s, id('ETH')).cells).toBeGreaterThan(100);
    expect(nation(s, id('ITA')).cells).toBeLessThan(nation(before, id('ITA')).cells);
  });

  test('spawn revolt: a province leaves its holder as a new nation', async ({ page }) => {
    const node = new Sim({ scenario: '1938', seed: 1938, assets: assets1938(W) });
    const [wx, wy] = cellOf(21.0, 52.23, W, H); // Warsaw (Masovia)
    const province = node.world.cells.province[Math.floor(wy) * W + Math.floor(wx)]!;
    expect(province).toBeGreaterThan(0);
    const before = await inspect(page);
    const s = await god(page, { kind: 'spawnRevolt', province });
    const born = s.nations.filter((n) => n.living && !before.nations.some((b) => b.id === n.id && b.living));
    expect(born.length).toBe(1);
    expect(born[0]!.cells).toBeGreaterThan(0);
    expect(nation(s, id('POL')).cells).toBe(nation(before, id('POL')).cells - born[0]!.cells);
  });

  test('spawn battle: a forced breakthrough opens a corridor', async ({ page }) => {
    const [bx, by] = cellOf(-3.7, 40.4, W, H);
    const before = await inspect(page);
    const s = await god(page, { kind: 'forceBreakthrough', nation: id('NSP'), x: bx, y: by, toX: bx + 40, toY: by });
    expect(s.corridors).toBe(before.corridors + 1);
  });

  test('grant buff', async ({ page }) => {
    const s = await god(page, { kind: 'grantBuff', targetKind: 'nation', target: id('ITA'), buff: 'attack', magnitude: 0.25, hours: 24 * 30, nameKey: 'buff.god' });
    const b = s.buffs.find((x) => x.targetKind === 'nation' && x.target === id('ITA'))!;
    expect(b.kind).toBe('attack');
    expect(b.magnitude).toBe(0.25);
    expect(b.until).toBeGreaterThan(s.tick);
  });

  test('disable AI per nation and globally', async ({ page }) => {
    let s = await god(page, { kind: 'setAi', nation: id('JAP'), enabled: false });
    expect(nation(s, id('JAP')).aiOff).toBe(true);
    s = await god(page, { kind: 'setAi', nation: id('JAP'), enabled: true }, { kind: 'setSetting', key: 'aiEnabled', value: false });
    expect(nation(s, id('JAP')).aiOff).toBe(false);
    expect(s.settings.aiEnabled).toBe(false);
  });

  test('income bonus (clamped to ±100)', async ({ page }) => {
    let s = await god(page, { kind: 'setIncomeBonus', nation: id('FRA'), value: 50 });
    expect(nation(s, id('FRA')).incomeBonus).toBe(50);
    s = await god(page, { kind: 'setIncomeBonus', nation: id('FRA'), value: -500 });
    expect(nation(s, id('FRA')).incomeBonus).toBe(-100);
  });
});
