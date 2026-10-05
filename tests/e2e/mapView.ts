import type { Page } from '@playwright/test';
import type {} from '../../src/app/testApi';
import { settle } from './settle';

/** Opens `url` in a view of 1400 × 800 and waits for the first frame. */
export async function open(page: Page, url: string): Promise<void> {
  await page.setViewportSize({ width: 1400, height: 800 });
  await page.goto(url);
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0, null, { timeout: 60_000 });
}

/** The 1938 world with its map layers and its elevation in the renderer. */
export async function open1938(page: Page, seed = 1938): Promise<void> {
  await open(page, `/?scenario=1938&paused=1&seed=${seed}`);
  await page.waitForFunction(() => window.__warsim!.hud.stats.value !== null && window.__warsim!.sim.mapLayers !== null && window.__warsim!.sim.elevation !== null, null, { timeout: 60_000 });
}

/** The camera on cell (`cx`, `cy`) at `mPerPx` metres to a CSS px, at rest. */
export async function lookAt(page: Page, cx: number, cy: number, mPerPx: number): Promise<void> {
  await page.evaluate(({ cx, cy, m }) => {
    const v = window.__warsim!.view!;
    v.controller.set({ cx, cy, scale: (v.metresPerPx * v.controller.cam.scale) / m });
  }, { cx, cy, m: mPerPx });
  await settle(page);
}

export interface GroundMeasure {
  /** The picture with the ground of T2 and T3 is, pixel for pixel, the picture without it. */
  same: boolean;
  /** A hash of the picture with the ground. */
  hash: string;
  /** The share of the view that the largest fill has (found in the picture without the ground, where a fill is one colour). */
  fill: number;
  /** In that fill, with the ground: the mean difference of brightness (0–255) between a pixel and the next, to the right and downwards. */
  fineX: number;
  fineY: number;
  /** The same across the two columns either side of the view's middle, where a map's seam is when the camera stands on it. */
  middleX: number;
  /** Blocks of 64 × 64 px wholly in the fill, and how many different pictures they are. */
  blocks: number;
  distinct: number;
}

/**
 * The map canvas at rest, drawn without the ground (`view.relief` off) and with it, and what the
 * ground does to the largest fill of the view. The ground alone: its shading and its texture,
 * without the trees, rocks and buildings that stand on it (PLAN 2.8c2, `groundThings1938`).
 */
export function measureGround(page: Page): Promise<GroundMeasure> {
  return page.evaluate(() => {
    const v = window.__warsim!.view!;
    v.instances = false;
    const c = document.getElementById('map') as HTMLCanvasElement;
    const gl = c.getContext('webgl2')!;
    const now = performance.now() + 1e6; // every fade is over
    const read = (relief: boolean): Uint8Array => {
      v.relief = relief;
      v.draw(now);
      const px = new Uint8Array(c.width * c.height * 4);
      gl.readPixels(0, 0, c.width, c.height, gl.RGBA, gl.UNSIGNED_BYTE, px);
      return px;
    };
    const fnv = (px: Uint8Array | number[]): number => {
      let h = 0x811c9dc5;
      for (let i = 0; i < px.length; i++) h = Math.imul(h ^ px[i]!, 0x01000193);
      return h >>> 0;
    };
    const off = read(false);
    const on = read(true);
    let same = true;
    for (let i = 0; i < on.length && same; i++) same = on[i] === off[i];
    const [w, h] = [c.width, c.height];
    const key = (i: number): number => (off[i * 4]! << 16) | (off[i * 4 + 1]! << 8) | off[i * 4 + 2]!;
    const counts = new Map<number, number>();
    for (let i = 0; i < w * h; i++) counts.set(key(i), (counts.get(key(i)) ?? 0) + 1);
    const [fill, n] = [...counts].sort((a, b) => b[1] - a[1])[0] ?? [0, 0];
    const inFill = new Uint8Array(w * h);
    const lum = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) {
      inFill[i] = key(i) === fill ? 1 : 0;
      lum[i] = 0.2126 * on[i * 4]! + 0.7152 * on[i * 4 + 1]! + 0.0722 * on[i * 4 + 2]!;
    }
    const sum = { x: 0, nx: 0, y: 0, ny: 0, mid: 0, nMid: 0 };
    for (let y = 0; y < h - 1; y++) {
      for (let x = 0; x < w - 1; x++) {
        const i = y * w + x;
        if (!inFill[i]) continue;
        if (inFill[i + 1]) {
          const d = Math.abs(lum[i + 1]! - lum[i]!);
          if (x === w / 2 - 1) {
            sum.mid += d;
            sum.nMid++;
          } else {
            sum.x += d;
            sum.nx++;
          }
        }
        if (inFill[i + w]) {
          sum.y += Math.abs(lum[i + w]! - lum[i]!);
          sum.ny++;
        }
      }
    }
    const blocks: number[] = [];
    for (let by = 0; by + 64 <= h; by += 64) {
      for (let bx = 0; bx + 64 <= w; bx += 64) {
        const bytes: number[] = [];
        let whole = true;
        for (let y = by; y < by + 64 && whole; y++) {
          for (let x = bx; x < bx + 64; x++) {
            const i = y * w + x;
            if (!inFill[i]) {
              whole = false;
              break;
            }
            bytes.push(on[i * 4]!, on[i * 4 + 1]!, on[i * 4 + 2]!);
          }
        }
        if (whole) blocks.push(fnv(bytes));
      }
    }
    return {
      same,
      hash: fnv(on).toString(16).padStart(8, '0'),
      fill: n / (w * h),
      fineX: sum.x / Math.max(1, sum.nx),
      fineY: sum.y / Math.max(1, sum.ny),
      middleX: sum.mid / Math.max(1, sum.nMid),
      blocks: blocks.length,
      distinct: new Set(blocks).size,
    };
  });
}
