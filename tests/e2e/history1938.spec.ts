import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import { EventKind } from '../../src/shared/events';
import { filterHistory, HISTORY_ROLES, isoDate, kindName, NO_FILTER, type HistoryRow } from '../../src/shared/history';
import { NATIONS_1938 } from '../../src/sim/scenario1938';

// PLAN 1.34a AT: export file contents validated in e2e; filters reduce rows correctly.

const GER = NATIONS_1938.findIndex((n) => n.tag === 'GER') + 1;
const POL = NATIONS_1938.findIndex((n) => n.tag === 'POL') + 1;
const count = async (page: Page): Promise<number> => page.getByTestId('history-row').count();

test('history log: filters reduce rows, CSV and JSON exports match the filtered rows', async ({ page }, info) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1400, height: 800 });
  await page.goto('/?scenario=1938&paused=1&seed=1938');
  await page.waitForFunction(() => window.__warsim?.hud.stats.value !== null && window.__warsim?.hud.stats.value !== undefined, null, { timeout: 60_000 });
  // A God war (certain row) plus two AI months of history.
  await page.evaluate(({ g, p }) => window.__warsim!.sim.command({ kind: 'declareWar', attacker: g, defender: p }), { g: GER, p: POL });
  await page.evaluate(() => window.__warsim!.sim.step(24 * 60));
  const rows = await page.evaluate(() => window.__warsim!.sim.history());
  const startDay = await page.evaluate(() => window.__warsim!.hud.startDay);
  expect(rows.length).toBeGreaterThan(5);
  expect(rows.some((r) => r.kind === EventKind.WarDeclared && r.a === GER && r.b === POL)).toBe(true);

  await page.getByTestId('history-btn').click();
  const panel = page.getByTestId('history-panel');
  await expect(panel).toBeVisible();
  await expect.poll(() => count(page), { timeout: 20_000 }).toBe(Math.min(rows.length, 400));
  await expect(page.getByTestId('history-count')).toContainText(`${rows.length} of ${rows.length}`);
  await expect(page.getByTestId('history-row').first()).toContainText(/\d{4}/);

  // Type filter: only war declarations remain, and exactly as many as in the log.
  await page.getByTestId('history-kind').selectOption(String(EventKind.WarDeclared));
  const wars = rows.filter((r) => r.kind === EventKind.WarDeclared).length;
  await expect.poll(() => count(page)).toBe(wars);
  expect(new Set(await page.getByTestId('history-row').evaluateAll((els) => els.map((e) => e.getAttribute('data-kind'))))).toEqual(new Set([String(EventKind.WarDeclared)]));
  await expect(page.getByTestId('history-row').filter({ hasText: 'Germany declared war on Poland' })).toHaveCount(1);

  // Nation filter on top: Germany's war declarations (as attacker or defender).
  await page.getByTestId('history-nation').selectOption(String(GER));
  const both = filterHistory(rows, { ...NO_FILTER, kind: EventKind.WarDeclared, nation: GER }, startDay);
  await expect.poll(() => count(page)).toBe(both.length);
  expect(both.length).toBeGreaterThanOrEqual(1);
  expect(both.length).toBeLessThanOrEqual(wars);

  // Year filter: a range after the run removes everything; clearing restores.
  await page.getByTestId('history-from').fill('1950');
  await expect.poll(() => count(page)).toBe(0);
  await page.getByTestId('history-from').fill('');
  await page.getByTestId('history-kind').selectOption('');
  const gerAll = filterHistory(rows, { ...NO_FILTER, nation: GER }, startDay);
  await expect.poll(() => count(page)).toBe(Math.min(gerAll.length, 400));

  // Exports of the filtered (Germany) rows.
  const out = info.outputPath();
  mkdirSync(out, { recursive: true });
  const save = async (testid: string): Promise<string> => {
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId(testid).click()]);
    const file = path.join(out, dl.suggestedFilename());
    await dl.saveAs(file);
    return readFileSync(file, 'utf8');
  };
  const csv = await save('history-csv');
  const lines = csv.trimEnd().split('\r\n');
  expect(lines[0]).toBe('date,tick,type,a,aName,b,bName,text');
  expect(lines.length - 1).toBe(gerAll.length);
  const first = gerAll[0]!;
  expect(lines[1]!.startsWith(`${isoDate(startDay, first.tick)},${first.tick},${kindName(first.kind)},${first.a},`)).toBe(true);

  const json = JSON.parse(await save('history-json')) as { date: string; tick: number; type: string; a: number; b: number; aName: string; bName: string; text: string }[];
  expect(json).toHaveLength(gerAll.length);
  json.forEach((rec, i) => {
    const r: HistoryRow = gerAll[i]!;
    expect(rec).toMatchObject({ tick: r.tick, type: kindName(r.kind), a: r.a, b: r.b, date: isoDate(startDay, r.tick) });
    const [ra, rb] = HISTORY_ROLES[r.kind]!;
    expect((ra === 'nation' && r.a === GER) || (rb === 'nation' && r.b === GER)).toBe(true);
    expect(rec.text.length).toBeGreaterThan(0);
  });
  expect(json.some((rec) => rec.text === 'Germany declared war on Poland' && rec.aName === 'Germany' && rec.bName === 'Poland')).toBe(true);

  const ev = process.env['EVIDENCE'] ? path.resolve(import.meta.dirname, '../../docs/evidence/1.34') : out;
  mkdirSync(ev, { recursive: true });
  await page.getByTestId('history-nation').selectOption('');
  await page.screenshot({ path: path.join(ev, 'history.png') });
});
