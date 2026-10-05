import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import { cellOf } from '../../src/sim/data/terrain';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { lookAt, measureGround, open1938 } from './mapView';

// PLAN 2.9b2 (ADR-79): at T2 and T3 the coast is drawn from the fine land mask, the mask the
// sim stands its formations on (PLAN 2.9a, 2.9b1). Until this task every coast was the coverage,
// a quarter as fine: land of the mask could be sea in the picture, and an element on it stood in
// the drawn water. At T0 and T1 the coast stays the coverage's.
//
// The map canvas is read without the sprites and without what stands on the ground. Water is
// one colour (the sea has no shading); the mask is the copy the worker sent. A place is surely
// land, or surely water, when the mask's 3 × 3 pixels round it are all the one: the drawn coast
// may wander inside a pixel of the mask's, and no further.

const { w: W, h: H } = SIZE_1938;

interface Agreement {
  land: number;
  water: number;
  /** Surely land in the mask, water in the picture; and the other way. */
  drowned: number;
  dry: number;
  coast: number;
}

/** The picture of the view at rest against the mask, at places 6 px apart. */
function agreement(page: Page): Promise<Agreement> {
  return page.evaluate(({ W, H }) => {
    const v = window.__warsim!.view!;
    const m = window.__warsim!.sim.landMask!;
    v.instances = false;
    v.sprites = false;
    v.draw(performance.now() + 1e6);
    const c = document.getElementById('map') as HTMLCanvasElement;
    const gl = c.getContext('webgl2')!;
    const px = new Uint8Array(c.width * c.height * 4);
    gl.readPixels(0, 0, c.width, c.height, gl.RGBA, gl.UNSIGNED_BYTE, px);
    const bit = (mx: number, my: number): boolean => {
      if (my < 0 || my >= m.h) return false;
      const i = my * m.w + (((mx % m.w) + m.w) % m.w);
      return ((m.bits[i >> 3]! >> (i & 7)) & 1) === 1;
    };
    /** 1 surely land, 0 surely water, -1 within a mask pixel of the coast. */
    const sure = (x: number, y: number): number => {
      const [mx, my] = [Math.floor((x * m.w) / W), Math.floor((y * m.h) / H)];
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (bit(mx + dx, my + dy)) n++;
      return n === 9 ? 1 : n === 0 ? 0 : -1;
    };
    const cam = v.controller.cam;
    const dpr = c.width / c.clientWidth;
    const samples: { kind: number; colour: number }[] = [];
    for (let sy = 3; sy < c.clientHeight; sy += 6) {
      for (let sx = 3; sx < c.clientWidth; sx += 6) {
        const kind = sure(cam.cx + (sx - c.clientWidth / 2) / cam.scale, cam.cy + (sy - c.clientHeight / 2) / cam.scale);
        const i = ((c.height - 1 - Math.floor(sy * dpr)) * c.width + Math.floor(sx * dpr)) * 4;
        samples.push({ kind, colour: (px[i]! << 16) | (px[i + 1]! << 8) | px[i + 2]! });
      }
    }
    // The sea's colour: the one most of the surely-water places have.
    const counts = new Map<number, number>();
    for (const s of samples) if (s.kind === 0) counts.set(s.colour, (counts.get(s.colour) ?? 0) + 1);
    const sea = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? -1;
    const out = { land: 0, water: 0, drowned: 0, dry: 0, coast: 0 };
    for (const s of samples) {
      if (s.kind === 1) {
        out.land++;
        if (s.colour === sea) out.drowned++;
      } else if (s.kind === 0) {
        out.water++;
        if (s.colour !== sea) out.dry++;
      } else out.coast++;
    }
    return out;
  }, { W, H });
}

/** The place on the mask's coast nearest to cell (`x`, `y`): the middle of the edge between a land pixel and a water pixel. */
function coastNear(page: Page, x: number, y: number): Promise<[number, number]> {
  return page.evaluate(({ x, y, W, H }) => {
    const m = window.__warsim!.sim.landMask!;
    const bit = (mx: number, my: number): boolean => {
      const i = my * m.w + (((mx % m.w) + m.w) % m.w);
      return ((m.bits[i >> 3]! >> (i & 7)) & 1) === 1;
    };
    const [cx, cy] = [Math.floor((x * m.w) / W), Math.floor((y * m.h) / H)];
    let best: [number, number] = [x, y];
    let near = Infinity;
    for (let dy = -40; dy <= 40; dy++)
      for (let dx = -40; dx <= 40; dx++) {
        const [mx, my] = [cx + dx, cy + dy];
        if (bit(mx, my) === bit(mx + 1, my)) continue;
        const d = Math.hypot(dx + 0.5, dy);
        if (d < near) {
          near = d;
          best = [((mx + 1) * W) / m.w, ((my + 0.5) * H) / m.h];
        }
      }
    return best;
  }, { x, y, W, H });
}

test('at T2 and T3 land and water in the picture are the fine mask’s, to within a pixel of it', async ({ page }, info) => {
  test.setTimeout(240_000);
  await open1938(page);
  await page.waitForFunction(() => window.__warsim!.sim.landMask !== null, null, { timeout: 60_000 });
  const out = process.env['EVIDENCE'] ? path.resolve(import.meta.dirname, '../../docs/evidence/2.9') : info.outputPath();
  mkdirSync(out, { recursive: true });
  for (const [name, lon, lat] of [['dover', 1.4, 51.0], ['aegean', 23.6, 37.9], ['norway', 6.0, 61.1]] as const) {
    const [x, y] = cellOf(lon, lat, W, H);
    const [sx, sy] = await coastNear(page, x, y);
    for (const [mPerPx, cx, cy] of [[150, x, y], [40, sx, sy], [10, sx, sy]] as const) {
      await lookAt(page, cx, cy, mPerPx);
      const a = await agreement(page);
      console.log(`${name}, ${mPerPx} m/px: ${a.land} places surely land and ${a.water} surely water by the mask (${a.coast} within a pixel of its coast); land drawn as sea ${a.drowned}, sea drawn as land ${a.dry}`);
      await page.evaluate(() => {
        const v = window.__warsim!.view!;
        v.sprites = true;
        v.instances = true;
        v.draw(performance.now() + 1e6);
      });
      await page.screenshot({ path: path.join(out, `coast-${name}-${mPerPx}m.png`) });
      // A coast is in the view: enough of both to compare.
      expect(a.land, `${name}, ${mPerPx} m/px: places surely land`).toBeGreaterThan(300);
      expect(a.water, `${name}, ${mPerPx} m/px: places surely water`).toBeGreaterThan(300);
      expect(a.drowned, `${name}, ${mPerPx} m/px: the mask's land drawn as sea`).toBe(0);
      expect(a.dry, `${name}, ${mPerPx} m/px: the mask's sea drawn as land`).toBe(0);
    }
  }
});

test('at T3 no element near a coast has the drawn sea under its middle', async ({ page }) => {
  test.setTimeout(240_000);
  await open1938(page, 99);
  await page.waitForFunction(() => window.__warsim!.sim.landMask !== null, null, { timeout: 60_000 });
  // The formations nearest the mask's water (as coastElements1938 finds them).
  const coastal = await page.evaluate(({ W, H }) => {
    const v = window.__warsim!.view!;
    const m = window.__warsim!.sim.landMask!;
    const bit = (px: number, py: number): boolean => {
      if (py < 0 || py >= m.h) return false;
      const i = py * m.w + (((px % m.w) + m.w) % m.w);
      return ((m.bits[i >> 3]! >> (i & 7)) & 1) === 1;
    };
    const k = m.w / W;
    const list: { id: number; x: number; y: number; sea: number }[] = [];
    for (const id of v.formationIds()) {
      const [x, y] = v.formationPos(id)!;
      const [px, py] = [Math.floor(x * k), Math.floor((y * m.h) / H)];
      let sea = Infinity;
      for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) if (!bit(px + dx, py + dy)) sea = Math.min(sea, Math.hypot(dx, dy) / k);
      if (sea < 0.5) list.push({ id, x, y, sea });
    }
    return list.sort((a, b) => a.sea - b.sea);
  }, { W, H });
  expect(coastal.length).toBeGreaterThanOrEqual(12);

  let elements = 0;
  let withSea = 0;
  const inSea: string[] = [];
  for (const c of coastal.slice(0, 12)) {
    // 20 m/px: the formation's block and the water by it are both in the view.
    await lookAt(page, c.x, c.y, 20);
    await page.waitForFunction((id) => {
      const v = window.__warsim!.view!;
      for (let i = 0; i < v.elementCount; i++) if (v.elementFormation[i] === id) return true;
      return false;
    }, c.id, { timeout: 30_000 });
    const got = await page.evaluate(({ id, W, H }) => {
      const v = window.__warsim!.view!;
      const m = window.__warsim!.sim.landMask!;
      v.instances = false;
      v.sprites = false;
      v.draw(performance.now() + 1e6);
      const c = document.getElementById('map') as HTMLCanvasElement;
      const gl = c.getContext('webgl2')!;
      const px = new Uint8Array(c.width * c.height * 4);
      gl.readPixels(0, 0, c.width, c.height, gl.RGBA, gl.UNSIGNED_BYTE, px);
      const dpr = c.width / c.clientWidth;
      const cam = v.controller.cam;
      const colourAt = (x: number, y: number): number | null => {
        const [sx, sy] = [c.clientWidth / 2 + (x - cam.cx) * cam.scale, c.clientHeight / 2 + (y - cam.cy) * cam.scale];
        if (sx < 0 || sy < 0 || sx >= c.clientWidth || sy >= c.clientHeight) return null;
        const i = ((c.height - 1 - Math.floor(sy * dpr)) * c.width + Math.floor(sx * dpr)) * 4;
        return (px[i]! << 16) | (px[i + 1]! << 8) | px[i + 2]!;
      };
      const bit = (mx: number, my: number): boolean => {
        if (my < 0 || my >= m.h) return false;
        const i = my * m.w + (((mx % m.w) + m.w) % m.w);
        return ((m.bits[i >> 3]! >> (i & 7)) & 1) === 1;
      };
      // The sea's colour in this view: at the middle of a mask pixel whose 3 × 3 are all water.
      let sea: number | null = null;
      const [fx, fy] = v.formationPos(id)!;
      const [cx, cy] = [Math.floor((fx * m.w) / W), Math.floor((fy * m.h) / H)];
      for (let dy = -6; dy <= 6 && sea === null; dy++)
        for (let dx = -6; dx <= 6 && sea === null; dx++) {
          let n = 0;
          for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if (bit(cx + dx + i, cy + dy + j)) n++;
          if (n === 0) sea = colourAt(((cx + dx + 0.5) * W) / m.w, ((cy + dy + 0.5) * H) / m.h);
        }
      const out = { n: 0, sea: sea !== null, wet: [] as string[] };
      for (let i = 0; i < v.elementCount; i++) {
        if (v.elementFormation[i] !== id) continue;
        out.n++;
        if (sea !== null && colourAt(v.elementX[i]!, v.elementY[i]!) === sea) out.wet.push(`element ${v.elementId[i]} of formation ${id}`);
      }
      v.sprites = true;
      v.instances = true;
      return out;
    }, { id: c.id, W, H });
    elements += got.n;
    if (got.sea) withSea++;
    inSea.push(...got.wet);
  }
  console.log(`12 formations nearest the water at 20 m/px: ${elements} elements; the sea in ${withSea} of the views; elements with the drawn sea under their middle: ${inSea.length}`);
  expect(elements).toBeGreaterThan(150);
  expect(withSea, 'views with sea in them').toBeGreaterThanOrEqual(8);
  expect(inSea).toEqual([]);
});

test('at T0 and T1 the coast is as it was: with the ground of T2 and without it the picture is one, pixel for pixel', async ({ page }) => {
  test.setTimeout(150_000);
  await open1938(page);
  await page.waitForFunction(() => window.__warsim!.sim.landMask !== null, null, { timeout: 60_000 });
  const [x, y] = cellOf(1.4, 51.0, W, H); // the Strait of Dover
  // The mask's coast comes with the ground (the pass that draws the one draws the other). Without
  // the ground the map is the map of before PLAN 2.8: the coverage's coast.
  for (const mPerPx of [4000, 1000, 400]) {
    await lookAt(page, x, y, mPerPx);
    const m = await measureGround(page);
    console.log(`the Strait of Dover, ${mPerPx} m/px: the picture ${m.hash}; the same without the ground: ${m.same}`);
    expect(m.same, `${mPerPx} m/px: the map with the ground and without it`).toBe(true);
  }
  // And the comparison can tell: at T2 the two differ on this coast.
  await lookAt(page, x, y, 150);
  expect((await measureGround(page)).same, '150 m/px: the map with the ground and without it').toBe(false);
});
