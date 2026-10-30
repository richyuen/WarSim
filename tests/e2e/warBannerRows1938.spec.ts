import { expect, test } from '@playwright/test';
import type {} from '../../src/app/testApi';
import { NATIONS_1938 } from '../../src/sim/scenario1938';
/** `MAX_BANNERS` of `src/ui/WarBanners.tsx` (a .tsx the specs do not import). */
const MAX_BANNERS = 6;

// PLAN 7.4f6 (the critic's N16: "war banners stand three rows deep over the map"): with more wars
// than banners, at most two rows of them at 1400 × 800 and wider, the rest a "+N"; and the panels
// are opaque (N15: names and counters showed through the ranking).

const id = (tag: string): number => NATIONS_1938.findIndex((n) => n.tag === tag) + 1;
const PAIRS = [['GER', 'POL'], ['ITA', 'YUG'], ['FRA', 'SPA'], ['ENG', 'IRE'], ['SOV', 'FIN'], ['TUR', 'GRE'], ['HUN', 'ROM'], ['BUL', 'ALB'], ['SWE', 'NOR']] as const;

for (const [w, h] of [[1400, 800], [1920, 1080]] as const) {
  test(`${w} × ${h}: at most two rows of war banners, the rest a "+N"; opaque panels`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: w, height: h });
    await page.goto('/?scenario=1938&paused=1&seed=1938');
    await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null, null, { timeout: 60_000 });
    const pairs = PAIRS.map(([a, b]) => [id(a), id(b)] as const).filter(([a, b]) => a > 0 && b > 0);
    await page.evaluate((pairs) => {
      for (const [attacker, defender] of pairs) window.__warsim!.sim.command({ kind: 'declareWar', attacker, defender });
    }, pairs);
    await page.evaluate(() => window.__warsim!.sim.step(1));
    const wars = await page.evaluate(async () => (await window.__warsim!.sim.inspect()).wars.length);
    expect(wars, 'more wars than banners').toBeGreaterThan(MAX_BANNERS);
    await expect(page.getByTestId('war-banner')).toHaveCount(MAX_BANNERS);
    await expect(page.getByTestId('war-more')).toContainText(`+${wars - MAX_BANNERS}`);
    const rows = await page.getByTestId('war-banner').evaluateAll((els) => new Set(els.map((e) => Math.round(e.getBoundingClientRect().top))).size);
    expect(rows, 'rows of banners').toBeLessThanOrEqual(2);
    const bg = await page.getByTestId('stats-ranking').evaluate((el) => getComputedStyle(el).backgroundImage);
    expect(bg, 'the ranking\'s fill opaque').toContain('rgb(52, 58, 69)');
  });
}
