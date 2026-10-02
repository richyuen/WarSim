import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import { cellOf } from '../../src/sim/data/terrain';
import { NATIONS_1938, SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { assets1938 } from '../helpers/earth';

// PLAN 1.15: the 1938 map shows occupation. German control painted over central Poland
// (owner stays Poland) renders in the occupier's colour family (the occupation tint/hatch of
// SPEC §1), while untouched Polish land keeps the Polish fill.

const { w: W, h: H } = SIZE_1938;
const id = (tag: string): number => NATIONS_1938.findIndex((n) => n.tag === tag) + 1;
const GER = id('GER');
const POL = id('POL');
const dist = (a: number[], b: number[]): number => Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!);

test('occupied land renders with the occupation tint in the 1938 map', async ({ page }, info) => {
  test.setTimeout(90_000);
  const node = new Sim({ scenario: '1938', seed: 1938, assets: assets1938(W) });
  const rgb = (n: number): number[] => {
    const c = node.world.nations.cols.color[n]!;
    return [(c >> 16) & 255, (c >> 8) & 255, c & 255];
  };
  const [ox, oy] = cellOf(19.0, 52.4, W, H).map((v) => Math.floor(v) + 0.5) as [number, number];
  const [rx, ry] = cellOf(22.6, 50.8, W, H).map((v) => Math.floor(v) + 0.5) as [number, number];
  expect(node.world.cells.owner[Math.floor(oy) * W + Math.floor(ox)]).toBe(POL);
  expect(node.world.cells.owner[Math.floor(ry) * W + Math.floor(rx)]).toBe(POL);

  await page.setViewportSize({ width: 1200, height: 700 });
  await page.goto('/?scenario=1938&paused=1&seed=1938');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.view!.lastTick === 0, null, { timeout: 60_000 });
  await page.evaluate((cmd) => window.__warsim!.sim.command(cmd), { kind: 'paintControl', nation: GER, x: ox, y: oy, r: 3 } as const);
  await page.evaluate(() => window.__warsim!.sim.step(1));
  await page.waitForFunction(() => window.__warsim!.view!.lastTick === 1);

  const sample = (cx: number, cy: number): Promise<number[][]> =>
    page.evaluate(
      ({ cx, cy }) => {
        const v = window.__warsim!.view!;
        v.controller.set({ cx, cy, scale: 24 });
        v.draw();
        const c = document.getElementById('map') as HTMLCanvasElement;
        const gl = c.getContext('webgl2')!;
        const out: number[][] = [];
        const p = new Uint8Array(4);
        for (let dy = -6; dy <= 6; dy += 3) {
          for (let dx = -6; dx <= 6; dx += 3) {
            gl.readPixels(Math.floor(c.width / 2) + dx, Math.floor(c.height / 2) + dy, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, p);
            out.push([p[0]!, p[1]!, p[2]!]);
          }
        }
        return out;
      },
      { cx, cy },
    );

  const ger = rgb(GER);
  const pol = rgb(POL);
  const gerFamily = (p: number[]): number => Math.min(dist(p, ger), dist(p, ger.map((v) => v * 0.72)), dist(p, ger.map((v, k) => v * 0.65 + pol[k]! * 0.35)));
  const occ = await sample(ox, oy);
  const tinted = occ.filter((p) => gerFamily(p) < dist(p, pol)).length;
  expect(tinted, `occupied pixels ${JSON.stringify(occ)} vs GER ${ger} POL ${pol}`).toBeGreaterThanOrEqual(Math.ceil(occ.length * 0.8));
  // The hatch shows two shades: occupation is not drawn as a plain German fill.
  expect(new Set(occ.map((p) => p.join())).size).toBeGreaterThan(1);
  const ref = await sample(rx, ry);
  const polish = ref.filter((p) => dist(p, pol) < gerFamily(p)).length;
  expect(polish, `reference pixels ${JSON.stringify(ref)}`).toBeGreaterThanOrEqual(Math.ceil(ref.length * 0.8));

  const out = process.env['EVIDENCE'] ? path.resolve(import.meta.dirname, '../../docs/evidence/1.15') : info.outputPath();
  mkdirSync(out, { recursive: true });
  await page.evaluate(({ cx, cy }) => window.__warsim!.view!.controller.set({ cx, cy, scale: 10 }), { cx: ox, cy: oy });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(out, 'occupation-poland.png') });
});
