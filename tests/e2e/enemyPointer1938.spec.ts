import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import { POINTER_LEN } from '../../src/render/units/enemyPointers';
import { spriteTint } from '../../src/render/units/tint';
import { NATIONS_1938 } from '../../src/sim/scenario1938';
import { settle } from './settle';

// PLAN 7.34d AT (critic run 9, semantic zoom 7: "at 10 m/px on German infantry division 11 the
// enemy is off screen; the screen is all grey German figures", `c9c_4483_inf_0010m.png`). The
// critic's case: seed 4483, Germany at war with Poland, the camera at 10 m/px on the block of
// each German formation in contact, a day at a time. A formation in the second line of a file
// has its enemy's block 0.38 cells (7 km) off, and no element of the enemy in a 1600 × 900 frame
// (measured, PLAN 7.34d). Where the enemy it is in contact with is off the frame: one pointer
// toward it at the frame's edge, in its colour, and a click on it takes the camera to that enemy,
// whose elements are then in the frame. Where the enemy is in the frame: no pointer for it.

const id = (tag: string): number => NATIONS_1938.findIndex((n) => n.tag === tag) + 1;
const M_PER_PX = 10;

async function stepDay(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const w = window.__warsim!;
    const target = w.view!.lastTick + 24;
    await w.sim.step(24);
    await new Promise<void>((done) => {
      const wait = (): void => void (w.view!.lastTick >= target ? done() : setTimeout(wait, 10));
      wait();
    });
  });
}

async function look(page: Page, at: [number, number]): Promise<void> {
  await page.evaluate(({ x, y, m }) => {
    const v = window.__warsim!.view!;
    v.controller.set({ cx: x, cy: y, scale: (v.metresPerPx * v.controller.cam.scale) / m });
  }, { x: at[0], y: at[1], m: M_PER_PX });
  await page.waitForFunction(() => {
    const v = window.__warsim!.view!;
    return v.subscription?.tier === 3 && v.elementCount > 0 && v.elementOpacity > 0.99;
  }, null, { timeout: 30_000 });
  await settle(page);
}

/** What the view shows of formation `f` and its enemy: the enemy's block on the screen, the enemy's elements in the frame, the pointers. */
async function read(page: Page, f: number) {
  return page.evaluate((f) => {
    const v = window.__warsim!.view!;
    const cam = v.controller.cam;
    const o = (v as unknown as { overlay: HTMLCanvasElement }).overlay;
    const [vw, vh] = [o.clientWidth, o.clientHeight];
    const enemy = v.formationEnemy(f);
    const pos = v.formationPos(enemy);
    const e: [number, number] | null = pos ? [(pos[0] - cam.cx) * cam.scale + vw / 2, (pos[1] - cam.cy) * cam.scale + vh / 2] : null;
    let enemyEls = 0;
    for (let i = 0; i < v.elementCount; i++) {
      if (v.elementFormation[i] !== enemy) continue;
      const [x, y] = [(v.elementX[i]! - cam.cx) * cam.scale + vw / 2, (v.elementY[i]! - cam.cy) * cam.scale + vh / 2];
      if (x >= 0 && x <= vw && y >= 0 && y <= vh) enemyEls++;
    }
    const nation = v.formationTitle(enemy)?.nation ?? 0;
    const own = (v as unknown as { ownColor: Map<number, number> }).ownColor.get(nation) ?? 0x888888;
    return { mpp: v.metresPerPx, vw, vh, enemy, nation, own, name: v.formationTitle(f)?.name ?? '', enemyName: v.formationTitle(enemy)?.name ?? '', e, enemyEls, pointers: v.enemyPointersShown.map((p) => ({ ...p })) };
  }, f);
}

test("the critic's 4483 case at 10 m/px: the enemy of a formation in contact in the frame, or a pointer toward it", async ({ page }, info) => {
  test.setTimeout(600_000);
  const GER = id('GER');
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto('/?scenario=1938&paused=1&seed=4483');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null && window.__warsim!.sim.mapLayers !== null, null, { timeout: 60_000 });
  await page.evaluate(({ a, d }) => window.__warsim!.sim.command({ kind: 'declareWar', attacker: a, defender: d }), { a: GER, d: id('POL') });
  const out = process.env['EVIDENCE'] ? path.resolve(import.meta.dirname, '../../docs/evidence/7.34') : info.outputPath();
  mkdirSync(out, { recursive: true });

  let inFrame = 0;
  let pointed: { f: number; day: number } | null = null;
  for (let day = 1; day <= 6 && pointed === null; day++) {
    await stepDay(page);
    const forms = await page.evaluate((n) => {
      const v = window.__warsim!.view!;
      return v.formationsOf(n).filter((f) => v.formationEngaged(f) && v.formationEnemy(f) !== 0 && /Infantry|Armoured/i.test(v.formationTitle(f)?.kind ?? ''));
    }, GER);
    for (const f of forms) {
      await look(page, (await page.evaluate((f) => window.__warsim!.view!.formationPos(f)!, f)));
      const r = await read(page, f);
      expect(Math.round(r.mpp)).toBe(M_PER_PX);
      expect(r.e, `formation ${f}'s enemy ${r.enemy} in the snapshot`).not.toBeNull();
      const [ex, ey] = r.e!;
      const off = ex < 0 || ex > r.vw || ey < 0 || ey > r.vh;
      const mine = r.pointers.filter((p) => p.enemy === r.enemy);
      console.log(`day ${day}: ${r.name} (${f}) in contact with ${r.enemyName} (${r.enemy}), its block at ${ex.toFixed(0)}, ${ey.toFixed(0)} px${off ? ' (off the frame)' : ''}; ${r.enemyEls} of its elements in the frame; ${mine.length} pointer(s) toward it`);
      if (!off) {
        expect(mine.length, 'no pointer toward an enemy in the frame').toBe(0);
        inFrame++;
        continue;
      }
      // Off the frame: none of it in the view (the critic's screen), and one pointer toward it.
      expect(mine.length).toBe(1);
      const p = mine[0]!;
      const inset = Math.min(p.x, r.vw - p.x, p.y, r.vh - p.y);
      expect(inset, 'at the frame edge, inside it').toBeGreaterThanOrEqual(0);
      expect(inset).toBeLessThan(40);
      const way = Math.atan2(ey - p.y, ex - p.x);
      expect(Math.abs(Math.atan2(Math.sin(p.angle - way), Math.cos(p.angle - way))), 'pointing at the enemy block').toBeLessThan(1e-6);
      // Its arrow in the enemy's colour (the sprites' tint), read on the overlay inside the arrow.
      const px = await page.evaluate(({ x, y, a, len }) => {
        const v = window.__warsim!.view!;
        v.draw(performance.now());
        const c = (v as unknown as { overlay: HTMLCanvasElement }).overlay;
        const dpr = c.width / c.clientWidth;
        const [sx, sy] = [x - Math.cos(a) * len * 0.6, y - Math.sin(a) * len * 0.6];
        return Array.from(c.getContext('2d')!.getImageData(Math.round(sx * dpr), Math.round(sy * dpr), 1, 1).data);
      }, { x: p.x, y: p.y, a: p.angle, len: POINTER_LEN });
      const tint = spriteTint(r.own);
      const want = [(tint >> 16) & 255, (tint >> 8) & 255, tint & 255];
      console.log(`  pointer at ${p.x.toFixed(0)}, ${p.y.toFixed(0)} px, pointing ${((p.angle * 180) / Math.PI).toFixed(0)}°; arrow px ${px.join(',')}, the enemy's tint ${want.join(',')}`);
      expect(px[3]!).toBeGreaterThan(200);
      for (let k = 0; k < 3; k++) expect(Math.abs(px[k]! - want[k]!)).toBeLessThanOrEqual(3);
      await page.screenshot({ path: path.join(out, `d-4483-${f}-day${day}-10m.png`) });
      // A click on it: the camera at the enemy's block, at the same zoom, its elements in the frame.
      await page.mouse.click(p.x, p.y + 0);
      await page.waitForFunction((f) => {
        const v = window.__warsim!.view!;
        const pos = v.formationPos(v.formationEnemy(f))!;
        return Math.hypot(v.controller.cam.cx - pos[0], v.controller.cam.cy - pos[1]) < 1e-6;
      }, f, { timeout: 15_000 });
      await page.waitForFunction(() => window.__warsim!.view!.elementCount > 0 && window.__warsim!.view!.elementOpacity > 0.99, null, { timeout: 30_000 });
      await settle(page);
      const after = await read(page, f);
      const theirs = await page.evaluate((enemy) => {
        const v = window.__warsim!.view!;
        const cam = v.controller.cam;
        let n = 0;
        for (let i = 0; i < v.elementCount; i++) if (v.elementFormation[i] === enemy && Math.abs((v.elementX[i]! - cam.cx) * cam.scale) <= 800 && Math.abs((v.elementY[i]! - cam.cy) * cam.scale) <= 450) n++;
        return n;
      }, r.enemy);
      console.log(`  after the click: ${after.mpp.toFixed(1)} m/px, ${theirs} of ${r.enemyName}'s elements in the frame`);
      expect(Math.round(after.mpp)).toBe(M_PER_PX);
      expect(theirs).toBeGreaterThan(0);
      await page.screenshot({ path: path.join(out, `d-4483-${f}-day${day}-10m-clicked.png`) });
      pointed = { f, day };
      break;
    }
  }
  console.log(`seed 4483: ${inFrame} views with the enemy in the frame (no pointer); a pointer: ${JSON.stringify(pointed)}`);
  expect(inFrame).toBeGreaterThan(0);
  expect(pointed, 'a formation in contact whose enemy is off a 10 m/px frame').not.toBeNull();
});
