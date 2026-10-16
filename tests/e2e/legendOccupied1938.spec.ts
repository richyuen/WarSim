import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import { cellOf } from '../../src/sim/data/terrain';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { lookAt, open1938 } from './mapView';

// PLAN 7.4f3 (from the Phase 2 review's list under PLAN 7.4): the legend said "Hatched: occupied
// land" at every zoom; since PLAN 2.11f occupied land is a tint in the occupier's colour where the
// ground of T2 and T3 is drawn, with an eighth of the hatching. It says so there now.

const { w: W, h: H } = SIZE_1938;
const en = JSON.parse(readFileSync(path.resolve(import.meta.dirname, '../../src/ui/i18n/en.json'), 'utf8')) as Record<string, string>;

test('the legend says how occupied land is drawn: hatched at T0 and T1, tinted with the ground', async ({ page }) => {
  test.setTimeout(120_000);
  await open1938(page, 1938);
  const legend = page.getByTestId('map-legend');
  const [x, y] = cellOf(19, 52, W, H);
  await lookAt(page, x, y, 2000);
  await expect(legend).toContainText(en['legend.occupied']!);
  expect(await page.evaluate(() => window.__warsim!.view!.groundShown)).toBe(false);
  await lookAt(page, x, y, 60);
  await expect.poll(() => page.evaluate(() => window.__warsim!.view!.groundShown)).toBe(true);
  await expect(legend).toContainText(en['legend.occupiedTint']!);
  await expect(legend).not.toContainText(en['legend.occupied']!);
  await lookAt(page, x, y, 2000);
  await expect(legend).toContainText(en['legend.occupied']!);
});
