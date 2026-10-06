import { expect, test } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import { NATIONS_1938, RULES_1938 } from '../../src/sim/scenario1938';

// PLAN 3.1e AT: Germany's panel in 1938 lists three techs by name with a share paid that grows
// over a month, and its research budget.

const en = JSON.parse(readFileSync(path.resolve(import.meta.dirname, '../../src/ui/i18n/en.json'), 'utf8')) as Record<string, string>;
const id = (tag: string): number => NATIONS_1938.findIndex((n) => n.tag === tag) + 1;
const int = (s: string | null): number => Number((s ?? '').replace(/[^0-9]/g, ''));

test('research on the page: Germany works on three techs, and a month pays more of each', async ({ page }, info) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1400, height: 800 });
  await page.goto('/?scenario=1938&paused=1&seed=1938');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null && window.__warsim!.hud.techs.value.length > 0, null, { timeout: 60_000 });
  const GER = id('GER');
  await page.evaluate((n) => window.__warsim!.view!.select(n), GER);
  await page.getByTestId('tab-economy').click();
  const lines = page.getByTestId('research-line');

  // Day 0: the economic AI has set no budget yet, and nothing is in research.
  await expect(page.getByTestId('panel-research')).toContainText(en['panel.researchNone']!);
  await expect(lines).toHaveCount(0);

  // The budget is set on the first day and the lines are opened on the second.
  await page.evaluate(() => window.__warsim!.sim.step(24 * 2));
  await expect(lines).toHaveCount(3, { timeout: 20_000 });
  const read = async (): Promise<{ name: string; paid: number }[]> => {
    const out: { name: string; paid: number }[] = [];
    for (const l of await lines.all()) out.push({ name: (await l.locator('span').first().textContent()) ?? '', paid: int(await l.getByTestId('research-paid').textContent()) });
    return out;
  };
  const first = await read();
  // By name, out of the catalog: no key and no index on the page.
  const names = new Set(RULES_1938.techs.map((t) => en[`tech.${t.id}`]));
  expect(names.has(undefined as never)).toBe(false);
  for (const l of first) expect(names.has(l.name), l.name).toBe(true);
  expect(new Set(first.map((l) => l.name)).size).toBe(3);
  // The budget is a twentieth of the month's income (RESEARCH_SHARE), under the cap.
  const stat = await page.evaluate((n) => window.__warsim!.hud.stats.value!.nations.find((x) => x.id === n)!, GER);
  expect(stat.research).toBeGreaterThan(0);
  expect(stat.research).toBeLessThanOrEqual(stat.income * 0.05 + 1e-6);
  expect(int(await page.getByTestId('research-budget').textContent())).toBe(Math.round(stat.research));

  // A month on: the same three, each further.
  await page.evaluate(() => window.__warsim!.sim.step(24 * 30));
  await page.waitForFunction((n) => (window.__warsim!.hud.stats.value!.nations.find((x) => x.id === n)?.lines[0]?.paid ?? 0) > 10, GER, { timeout: 60_000 });
  await expect(page.getByTestId('research-paid').first()).not.toHaveText(`${first[0]!.paid}%`);
  const later = await read();
  expect(later.map((l) => l.name)).toEqual(first.map((l) => l.name));
  for (let i = 0; i < 3; i++) {
    expect(later[i]!.paid, later[i]!.name).toBeGreaterThan(first[i]!.paid + 5);
    expect(later[i]!.paid).toBeLessThan(100);
  }

  const out = process.env['EVIDENCE'] ? path.resolve(import.meta.dirname, '../../docs/evidence/3.1') : info.outputPath();
  mkdirSync(out, { recursive: true });
  await page.screenshot({ path: path.join(out, 'research-germany.png') });
});
