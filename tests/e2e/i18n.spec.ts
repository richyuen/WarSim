import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const en = JSON.parse(readFileSync(path.resolve(import.meta.dirname, '../../src/ui/i18n/en.json'), 'utf8')) as Record<string, string>;

// PLAN 0.21: UI text comes from en.json via t(); the chosen locale (`warsim.locale`) holds across
// reloads. There is no language picker (the user's request, ADR-763): the release build offers
// English alone, and a tester stores the pseudo-locale.

test('UI renders en.json strings, a stored locale switches them and holds; no language picker', async ({ page }) => {
  // The release build offers the player English alone (PLAN 7.16c): a stored pseudo-locale is not taken.
  await page.goto('/?scenario=toy&paused=1&view=0');
  await expect(page.getByTestId('app-title')).toHaveText(en['app.title']!);
  await expect(page.getByTestId('locale-select')).toHaveCount(0);
  await page.evaluate(() => localStorage.setItem('warsim.locale', 'qps'));
  await page.goto('/?scenario=toy&paused=1&view=0');
  await expect(page.getByTestId('app-title')).toHaveText(en['app.title']!);
  // The specs turn it on (`warsim.testLocale`), as a tester would.
  await page.evaluate(() => localStorage.setItem('warsim.testLocale', '1'));
  await page.evaluate(() => localStorage.removeItem('warsim.locale'));
  await page.goto('/?scenario=toy&paused=1&view=0');
  await expect(page.getByTestId('app-title')).toHaveText(en['app.title']!);
  await expect(page.getByTestId('topbar')).toContainText(en['app.tagline']!);
  // No raw message keys leak into the UI.
  await expect(page.getByTestId('topbar')).not.toContainText('app.');

  await page.evaluate(() => localStorage.setItem('warsim.locale', 'qps'));
  await page.reload();
  await expect(page.getByTestId('app-title')).toHaveText(/^⟦Ŵåŕîšɱ·+⟧$/);
  await expect(page.getByTestId('topbar')).toContainText(/⟦Ŵöŕļð/);
  expect(await page.evaluate(() => document.documentElement.lang)).toBe('en-XA');

  await page.reload();
  await expect(page.getByTestId('app-title')).toHaveText(/^⟦Ŵåŕîšɱ·+⟧$/);
  await page.evaluate(() => localStorage.setItem('warsim.locale', 'en'));
  await page.reload();
  await expect(page.getByTestId('app-title')).toHaveText(en['app.title']!);
});
