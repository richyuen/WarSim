import { expect, test } from '@playwright/test';
import type {} from '../../src/app/bench/benchApi';

// Guards the benchmark pages in the normal gate: shaders compile and the map draws (under
// SwiftShader here; `npm run bench` measures on the real GPU).

test('bench A (WebGL2 map) compiles and draws land and water', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto('/bench.html?b=A');
  await page.waitForFunction(() => window.__bench !== undefined, null, { timeout: 60_000 });
  await page.evaluate(() => window.__bench!.setCamera(1024, 512, 0.6));
  const colours = await page.evaluate(() => {
    const c = document.getElementById('map') as HTMLCanvasElement;
    const gl = c.getContext('webgl2')!;
    const px = new Uint8Array(4);
    const seen = new Set<string>();
    for (let i = 0; i < 64; i++) {
      gl.readPixels(Math.floor(((i % 8) + 0.5) * (c.width / 8)), Math.floor((Math.floor(i / 8) + 0.5) * (c.height / 8)), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      seen.add(px.join(','));
    }
    return seen.size;
  });
  expect(colours).toBeGreaterThan(10); // water + many nation colours
  expect(errors).toEqual([]);
});
