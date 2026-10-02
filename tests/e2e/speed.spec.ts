import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type {} from '../../src/app/testApi';

// PLAN 1.8: the bottom bar shows the sim date and controls pause/speed; the speed setting (and
// pause) persist across a reload, and the worker really runs at the persisted speed.

const workerState = (page: Page) => page.evaluate(() => window.__warsim!.hud.worker.value);

test('speed and pause persist across reload; the date advances from 1 January 1938', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page.waitForFunction(() => window.__warsim?.hud.worker.value !== null);
  const label = page.getByTestId('speed-label');
  await expect(label).toHaveAttribute('data-level', '4'); // default: ×5 = 24 h/s
  await expect(page.getByTestId('date-label')).toContainText('1938');

  // Two steps faster (×7 = 96 h/s) via the buttons, one slower via the keyboard, then pause.
  await page.getByTestId('speed-up').click();
  await page.getByTestId('speed-up').click();
  await page.keyboard.press('Comma');
  await expect(label).toHaveAttribute('data-level', '5');
  await expect(label).toHaveText('Speed ×6');
  await expect.poll(async () => (await workerState(page))?.speed).toBe(48);
  await page.getByTestId('pause-btn').click();
  await expect.poll(async () => (await workerState(page))?.paused).toBe(true);
  const dateAtPause = await page.getByTestId('date-label').textContent();

  const out = process.env['EVIDENCE'] ? path.resolve(import.meta.dirname, '../../docs/evidence/1.8') : info.outputPath();
  mkdirSync(out, { recursive: true });
  await page.screenshot({ path: path.join(out, 'bottom-bar-paused.png') });

  await page.reload();
  await page.waitForFunction(() => window.__warsim?.hud.worker.value !== null);
  await expect(page.getByTestId('speed-label')).toHaveAttribute('data-level', '5');
  await expect.poll(async () => await workerState(page)).toEqual({ speed: 48, paused: true });
  await expect(page.getByTestId('pause-btn')).toHaveAttribute('aria-pressed', 'true');

  // Resume with Space: the date moves on (48 h/s ≈ two days per second).
  await page.keyboard.press('Space');
  await expect.poll(async () => (await workerState(page))?.paused).toBe(false);
  await expect.poll(async () => page.getByTestId('date-label').textContent(), { timeout: 10_000 }).not.toBe(dateAtPause);
  expect(errors).toEqual([]);
});
