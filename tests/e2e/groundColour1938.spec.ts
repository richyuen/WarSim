import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import terrainJson from '../../data/terrain.json' with { type: 'json' };
import { Terrain } from '../../src/shared/terrain';
import { NATIONS_1938, SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { cellOf } from '../../src/sim/data/terrain';
import { assets1938 } from '../helpers/earth';
import { lookAt, open1938 } from './mapView';

// PLAN 2.14d (the critic's R2-B2, "the ground is the nation's colour"): at T2 and T3 the ground
// was the nation's fill, lit and grained: Berlin grey noise for being German, the Alps salmon
// pink for being Swiss, Chad sky blue for being French. The ground now has the terrain's colour
// and the fill is a cast on it: slight away from a border, strong at one.

const nation = (tag: string): number => NATIONS_1938.findIndex((n) => n.tag === tag) + 1;
const rgbOf = (hex: string): [number, number, number] => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
const apart = (a: readonly number[], b: readonly number[]): number => Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!);

interface Place {
  x: number;
  y: number;
  fill: [number, number, number];
}

/**
 * Two places of one terrain class, each four cells or more from any other nation's land and from
 * water, one in each of two nations; and a place on the border between the two, where they have
 * one. From the world in Node.
 */
function places(a: string, b: string, cls: number): { inA: Place; inB: Place; border: Place | null } {
  const w = new Sim({ scenario: '1938', seed: 1938, assets: assets1938(SIZE_1938.w) }).world;
  const { owner, terrain, w: cw, h: ch } = w.cells;
  const fill = (n: number): [number, number, number] => {
    const c = w.nations.cols.color[n]!;
    return [(c >> 16) & 255, (c >> 8) & 255, c & 255];
  };
  const deep = (n: number): Place => {
    for (let y = 6; y < ch - 6; y++) {
      for (let x = 6; x < cw - 6; x++) {
        let ok = true;
        for (let dy = -4; dy <= 4 && ok; dy++) for (let dx = -4; dx <= 4 && ok; dx++) ok = owner[(y + dy) * cw + x + dx] === n && (Math.abs(dx) > 1 || Math.abs(dy) > 1 || terrain[(y + dy) * cw + x + dx] === cls);
        if (ok) return { x: x + 0.5, y: y + 0.5, fill: fill(n) };
      }
    }
    throw new Error(`no place of class ${cls} deep in nation ${n}`);
  };
  const [na, nb] = [nation(a), nation(b)];
  let border: Place | null = null;
  for (let y = 6; y < ch - 6 && !border; y++) for (let x = 6; x < cw - 6 && !border; x++) if (owner[y * cw + x] === na && owner[y * cw + x + 1] === nb && terrain[y * cw + x]! >= Terrain.Plains && terrain[y * cw + x + 1]! >= Terrain.Plains) border = { x: x + 1, y: y + 0.5, fill: fill(na) };
  return { inA: deep(na), inB: deep(nb), border };
}

/** The mean colour of the middle size × size px (300 unless said) of the map canvas at rest: the ground alone, nothing standing on it, no sprites. */
function meanColour(page: Page, relief: boolean, size = 300): Promise<[number, number, number]> {
  return page.evaluate(({ relief, size }) => {
    const v = window.__warsim!.view!;
    v.instances = false;
    v.sprites = false;
    v.relief = relief;
    v.draw(performance.now() + 1e6);
    const c = document.getElementById('map') as HTMLCanvasElement;
    const gl = c.getContext('webgl2')!;
    const [w, h] = [size, size];
    const px = new Uint8Array(w * h * 4);
    gl.readPixels(Math.floor((c.width - w) / 2), Math.floor((c.height - h) / 2), w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
    const sum = [0, 0, 0];
    for (let i = 0; i < w * h * 4; i += 4) for (let k = 0; k < 3; k++) sum[k]! += px[i + k]!;
    v.relief = true;
    v.instances = true;
    v.sprites = true;
    return [sum[0]! / (w * h), sum[1]! / (w * h), sum[2]! / (w * h)] as [number, number, number];
  }, { relief, size });
}

test('at T2 and T3 the ground has the terrain\'s colour; the nation is a cast on it, slight inland and strong at a border', async ({ page }, info) => {
  test.setTimeout(240_000);
  const out = process.env['EVIDENCE'] !== undefined ? path.resolve(import.meta.dirname, '../../docs/evidence/2.14') : info.outputPath();
  mkdirSync(out, { recursive: true });
  await open1938(page);
  expect(await page.evaluate(() => window.devicePixelRatio)).toBe(1);
  // Plains deep in Germany (grey) and deep in the Soviet Union (dark red): two fills far apart.
  const p = places('GER', 'SOV', Terrain.Plains);
  const plains = rgbOf(terrainJson.terrain[Terrain.Plains]!.color);
  expect(apart(p.inA.fill, p.inB.fill), 'the two fills, apart in RGB').toBeGreaterThan(80);

  for (const m of [150, 20]) {
    // The fills, as T0 and T1 have them and as the ground had them until now: the picture without the ground.
    await lookAt(page, p.inA.x, p.inA.y, m);
    const fillA = await meanColour(page, false);
    const groundA = await meanColour(page, true);
    await lookAt(page, p.inB.x, p.inB.y, m);
    const fillB = await meanColour(page, false);
    const groundB = await meanColour(page, true);
    console.log(`${m} m/px, plains deep in Germany and in the Soviet Union: the fills ${fillA.map(Math.round).join(', ')} and ${fillB.map(Math.round).join(', ')} (${apart(fillA, fillB).toFixed(0)} apart); the ground ${groundA.map(Math.round).join(', ')} and ${groundB.map(Math.round).join(', ')} (${apart(groundA, groundB).toFixed(0)} apart); the terrain's colour ${plains.join(', ')}`);
    // Without the ground a place is its nation's fill.
    expect(apart(fillA, p.inA.fill), `${m} m/px: Germany's fill`).toBeLessThan(6);
    expect(apart(fillB, p.inB.fill), `${m} m/px: the Soviet fill`).toBeLessThan(6);
    // With it: the same terrain on two nations' land is nearly one colour, a fifth of what the fills differ by or less,
    // and each is nearer the terrain's colour than its nation's.
    expect(apart(groundA, groundB) / apart(fillA, fillB), `${m} m/px: the two grounds against the two fills`).toBeLessThan(0.2);
    expect(apart(groundA, plains), `${m} m/px: Germany's ground from the plains' colour`).toBeLessThan(apart(groundA, p.inA.fill) * 0.5);
    expect(apart(groundB, plains), `${m} m/px: the Soviet ground from the plains' colour`).toBeLessThan(apart(groundB, p.inB.fill) * 0.5);
    // And still not quite one: a view with no border in it has a cast of its nation.
    expect(apart(groundA, groundB), `${m} m/px: the cast`).toBeGreaterThan(6);
  }

  // At a border the fills show: 150 px either side of a border between two nations differ by far more than inland.
  const q = places('GER', 'POL', Terrain.Plains);
  expect(q.border, 'a German cell with a Polish one east of it').not.toBeNull();
  const side = async (dx: number): Promise<[number, number, number]> => {
    await lookAt(page, q.border!.x + dx, q.border!.y, 150);
    return meanColour(page, true, 40);
  };
  // A box of 40 px with its middle 0.3 cells from the cells' edge (a cell is 130 px at 150 m/px): from 0.15 to 0.45 cells off it.
  // (The drawn border is a smooth line near that edge, up to a third of a cell from it.)
  const west = await side(-0.3);
  const east = await side(0.3);
  await lookAt(page, q.inA.x, q.inA.y, 150);
  const deepA = await meanColour(page, true);
  await lookAt(page, q.inB.x, q.inB.y, 150);
  const deepB = await meanColour(page, true);
  const inland = apart(deepA, deepB);
  console.log(`150 m/px either side of the German-Polish border: ${apart(west, east).toFixed(0)} apart in RGB; plains deep in each: ${inland.toFixed(0)}`);
  expect(apart(west, east), 'either side of the border').toBeGreaterThan(inland * 2);

  // The three places the critic named, looked at: Berlin, the Alps, Chad.
  for (const [name, lon, lat, m] of [['berlin', 13.4, 52.5, 20], ['alps', 8.2, 46.6, 60], ['chad', 18.5, 15.5, 5]] as const) {
    const [x, y] = cellOf(lon, lat, SIZE_1938.w, SIZE_1938.h);
    await lookAt(page, x, y, m);
    await page.screenshot({ path: path.join(out, `ground-${name}-${m}m.png`) });
  }
  await lookAt(page, q.border!.x, q.border!.y, 150);
  await page.screenshot({ path: path.join(out, 'ground-border-150m.png') });
});
