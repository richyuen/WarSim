import { expect, test } from '@playwright/test';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import { NATIONS_1938 } from '../../src/sim/scenario1938';
import { turretOf } from '../../src/shared/unitLooks';

// PLAN 7.9b (critic run 7, tanks 5: at 10 m/px "all the same grey ... nothing tells armour from
// infantry"): figures take their nation's colour (`spriteTint`), and Germany's #5d5d5d came out
// #6b6b6b under a dark outline, darker than the drab ground. A colour near grey now has a higher
// least lightness (GREY_LIGHT; tanks twice the size since PLAN 7.9c). The critic's fight (seed
// 7781, Germany on Poland, the first German armoured division in contact) at 10 m/px: the pixels
// at the German tanks' middles are told from the enemy's figures by colour and from the ground by
// lightness (before: 79 grey, 37 from the French, 27 under the ground). And a picture at T2.

const id = (tag: string): number => NATIONS_1938.findIndex((n) => n.tag === tag) + 1;
type Rgb = [number, number, number];
const lum = ([r, g, b]: Rgb): number => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const apart = (a: Rgb, b: Rgb): number => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

test("T3: Germany's tanks are told from the enemy's figures and from the ground", async ({ page }) => {
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 1400, height: 800 });
  await page.goto('/?scenario=1938&paused=1&seed=7781');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null, null, { timeout: 60_000 });
  const GER = id('GER');
  const turretFrames = Array.from({ length: 32 }, (_, f) => turretOf(f) >= 0);
  const count = () => page.evaluate(({ GER, turretFrames }) => {
    const v = window.__warsim!.view!;
    const canvas = document.querySelector('canvas')!;
    const gl = canvas.getContext('webgl2')!;
    v.draw(performance.now());
    const dpr = canvas.width / canvas.clientWidth;
    const cam = v.controller.cam;
    const read = (sx: number, sy: number): [number, number, number] => {
      const px = new Uint8Array(4 * 9);
      gl.readPixels(Math.round(sx * dpr) - 1, canvas.height - Math.round(sy * dpr) - 2, 3, 3, gl.RGBA, gl.UNSIGNED_BYTE, px);
      const s: [number, number, number] = [0, 0, 0];
      for (let k = 0; k < 9; k++) for (let c = 0; c < 3; c++) s[c] = s[c]! + px[k * 4 + c]! / 9;
      return s;
    };
    const index = new Map<number, number>();
    for (let i = 0; i < v.elementCount; i++) index.set(v.elementId[i]!, i);
    const nationOf = new Map<number, number>();
    const tanks: [number, number, number][] = [];
    const enemy: [number, number, number][] = [];
    const placed: [number, number][] = [];
    const [vw, vh] = [canvas.clientWidth, canvas.clientHeight];
    for (let j = 0; j < v.individualCount; j++) {
      const e = index.get(v.individualOwner[j]!);
      if (e === undefined) continue;
      const f = v.elementFormation[e]!;
      if (!nationOf.has(f)) nationOf.set(f, v.formationTitle(f)?.nation ?? 0);
      const sx = (v.individualX[j]! - cam.cx) * cam.scale + vw / 2;
      const sy = (v.individualY[j]! - cam.cy) * cam.scale + vh / 2;
      placed.push([sx, sy]);
      if (sx < 20 || sy < 60 || sx > vw - 20 || sy > vh - 120) continue;
      const n = nationOf.get(f)!;
      if (n === GER && turretFrames[v.elementFrame(e)]) tanks.push(read(sx, sy));
      else if (n !== GER && n !== 0) enemy.push(read(sx, sy));
    }
    // The ground: points of a grid 12 px or more from every figure.
    const ground: [number, number, number][] = [];
    for (let sy = 80; sy < vh - 140; sy += 23) {
      for (let sx = 30; sx < vw - 30; sx += 23) {
        if (placed.some(([x, y]) => Math.abs(x - sx) < 12 && Math.abs(y - sy) < 12)) continue;
        ground.push(read(sx, sy));
      }
    }
    const mean = (l: [number, number, number][]): [number, number, number] => {
      const m: [number, number, number] = [0, 0, 0];
      for (const c of l) for (let k = 0; k < 3; k++) m[k] = m[k]! + c[k]! / l.length;
      return m;
    };
    return { tanks: tanks.length, enemy: enemy.length, ground: ground.length, tank: mean(tanks), foe: mean(enemy), soil: mean(ground) };
  }, { GER, turretFrames });
  // The critic's fight was the first German armoured division in contact. Green at `896ff779`, red at
  // `9ffb0274`: the first one's view at 10 m/px holds fewer than 20 enemy figures there, so the war is stepped a
  // day at a time, within 15 days, and each armoured division in contact is looked at in turn until a
  // view holds more than 20 German tanks and more than 20 of the enemy's figures.
  await page.evaluate(([g, p]) => window.__warsim!.sim.command({ kind: 'declareWar', attacker: g!, defender: p! }), [GER, id('POL')]);
  let pick: { f: number; at: [number, number]; day: number } | null = null;
  let got: Awaited<ReturnType<typeof count>> | null = null;
  for (let day = 1; day <= 15 && pick === null; day++) {
    const arm = await page.evaluate(async (g) => {
      const { sim, view } = window.__warsim!;
      const tick = (await sim.step(24)).tick;
      await new Promise<void>((done) => {
        const wait = (): void => (view!.lastTick === tick ? done() : void setTimeout(wait, 5));
        wait();
      });
      return view!.formationsOf(g).filter((f) => view!.formationEngaged(f) && /Armou?red|Panzer|Tank/i.test(view!.formationTitle(f)?.kind ?? '')).map((f) => ({ f, at: view!.formationPos(f)! }));
    }, GER);
    for (const a of arm) {
      await page.evaluate(({ x, y }) => {
        const v = window.__warsim!.view!;
        v.controller.set({ cx: x, cy: y, scale: (v.metresPerPx * v.controller.cam.scale) / 10 });
      }, { x: a.at[0], y: a.at[1] });
      await page.waitForFunction(() => {
        const v = window.__warsim!.view!;
        return v.subscription?.tier === 3 && v.individualsShown && v.shares.individuals === 1 && v.individualCount > 0;
      }, null, { timeout: 15_000 });
      await page.waitForTimeout(1500);
      const seen = await count();
      console.log(`day ${day}, division ${a.f}: German tanks ${seen.tanks}, enemy figures ${seen.enemy}`);
      if (seen.tanks > 20 && seen.enemy > 20) {
        pick = { ...a, day };
        got = seen;
        break;
      }
    }
  }
  expect(pick, 'a German armoured division in contact with 20 enemy figures in its view within 15 days').not.toBeNull();
  if (!got || !pick) return;
  const f = (c: Rgb): string => c.map((x) => Math.round(x)).join(',');
  console.log(`German tanks ${got.tanks} (${f(got.tank)}), enemy figures ${got.enemy} (${f(got.foe)}), ground ${got.ground} (${f(got.soil)}); tank from enemy ${apart(got.tank, got.foe).toFixed(0)}, tank's lightness over the ground's ${(lum(got.tank) - lum(got.soil)).toFixed(0)}`);
  expect(got.tanks).toBeGreaterThan(20);
  expect(got.enemy).toBeGreaterThan(20);
  expect(apart(got.tank, got.foe), 'German tanks from the enemy, RGB').toBeGreaterThan(40);
  expect(Math.abs(lum(got.tank) - lum(got.soil)), "German tanks from the ground, lightness").toBeGreaterThan(20);
  await page.screenshot({ path: path.resolve('docs/evidence/7.9/b-tank-sides-10m.png'), clip: { x: 450, y: 250, width: 500, height: 300 } });
  // T2, the same ground at 60 m/px: the elements' sprites take the same tints.
  await page.evaluate(({ x, y }) => {
    const v = window.__warsim!.view!;
    v.controller.set({ cx: x, cy: y, scale: (v.metresPerPx * v.controller.cam.scale) / 60 });
  }, { x: pick!.at[0], y: pick!.at[1] });
  await page.waitForFunction(() => window.__warsim!.view!.subscription?.tier === 2, null, { timeout: 15_000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.resolve('docs/evidence/7.9/b-tank-sides-60m.png'), clip: { x: 450, y: 250, width: 500, height: 300 } });
});
