import { expect, test } from '@playwright/test';

test('page loads with the WarSim title and a sized map canvas', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });

  await page.goto('/');
  await expect(page).toHaveTitle('WarSim');
  const canvas = page.locator('canvas#map');
  await expect(canvas).toBeVisible();
  const size = await canvas.evaluate((c: HTMLCanvasElement) => ({ w: c.width, h: c.height }));
  expect(size.w).toBeGreaterThan(1);
  expect(size.h).toBeGreaterThan(1);
  expect(errors).toEqual([]);
});
