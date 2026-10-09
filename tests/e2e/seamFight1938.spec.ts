import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import type { Command } from '../../src/shared/commands';
import { NATIONS_1938, SIZE_1938, TEMPLATES_LAND } from '../../src/sim/scenario1938';
import { settle } from './settle';

// PLAN 3.12Rt: a block over the seam of a map that loops is drawn in every view that holds it.
// A block deployed over the seam keeps the x of its formation's side (under 0, or the map's
// width and over), and the page drew the copies of the map its view touched: a view of the
// columns the block stands in, ending short of the seam, showed the enemy's block firing at
// nothing. The copies now take a margin (`SEAM_MARGIN`).
//
// 1938's seam is the 180th meridian, in Chukotka: Soviet land both sides of it. A Soviet and a
// Japanese division, a cell from the seam and 0.2 cells over it, meet 0.4 cells beside it: the
// block of the one that came over the seam is the one left unfolded. Once each way, a row apart.

const nation = (tag: string): number => NATIONS_1938.findIndex((n) => n.tag === tag) + 1;
const infantry = TEMPLATES_LAND.findIndex((t) => t.id === 'infantry_div');
const SOV = nation('SOV');
const JAP = nation('JAP');
const W = SIZE_1938.w;
const VIEW = { width: 1400, height: 800 };
/** Rows of Chukotka with land for two cells either side of the seam and no formation of the order of battle. */
const EAST_ROW = 140.5;
const WEST_ROW = 132.5;

async function step(page: Page, cmds: Command[], hours = 1): Promise<void> {
  await page.evaluate(async ({ cmds, hours }) => {
    const sim = window.__warsim!.sim;
    for (const c of cmds) sim.command(c);
    const tick = (await sim.step(hours)).tick;
    await new Promise<void>((done) => {
      const wait = (): void => (window.__warsim!.view!.lastTick === tick ? done() : void setTimeout(wait, 5));
      wait();
    });
  }, { cmds, hours });
}

test('a fight beside the seam of the looping map is whole in a view that ends short of the seam, from either side', async ({ page }, info) => {
  test.setTimeout(180_000);
  const out = process.env['EVIDENCE'] !== undefined ? path.resolve(import.meta.dirname, '../../docs/evidence/3.12') : info.outputPath();
  mkdirSync(out, { recursive: true });
  await page.setViewportSize(VIEW);
  await page.goto('/?scenario=1938&paused=1&seed=1938');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null && window.__warsim!.sim.mapLayers !== null, null, { timeout: 60_000 });
  await step(page, [
    { kind: 'setSetting', key: 'aiEnabled', value: false },
    { kind: 'declareWar', attacker: JAP, defender: SOV },
    // East of the seam: the Soviet division comes over it.
    { kind: 'spawnFormation', nation: JAP, x: 1, y: EAST_ROW, strength: 0, template: infantry },
    { kind: 'spawnFormation', nation: SOV, x: W - 0.2, y: EAST_ROW, strength: 0, template: infantry },
    // West of it: the Japanese one does.
    { kind: 'spawnFormation', nation: SOV, x: W - 1, y: WEST_ROW, strength: 0, template: infantry },
    { kind: 'spawnFormation', nation: JAP, x: 0.2, y: WEST_ROW, strength: 0, template: infantry },
  ]);
  const ids = (await page.evaluate(() => window.__warsim!.view!.formationIds())).sort((a, b) => a - b).slice(-4);
  // A day of it, so that the pictures are of a fight with losses.
  await step(page, [], 24);

  for (const [name, cx, cy, pair] of [['east', 0.75, EAST_ROW, ids.slice(0, 2)], ['west', W - 0.75, WEST_ROW, ids.slice(2)]] as const) {
    // 20 m/px: 28 km, 1.43 cells, from 0.03 to 1.47 cells off the seam; the fight below the ranking panel.
    await page.evaluate(({ x, y }) => {
      const v = window.__warsim!.view!;
      v.controller.set({ cx: x, cy: y, scale: (v.metresPerPx * v.controller.cam.scale) / 20 });
    }, { x: cx, y: cy - 0.15 });
    await page.waitForFunction(({ pair }) => {
      const v = window.__warsim!.view!;
      if (Math.abs(v.elementsZoom / 20 - 1) >= 0.01) return false;
      const got = new Set<number>();
      for (let i = 0; i < v.elementCount; i++) got.add(v.elementFormation[i]!);
      return pair.every((f) => got.has(f));
    }, { pair }, { timeout: 20_000 });
    await settle(page);

    const seen = await page.evaluate(({ pair, w }) => {
      const v = window.__warsim!.view!;
      const cam = v.controller.cam;
      const half = window.innerWidth / 2 / cam.scale;
      const sides = pair.map((id) => {
        const xs: number[] = [];
        const ys: number[] = [];
        for (let i = 0; i < v.elementCount; i++) {
          if (v.elementFormation[i] !== id) continue;
          xs.push(v.elementX[i]!);
          ys.push(v.elementY[i]!);
        }
        // Where its first element is on the screen, in the copy of the map that has it there.
        const sx = [-w, 0, w].map((off) => (xs[0]! + off - cam.cx) * cam.scale + window.innerWidth / 2).find((px) => px >= 0 && px <= window.innerWidth) ?? -1;
        const sy = (ys[0]! - cam.cy) * cam.scale + window.innerHeight / 2;
        return { id, n: xs.length, unfolded: xs.filter((x) => x < 0 || x >= w).length, folded: xs.filter((x) => Math.abs(((x % w) + w) % w - cam.cx) <= half).length, sx, picked: v.formationPick(sx, sy), tag: v.tagRects.filter((t) => t.id === id).length };
      });
      return { cam: { cx: cam.cx, scale: cam.scale }, view: [cam.cx - half, cam.cx + half], m: v.metresPerPx, sides, tags: v.tagRects.map((t) => ({ id: t.id, x: t.x, w: t.w })) };
    }, { pair, w: W });
    console.log(`${name} of the seam, 20 m/px, the view from ${seen.view[0]!.toFixed(2)} to ${seen.view[1]!.toFixed(2)}: ${seen.sides.map((s) => `formation ${s.id}: ${s.n} elements, ${s.unfolded} unfolded, ${s.folded} in the view's columns, tags ${s.tag}, picked ${s.picked}`).join('; ')}`);
    // An hour of the fight, stepped while the view is on it: the shots of both blocks fly in the
    // view, every frame of their life looked through, and the picture is of the hour's first.
    await step(page, [], 1);
    const flown = await page.evaluate(({ pair }) => {
      const v = window.__warsim!.view!;
      const of = new Map<number, number>();
      for (let i = 0; i < v.elementCount; i++) of.set(v.elementId[i]!, v.elementFormation[i]!);
      const { from, until } = v.fire;
      const n = new Map<number, number>();
      for (let now = from; now < until + 32; now += 16) {
        v.drawUnitLayers(now);
        for (const t of v.fire.tracers) n.set(of.get(t.shooter) ?? 0, (n.get(of.get(t.shooter) ?? 0) ?? 0) + 1);
      }
      v.draw();
      return pair.map((f) => n.get(f) ?? 0);
    }, { pair });
    console.log(`${name} of the seam: tracers in flight over the hour's frames, by the shooter's formation: ${flown.join(', ')}`);
    await page.screenshot({ path: path.join(out, `seam-fight-${name}.png`) });
    for (const [i, f] of flown.entries()) expect(f, `tracers in the view from formation ${pair[i]}`).toBeGreaterThan(0);

    // The view ends short of the seam.
    expect(seen.view[0]).toBeGreaterThan(0);
    expect(seen.view[1]).toBeLessThan(W);
    // One of the two blocks is whole over the seam, its x unfolded; both stand in the view's columns.
    expect(seen.sides.map((s) => s.unfolded > 0).sort()).toEqual([false, true]);
    for (const s of seen.sides) {
      expect(s.n).toBeGreaterThan(15);
      expect(s.folded, `elements of formation ${s.id} in the view's columns`).toBe(s.n);
      // Each has its tag in the view, and is the formation under the pointer at one of its elements.
      expect(s.tag, `tags of formation ${s.id}`).toBe(1);
      const tag = seen.tags.find((t) => t.id === s.id)!;
      expect(tag.x + tag.w).toBeGreaterThan(0);
      expect(tag.x).toBeLessThan(VIEW.width);
      expect(s.picked, `the formation under an element of formation ${s.id}`).toBe(s.id);
    }
  }
});
