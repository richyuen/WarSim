import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type {} from '../../src/app/testApi';

// PLAN 7.4c (ADR-442; the critic's N14: "ranking rows have no flags"): as AoC's Statistics panel,
// each row of the ranking shows the nation's flag and a bar in its colour as long as its value is
// of the first row's.

test('the ranking\'s rows: each nation\'s flag, and a bar in its colour by its share of the first', async ({ page }, info) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1400, height: 800 });
  await page.goto('/?scenario=1938&paused=1&seed=1938');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null, null, { timeout: 60_000 });
  const out = process.env['EVIDENCE'] ? path.resolve(import.meta.dirname, '../../docs/evidence/7.4') : info.outputPath();
  mkdirSync(out, { recursive: true });
  await expect(page.getByTestId('rank-row')).toHaveCount(15);
  const rows = await page.getByTestId('rank-row').evaluateAll((els) =>
    els.map((el) => {
      const img = el.querySelector('img.rank-flag') as HTMLImageElement | null;
      const bar = el.querySelector('.rank-bar') as HTMLElement;
      return {
        nation: Number(el.getAttribute('data-nation')),
        value: Number(el.getAttribute('data-value')),
        flag: img ? { src: img.src, loaded: img.complete && img.naturalWidth > 0, w: img.getBoundingClientRect().width } : null,
        share: Number(bar.getAttribute('data-share')),
        background: getComputedStyle(bar).backgroundImage,
      };
    }),
  );
  // A flag in every row, drawn, the nation's own (the view's flag of that nation).
  for (const r of rows) {
    expect(r.flag, `nation ${r.nation}: a flag`).not.toBeNull();
    expect(r.flag!.loaded, `nation ${r.nation}: the flag drawn`).toBe(true);
    expect(r.flag!.w).toBeGreaterThan(10);
    expect(r.flag!.src).toBe(await page.evaluate((id) => window.__warsim!.view!.flags.urlOf(id), r.nation));
  }
  expect(new Set(rows.map((r) => r.flag!.src)).size, 'fifteen different flags').toBe(15);
  // The bars: the first full, each by its value's share of the first, in the nation's colour.
  expect(rows[0]!.share).toBe(1);
  for (const r of rows) expect(r.share).toBeCloseTo(r.value / rows[0]!.value, 3);
  for (let i = 1; i < rows.length; i++) expect(rows[i]!.share).toBeLessThanOrEqual(rows[i - 1]!.share);
  const colors = new Map(await page.evaluate(() => window.__warsim!.hud.stats.value!.nations.map((n) => [n.id, n.color] as [number, number])));
  for (const r of rows) {
    const c = colors.get(r.nation)!;
    expect(r.background, `nation ${r.nation}: its colour`).toContain(`rgba(${(c >> 16) & 255}, ${(c >> 8) & 255}, ${c & 255}`);
  }
  await page.getByTestId('stats-ranking').screenshot({ path: path.join(out, 'c-ranking.png') });
});
