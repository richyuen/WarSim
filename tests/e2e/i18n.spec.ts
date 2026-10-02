import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const en = JSON.parse(readFileSync(path.resolve(import.meta.dirname, '../../src/ui/i18n/en.json'), 'utf8')) as Record<string, string>;

// PLAN 0.21: UI text comes from en.json via t(); the locale picker switches reactively and
// the choice persists across reloads.

test('UI renders en.json strings and the locale picker switches and persists', async ({ page }) => {
  await page.goto('/?paused=1&view=0');
  await expect(page.getByTestId('app-title')).toHaveText(en['app.title']!);
  await expect(page.getByTestId('locale-label')).toHaveText(en['settings.language']!);
  await expect(page.getByTestId('topbar')).toContainText(en['app.tagline']!);
  // No raw message keys leak into the UI.
  await expect(page.getByTestId('topbar')).not.toContainText('app.');

  await page.getByTestId('locale-select').selectOption('qps');
  await expect(page.getByTestId('locale-label')).toHaveText(/^⟦Ļåñĝûåĝé·+⟧$/);
  await expect(page.getByTestId('app-title')).toHaveText(/^⟦ŴåŕŠîɱ·+⟧$/);
  expect(await page.evaluate(() => document.documentElement.lang)).toBe('en-XA');

  await page.reload();
  await expect(page.getByTestId('locale-label')).toHaveText(/^⟦Ļåñĝûåĝé·+⟧$/);
  await page.getByTestId('locale-select').selectOption('en');
  await expect(page.getByTestId('locale-label')).toHaveText(en['settings.language']!);
});
