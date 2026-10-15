import { expect, test } from '@playwright/test';
import type {} from '../../src/app/testApi';
import { lookAt, open1938 } from './mapView';

// PLAN 7.1l8: at a fractional device pixel ratio the T1 markers' boxes, on their way into the
// T2 sprites, were pictures of themselves drawn whole into the box's rectangle: at 1.25 the
// picture is 38 × 27 device px for art of 37.5 × 26.25 (the box 3 % short), and at 1.5 a box's
// corner stands on a half pixel that the picture did not. So the first frame of the morph was
// not the box at rest: here 20,695 of 101,092 drawn pixels of the overlay differed at 1.25 and
// 22,089 of 143,085 at 1.5; with the picture at the box's scale and between the same two device
// pixels, 92 and 135. The markers at rest and at a morph's scale of 0.9999 must be one picture.

for (const dpr of [1.25, 1.5]) {
  test.describe(`at a device pixel ratio of ${dpr}`, () => {
    test.use({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: dpr });

    test('the first frame of the markers’ morph into T2 is the markers at rest', async ({ page }) => {
      await open1938(page);
      await lookAt(page, 1110, 268, 1000);
      const got = await page.evaluate(() => {
        const v = window.__warsim!.view! as unknown as {
          dispose(): void;
          tierShares: () => void;
          shares: { markers: number; elements: number; individuals: number };
          morph: { box: number; scale: number; bar: number };
          drawUnitLayers(now: number, pixels: boolean): void;
          overlay: HTMLCanvasElement;
          markerRects: unknown[];
        };
        // The view's loop stopped, the tiers held at T1: only the morph's scale changes.
        v.dispose();
        v.tierShares = () => {};
        const now = performance.now() + 1e7;
        const draw = (scale: number): Uint8ClampedArray => {
          Object.assign(v.shares, { markers: 1, elements: 0, individuals: 0 });
          v.morph = { box: 1, scale, bar: 1 };
          v.drawUnitLayers(now, true);
          return v.overlay.getContext('2d')!.getImageData(0, 0, v.overlay.width, v.overlay.height).data;
        };
        const rest = draw(1);
        const morph = draw(0.9999);
        let drawn = 0;
        let differ = 0;
        for (let i = 0; i < rest.length; i += 4) {
          if (rest[i + 3]! > 0) drawn++;
          let d = 0;
          for (let c = 0; c < 4; c++) d = Math.max(d, Math.abs(rest[i + c]! - morph[i + c]!));
          if (d > 24) differ++;
        }
        return { drawn, differ, markers: v.markerRects.length };
      });
      console.log(`ratio ${dpr}: ${got.markers} markers, ${got.drawn} px drawn, ${got.differ} differ`);
      expect(got.markers).toBeGreaterThan(20);
      expect(got.differ, `${got.differ} of ${got.drawn} px`).toBeLessThan(got.drawn * 0.005);
    });
  });
}
