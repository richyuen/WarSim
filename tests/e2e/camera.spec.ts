import { expect, test, type Page } from '@playwright/test';
import type {} from '../../src/app/testApi';

// PLAN 0.17: camera controller driven by real input events; seamless dateline wrap.
// Toy map: 256×128 cells, looping x.

type Cam = { cx: number; cy: number; scale: number };

async function cam(page: Page): Promise<Cam> {
  return page.evaluate(() => ({ ...window.__warsim!.view!.camera }));
}

async function setCam(page: Page, c: Cam): Promise<void> {
  await page.evaluate((c) => window.__warsim!.view!.controller.set(c), c);
}

/** Waits until held keys and zoom easing have settled. */
async function settle(page: Page): Promise<void> {
  await page.waitForFunction(() => !window.__warsim!.view!.controller.animating, null, { timeout: 5000 });
}

test.beforeEach(async ({ page }) => {
  // Budget for the first frame while the 1938 suites load in parallel (review after PLAN 1.33:
  // one gate run timed out here at the 30 s default; the assertions are unchanged).
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 960, height: 540 });
  await page.goto('/?scenario=toy&paused=1');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.view!.lastTick >= 0, null, { timeout: 60_000 });
});

test('keyboard pans with arrows/WASD and zooms with E/Q', async ({ page }) => {
  await setCam(page, { cx: 100, cy: 64, scale: 10 });
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(400);
  await page.keyboard.up('ArrowRight');
  const a = await cam(page);
  expect(a.cx).toBeGreaterThan(110); // 900 px/s for ~0.4 s at 10 px/cell ≈ 36 cells
  expect(a.cy).toBeCloseTo(64, 6);

  await page.keyboard.down('KeyW');
  await page.waitForTimeout(200);
  await page.keyboard.up('KeyW');
  expect((await cam(page)).cy).toBeLessThan(64);

  const s0 = (await cam(page)).scale;
  await page.keyboard.down('KeyE');
  await page.waitForTimeout(400);
  await page.keyboard.up('KeyE');
  await settle(page);
  const s1 = (await cam(page)).scale;
  expect(s1).toBeGreaterThan(s0 * 1.3);
  await page.keyboard.down('KeyQ');
  await page.waitForTimeout(400);
  await page.keyboard.up('KeyQ');
  await settle(page);
  expect((await cam(page)).scale).toBeLessThan(s1 / 1.3);
});

test('mouse drag pans by exactly the pointer delta', async ({ page }) => {
  await setCam(page, { cx: 100, cy: 64, scale: 10 });
  await page.mouse.move(480, 270);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(480 - 20 * i, 270 + 3 * i);
  await page.mouse.up();
  const c = await cam(page);
  expect(c.cx).toBeCloseTo(100 + 200 / 10, 6);
  expect(c.cy).toBeCloseTo(64 - 30 / 10, 6);
});

test('wheel zooms continuously, anchored at the cursor', async ({ page }) => {
  await setCam(page, { cx: 100, cy: 64, scale: 10 });
  const before = await cam(page);
  const sx = 800;
  const sy = 150;
  const wx = before.cx + (sx - 480) / before.scale;
  const wy = before.cy + (sy - 270) / before.scale;
  await page.mouse.move(sx, sy);
  // Record the camera scale on every animation frame while the zoom eases in.
  await page.evaluate(() => {
    const w = window as unknown as { __scales: number[] };
    w.__scales = [];
    const rec = (): void => {
      w.__scales.push(window.__warsim!.view!.camera.scale);
      if (w.__scales.length < 400) requestAnimationFrame(rec);
    };
    requestAnimationFrame(rec);
  });
  await page.mouse.wheel(0, -300);
  await page.waitForTimeout(100);
  await settle(page);
  const after = await cam(page);
  const scales = await page.evaluate(() => (window as unknown as { __scales: number[] }).__scales);
  // Continuous: at least one rendered frame lies strictly between the start and target scales.
  expect(scales.some((s) => s > before.scale * 1.001 && s < after.scale * 0.999)).toBe(true);
  expect(after.scale / before.scale).toBeCloseTo(Math.pow(1.25, 3), 2);
  // The world point under the cursor stays under the cursor.
  expect(after.cx + (sx - 480) / after.scale).toBeCloseTo(wx, 4);
  expect(after.cy + (sy - 270) / after.scale).toBeCloseTo(wy, 4);
});

test('two-finger touch pinch zooms about the fingers and one finger pans', async ({ page }) => {
  await setCam(page, { cx: 100, cy: 64, scale: 10 });
  await page.evaluate(() => {
    const el = document.getElementById('map')!;
    const fire = (type: string, id: number, x: number, y: number, target: EventTarget): void => {
      target.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', clientX: x, clientY: y, bubbles: true, isPrimary: id === 1 }));
    };
    fire('pointerdown', 1, 430, 270, el);
    fire('pointerdown', 2, 530, 270, el);
    for (let i = 1; i <= 10; i++) {
      fire('pointermove', 1, 430 - 5 * i, 270, window);
      fire('pointermove', 2, 530 + 5 * i, 270, window);
    }
    fire('pointerup', 1, 380, 270, window);
    fire('pointerup', 2, 580, 270, window);
  });
  const c = await cam(page);
  expect(c.scale).toBeCloseTo(20, 6); // finger distance 100 → 200 px
  expect(c.cx).toBeCloseTo(100, 6); // pinch centred on the screen centre
  await page.evaluate(() => {
    const el = document.getElementById('map')!;
    el.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 7, pointerType: 'touch', clientX: 600, clientY: 300, bubbles: true }));
    window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 7, pointerType: 'touch', clientX: 500, clientY: 300 }));
    window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 7, pointerType: 'touch', clientX: 500, clientY: 300 }));
  });
  expect((await cam(page)).cx).toBeCloseTo(100 + 100 / 20, 6);
});

test('panning past the dateline wraps seamlessly', async ({ page }, info) => {
  await setCam(page, { cx: 250, cy: 64, scale: 10 });
  await page.mouse.move(480, 270);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(480 - 20 * i, 270);
  await page.mouse.up();
  const c = await cam(page);
  expect(c.cx).toBeCloseTo(270 - 256, 6); // wrapped into [0, 256)

  // Seam at the screen centre vs an ordinary border (x = 128) at the centre: the toy map has a
  // nation border at both, so a seamless wrap draws an identical-looking border at each.
  const profile = async (cx: number): Promise<number[]> => {
    await setCam(page, { cx, cy: 64, scale: 10 });
    await page.evaluate(() => window.__warsim!.view!.draw());
    return page.evaluate(() => {
      const c = document.getElementById('map') as HTMLCanvasElement;
      const gl = c.getContext('webgl2')!;
      const px = new Uint8Array(4 * 120);
      gl.readPixels(Math.floor(c.width / 2) - 60, Math.floor(c.height * 0.3), 120, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      return Array.from(px);
    });
  };
  const seam = await profile(0);
  await page.screenshot({ path: info.outputPath('dateline-seam.png') });
  const border = await profile(128);
  const dark = (p: number[]): number => {
    let n = 0;
    for (let i = 0; i < p.length; i += 4) if (p[i]! + p[i + 1]! + p[i + 2]! < 200) n++;
    return n;
  };
  /** The two dominant fill colours (anti-aliased border pixels are rare and excluded). */
  const colours = (p: number[]): string[] => {
    const counts = new Map<string, number>();
    for (let i = 0; i < p.length; i += 4) {
      const k = `${p[i]},${p[i + 1]},${p[i + 2]}`;
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map((e) => e[0]).sort();
  };
  // Same two nation fills on either side, and a border line of similar width (a few px), with
  // no gap, double line or background showing at the seam.
  expect(colours(seam)).toEqual(colours(border));
  expect(dark(seam)).toBeGreaterThan(0);
  expect(Math.abs(dark(seam) - dark(border))).toBeLessThanOrEqual(2);
});
