import { expect, test, type Page } from '@playwright/test';
import type {} from '../../src/app/bench/benchApi';

// PLAN 0.16: camera-relative precision at close zoom (1 m/px) near lon 179° (x ≈ 2042 of 2048
// cells). While the camera pans in 0.37 m steps, the sprite's measured screen position must track
// the f64 expectation to ≤ 0.5 px. The naive absolute-f32 path is measured too, to prove the
// probe is sensitive (it jitters by metres = pixels at this zoom).

const SX = ((179 + 180) / 360) * 2048; // lon 179°
const SY = 300.123456789;
const KM_PER_CELL = 40075 / 2048;
const PX_PER_CELL = KM_PER_CELL * 1000;

async function panSequence(page: Page, mode: 'relative' | 'naive', shotDir?: string): Promise<number> {
  await page.evaluate(({ mode, sx, sy }) => window.__precision!.setup(mode, sx, sy), { mode, sx: SX, sy: SY });
  const devs: [number, number][] = [];
  for (let k = 0; k < 60; k++) {
    const cx = SX - 150 / PX_PER_CELL + (k * 0.37) / (KM_PER_CELL * 1000);
    const cy = SY + 40 / PX_PER_CELL - (k * 0.21) / (KM_PER_CELL * 1000);
    const r = await page.evaluate(({ cx, cy }) => window.__precision!.frame(cx, cy), { cx, cy });
    expect(r.actual, `sprite visible at frame ${k}`).not.toBeNull();
    devs.push([r.actual![0] - r.expected[0], r.actual![1] - r.expected[1]]);
    if (shotDir && k % 20 === 0) await page.screenshot({ path: `${shotDir}/precision-${mode}-${k}.png` });
  }
  const mx = devs.reduce((a, d) => a + d[0], 0) / devs.length;
  const my = devs.reduce((a, d) => a + d[1], 0) / devs.length;
  return Math.max(...devs.map((d) => Math.hypot(d[0] - mx, d[1] - my)));
}

test('sprite positions are stable to ≤ 0.5 px while panning at 1 m/px at lon 179°', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/bench.html?b=P');
  await page.waitForFunction(() => window.__precision !== undefined);
  const jitter = await panSequence(page, 'relative', info.outputDir);
  const naive = await panSequence(page, 'naive');
  console.log(`jitter: camera-relative ${jitter.toFixed(3)} px, naive absolute-f32 ${naive.toFixed(3)} px`);
  expect(jitter).toBeLessThanOrEqual(0.5);
  // The probe is sensitive: absolute f32 (ulp ≈ 2.4 m here) jitters by pixels.
  expect(naive).toBeGreaterThan(1);
  expect(naive).toBeGreaterThan(4 * jitter);
  expect(errors).toEqual([]);
});
