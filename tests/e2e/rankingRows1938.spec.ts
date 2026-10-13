import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import { UI_SCALES } from '../../src/app/settings';

// PLAN 4.11 (the critic's R4-B6): from row 11 down the ranking drew a value against the wrong
// name (a long name pushed the floated value under the next row's), and row 13 showed two numbers
// run together; on screen from the first frame. At every UI size each row is now one line: its
// value on its name's line, right of it, one number; a long name is cut instead.

test('the ranking\'s rows hold their names and values on one line, at every UI size', async ({ page }, info) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 1400, height: 800 });
  await page.goto('/?scenario=1938&paused=1&seed=1938');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null, null, { timeout: 60_000 });
  const out = process.env['EVIDENCE'] ? path.resolve(import.meta.dirname, '../../docs/evidence/4.11') : info.outputPath();
  mkdirSync(out, { recursive: true });
  await expect(page.getByTestId('rank-row')).toHaveCount(15);
  for (const scale of UI_SCALES) {
    await page.evaluate((v) => window.__warsim!.settings.setUiScale(v), scale);
    await page.waitForTimeout(300);
    const rows = await page.getByTestId('rank-row').evaluateAll((els) =>
      els.map((el) => {
        const box = (q: string): DOMRect => el.querySelector(q)!.getBoundingClientRect();
        const r = el.getBoundingClientRect();
        const name = box('.rank-name');
        const value = box('.rank-value');
        const line = parseFloat(getComputedStyle(el).lineHeight);
        return { r: { top: r.top, bottom: r.bottom, h: r.height }, name: { right: name.right, top: name.top, bottom: name.bottom }, value: { left: value.left, top: value.top, bottom: value.bottom, h: value.height }, line, text: el.querySelector('.rank-value')!.textContent ?? '', data: Number(el.getAttribute('data-value')) };
      }),
    );
    rows.forEach((row, i) => {
      const at = `UI size ${scale}, row ${i + 1}`;
      expect(row.r.h, `${at}: one line`).toBeLessThanOrEqual(row.line * 1.2);
      expect(row.value.top, `${at}: the value on its row`).toBeGreaterThanOrEqual(row.r.top - 0.5);
      expect(row.value.bottom, `${at}: the value on its row`).toBeLessThanOrEqual(row.r.bottom + 0.5);
      expect(row.value.left, `${at}: the value right of its name`).toBeGreaterThanOrEqual(row.name.right - 0.5);
      expect(row.text, `${at}: one number`).toBe(Math.round(row.data).toLocaleString('en-US'));
    });
    if (scale === 1) await page.getByTestId('stats-ranking').screenshot({ path: path.join(out, 'ranking.png') });
  }
  await page.evaluate(() => window.__warsim!.settings.setUiScale(1));
});
