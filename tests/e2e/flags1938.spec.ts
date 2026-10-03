import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import { cellOf } from '../../src/sim/data/terrain';
import { NATIONS_1938, SIZE_1938 } from '../../src/sim/scenario1938';

// PLAN 1.37b AT: a flag edited in the editor is shown on the map. Poland's flag becomes a green,
// white and red vertical tricolour with one blue pencil pixel; the flag drawn at Warsaw on the
// map overlay has those colours, and the nation panel shows it. Restoring brings the scenario
// flag back.

const { w: W, h: H } = SIZE_1938;
const POL = NATIONS_1938.findIndex((n) => n.tag === 'POL') + 1;

/** RGB of the overlay at fractions (fx, fy) of Poland's drawn flag. */
async function flagPixel(page: Page, fx: number, fy: number): Promise<number[]> {
  return page.evaluate(
    ({ id, fx, fy }) => {
      const v = window.__warsim!.view!;
      v.draw();
      const r = v.flagRects.find((f) => f.id === id);
      if (!r) return [];
      const o = document.querySelector('canvas.map-nations') as HTMLCanvasElement;
      const dpr = o.width / o.clientWidth;
      const d = o.getContext('2d')!.getImageData(Math.floor((r.x + r.w * fx) * dpr), Math.floor((r.y + r.h * fy) * dpr), 1, 1).data;
      return [d[0]!, d[1]!, d[2]!];
    },
    { id: POL, fx, fy },
  );
}

test('a flag edited in the editor is drawn on the map and in the panel', async ({ page }, info) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 1400, height: 800 });
  await page.goto('/?scenario=1938&paused=1&seed=1938');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null, null, { timeout: 60_000 });
  const [wx, wy] = cellOf(21.0, 52.23, W, H);
  await page.evaluate(({ wx, wy }) => window.__warsim!.view!.controller.set({ cx: wx, cy: wy, scale: 8 }), { wx, wy });

  // The scenario flag first (Poland: white over red).
  await expect.poll(() => flagPixel(page, 0.5, 0.25)).toEqual([255, 255, 255]);

  // Editor → Poland → Edit flag → vertical tricolour preset, one blue pencil pixel, Save.
  await page.getByTestId('editor-btn').click();
  await page.getByTestId('editor-nation').selectOption(String(POL));
  await page.getByTestId('editor-flag-open').click();
  await page.getByTestId('flag-preset').selectOption('tricolourV');
  await page.getByTestId('flag-preset-c1').fill('#00aa00');
  await page.getByTestId('flag-preset-c2').fill('#ffffff');
  await page.getByTestId('flag-preset-c3').fill('#cc0000');
  await page.getByTestId('flag-apply-preset').click();
  await page.getByTestId('flag-color').fill('#0000ff');
  const box = (await page.getByTestId('flag-canvas').boundingBox())!;
  await page.mouse.click(box.x + box.width * (18.5 / 36), box.y + box.height * (12.5 / 24)); // pixel (18, 12)
  await page.getByTestId('flag-save').click();

  // On the map at Warsaw: green hoist, red fly, the blue pixel in the middle.
  await expect.poll(() => flagPixel(page, 0.15, 0.5), { timeout: 20_000 }).toEqual([0, 170, 0]);
  expect(await flagPixel(page, 0.85, 0.5)).toEqual([204, 0, 0]);
  expect(await flagPixel(page, 18.5 / 36, 12.5 / 24)).toEqual([0, 0, 255]);
  expect(await flagPixel(page, 0.5, 0.1)).toEqual([255, 255, 255]);

  // The nation panel shows the same flag.
  await page.evaluate((p) => window.__warsim!.view!.select(p), POL);
  const panelFlag = await page.getByTestId('nation-flag').evaluate(async (img: HTMLImageElement) => {
    await img.decode();
    const c = document.createElement('canvas');
    c.width = 36;
    c.height = 24;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    return Array.from(ctx.getImageData(2, 12, 1, 1).data.slice(0, 3));
  });
  expect(panelFlag).toEqual([0, 170, 0]);

  const out = process.env['EVIDENCE'] ? path.resolve(import.meta.dirname, '../../docs/evidence/1.37') : info.outputPath();
  mkdirSync(out, { recursive: true });
  await page.screenshot({ path: path.join(out, 'flag-editor.png') });

  // Restore the scenario flag.
  await page.getByTestId('flag-reset').click();
  // Wait on a pixel that differs between the two flags (the top centre is white in both).
  await expect.poll(() => flagPixel(page, 0.15, 0.25), { timeout: 20_000 }).toEqual([255, 255, 255]);
  expect(await flagPixel(page, 0.5, 0.75)).not.toEqual([255, 255, 255]); // Poland's red half
});
