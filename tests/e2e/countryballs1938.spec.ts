import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import { BALL_R, ballShade, EYES_FULL_PX, EYES_NONE_PX, eyeCentres, OUTLINE_SHARE } from '../../src/render/units/ballShader';
import { FLAG_ATLAS_COLS, FLAG_PAD, FLAG_SLOT_H, FLAG_SLOT_W } from '../../src/render/units/flagAtlas';
import { FLAG_H, FLAG_W } from '../../src/shared/flagPixels';
import { FormationFlag } from '../../src/shared/protocol';
import { Frame } from '../../src/shared/unitLooks';
import { cellOf } from '../../src/sim/data/terrain';
import { NATIONS_1938, SIZE_1938, TEMPLATES_LAND } from '../../src/sim/scenario1938';

// PLAN 7.174c (ADR-777): the element sprites as countryballs. A German and a Polish infantry
// division brought into contact west of Poznań; at 100 m/px (T2) and 15 m/px (T3, where a ball is
// still its element: the user's choice) each ball that stands clear of the others has its flag's
// colour where the shader puts it (the flag atlas's texels, filtered and shaded as the shader
// does); at 15 m/px also a dark outline at its edge and two white eyes on the side it faces; at
// 100 m/px it is a flag dot: its flag's colour where the eyes would be. The balls are as many instanced draws as the classic
// sprites.

const id = (tag: string): number => NATIONS_1938.findIndex((n) => n.tag === tag) + 1;
const INFANTRY = TEMPLATES_LAND.findIndex((t) => t.id === 'infantry_div');
const { w: W, h: H } = SIZE_1938;
/** The frames whose least size is the element's (`elementPx`): no tank's or ship's. */
const FRAMES: number[] = [Frame.infantry, Frame.prone, Frame.gun];

/** A ball as the page read it: a box of device pixels about it, and its flag's slot from the atlas. */
interface Ball {
  facing: number;
  /** Ball centre in device px, relative to the box's top left. */
  cx: number;
  cy: number;
  /** Device px a ball unit. */
  half: number;
  side: number;
  /** RGB, rows from the top. */
  box: number[];
  /** The slot's texels, FLAG_SLOT_W × FLAG_SLOT_H RGB, rows from the top. */
  flag: number[];
}

async function open(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1400, height: 800 });
  await page.addInitScript(() => localStorage.setItem('warsim.unitLook', 'balls'));
  await page.goto('/?scenario=1938&paused=1&seed=1938');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null, null, { timeout: 60_000 });
}

/** Draws once and reads each ball clear of the others in the view (at most 24). */
function readBalls(page: Page): Promise<{ balls: Ball[]; px: number; dpr: number }> {
  return page.evaluate(
    ({ frames, cols, slotW, slotH }) => {
      const v = window.__warsim!.view!;
      const canvas = document.getElementById('map') as HTMLCanvasElement;
      const gl = canvas.getContext('webgl2')!;
      v.draw(performance.now());
      const dpr = canvas.width / canvas.clientWidth;
      const cam = v.controller.cam;
      const [vw, vh] = [canvas.clientWidth, canvas.clientHeight];
      const size = v.elementPx;
      const atlas = v.flagAtlas;
      const screen = (i: number): [number, number] => [(v.elementX[i]! - cam.cx) * cam.scale + vw / 2, (v.elementY[i]! - cam.cy) * cam.scale + vh / 2];
      const balls: Ball[] = [];
      for (let i = 0; i < v.elementCount && balls.length < 24; i++) {
        if (!frames.includes(v.elementFrame(i)) || v.elementFlagSlot(i) < 0) continue;
        const [sx, sy] = screen(i);
        if (sx < size || sy < size || sx > vw - size || sy > vh - size) continue;
        // Clear of every other element: one drawn after it could cover it.
        let clear = true;
        for (let j = 0; j < v.elementCount && clear; j++) if (j !== i && Math.hypot(screen(j)[0] - sx, screen(j)[1] - sy) < size * 1.05) clear = false;
        if (!clear) continue;
        const half = (size / 2) * dpr;
        const x0 = Math.floor(sx * dpr - half) - 1;
        const y0 = Math.floor(sy * dpr - half) - 1;
        const side = Math.ceil(2 * half) + 3;
        const raw = new Uint8Array(side * side * 4);
        gl.readPixels(x0, canvas.height - y0 - side, side, side, gl.RGBA, gl.UNSIGNED_BYTE, raw);
        const box: number[] = [];
        for (let y = side - 1; y >= 0; y--) for (let x = 0; x < side; x++) box.push(raw[(y * side + x) * 4]!, raw[(y * side + x) * 4 + 1]!, raw[(y * side + x) * 4 + 2]!);
        const slot = v.elementFlagSlot(i);
        const fx = (slot % cols) * slotW;
        const fy = Math.floor(slot / cols) * slotH;
        const flag: number[] = [];
        for (let y = 0; y < slotH; y++) for (let x = 0; x < slotW; x++) for (let k = 0; k < 3; k++) flag.push(atlas.pixels[((fy + y) * 2048 + fx + x) * 4 + k]!);
        balls.push({ facing: v.elementFacing(i), cx: sx * dpr - x0, cy: sy * dpr - y0, half, side, box, flag });
      }
      return { balls, px: size, dpr };
    },
    { frames: FRAMES, cols: FLAG_ATLAS_COLS, slotW: FLAG_SLOT_W, slotH: FLAG_SLOT_H },
  );
}

/** The pixel of `b` nearest (x, y) in ball units: its colour and its centre in ball units. */
function at(b: Ball, x: number, y: number): { rgb: number[]; p: [number, number] } {
  const dx = Math.floor(b.cx + x * b.half);
  const dy = Math.floor(b.cy + y * b.half);
  const o = (dy * b.side + dx) * 3;
  return { rgb: [b.box[o]!, b.box[o + 1]!, b.box[o + 2]!], p: [(dx + 0.5 - b.cx) / b.half, (dy + 0.5 - b.cy) / b.half] };
}

/** The flag's colour the shader draws at p (ball units): LINEAR-filtered texels, shaded. */
function flagAt(b: Ball, [px, py]: [number, number]): number[] {
  const u = Math.min(1, Math.max(0, 0.5 + px / (2 * BALL_R)));
  const v = Math.min(1, Math.max(0, 0.5 + py / (2 * BALL_R)));
  const tx = FLAG_PAD + u * FLAG_W - 0.5;
  const ty = FLAG_PAD + v * FLAG_H - 0.5;
  const x0 = Math.floor(tx);
  const y0 = Math.floor(ty);
  const texel = (x: number, y: number, k: number): number => b.flag[(y * FLAG_SLOT_W + x) * 3 + k]!;
  const shade = ballShade(px, py);
  return [0, 1, 2].map((k) => {
    const fx = tx - x0;
    const fy = ty - y0;
    const c = (texel(x0, y0, k) * (1 - fx) + texel(x0 + 1, y0, k) * fx) * (1 - fy) + (texel(x0, y0 + 1, k) * (1 - fx) + texel(x0 + 1, y0 + 1, k) * fx) * fy;
    return Math.min(255, c * shade);
  });
}

const dist = (a: number[], b: number[]): number => Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!);
const white = (c: number[]): boolean => Math.min(...c) > 200;

/** How many instanced draws one frame makes. */
function instancedDraws(page: Page): Promise<number> {
  return page.evaluate(() => {
    const canvas = document.getElementById('map') as HTMLCanvasElement;
    const gl = canvas.getContext('webgl2')!;
    const real = gl.drawArraysInstanced.bind(gl);
    let n = 0;
    gl.drawArraysInstanced = (...a: Parameters<typeof real>): void => {
      n++;
      real(...a);
    };
    window.__warsim!.view!.draw(performance.now());
    gl.drawArraysInstanced = real;
    return n;
  });
}

test('countryballs at T2 and T3: the flag in the ball, the outline, the eyes toward the facing; as many draws as classic', async ({ page }, info) => {
  test.setTimeout(300_000);
  await open(page);
  const [px, py] = cellOf(16.3, 52.4, W, H);
  const GER = id('GER');
  const POL = id('POL');
  const ids = await page.evaluate(
    async ({ GER, POL, INFANTRY, px, py }) => {
      const { sim, view } = window.__warsim!;
      sim.command({ kind: 'declareWar', attacker: GER, defender: POL });
      const before = new Set([...view!.formationsOf(GER), ...view!.formationsOf(POL)]);
      sim.command({ kind: 'spawnFormation', nation: GER, x: px - 0.35, y: py, strength: 0, template: INFANTRY });
      sim.command({ kind: 'spawnFormation', nation: POL, x: px + 0.35, y: py, strength: 0, template: INFANTRY });
      const tick = (await sim.step(1)).tick;
      await new Promise<void>((done) => {
        const wait = (): void => (view!.lastTick === tick ? done() : void setTimeout(wait, 5));
        wait();
      });
      return [...view!.formationsOf(GER), ...view!.formationsOf(POL)].filter((f) => !before.has(f));
    },
    { GER, POL, INFANTRY, px, py },
  );
  expect(ids).toHaveLength(2);
  const look = async (m: number): Promise<void> => {
    const ps = await page.evaluate((ids) => ids.map((f) => window.__warsim!.view!.formationPos(f)!), ids);
    const [cx, cy] = [(ps[0]![0] + ps[1]![0]) / 2, (ps[0]![1] + ps[1]![1]) / 2];
    await page.evaluate(({ cx, cy, m }) => {
      const v = window.__warsim!.view!;
      v.controller.set({ cx, cy, scale: (v.metresPerPx * v.controller.cam.scale) / m });
    }, { cx, cy, m });
    await page.waitForFunction(() => (window.__warsim!.view!.subscription?.tier ?? 0) >= 2 && window.__warsim!.view!.elementCount > 0, null, { timeout: 20_000 });
  };

  // Step until the two divisions are in contact (at most ten days).
  await look(100);
  let engaged = false;
  for (let h = 0; h < 240 && !engaged; h += 6) {
    engaged = await page.evaluate(
      async ({ ids, bit }) => {
        const { sim, view } = window.__warsim!;
        const tick = (await sim.step(6)).tick;
        await new Promise<void>((done) => {
          const wait = (): void => (view!.lastTick === tick ? done() : void setTimeout(wait, 5));
          wait();
        });
        for (let i = 0; i < view!.elementCount; i++) if (ids.includes(view!.elementFormation[i]!) && (view!.elementFlags[i]! & bit) !== 0) return true;
        return false;
      },
      { ids, bit: FormationFlag.engaged },
    );
  }
  expect(engaged, 'the two divisions in contact').toBe(true);

  for (const m of [100, 15]) {
    await look(m);
    await page.waitForTimeout(1500);
    const { balls, px: size, dpr } = await readBalls(page);
    await page.screenshot({ path: path.join(info.outputPath(), `balls-${m}m.png`) });
    let flagOk = 0;
    let flagAll = 0;
    let worst = 0;
    let outlineDark = 0;
    let eyesWhite = 0;
    for (const b of balls) {
      const away = Math.cos(b.facing) >= 0 ? -1 : 1; // the side without the eyes
      // A dot without eyes is its flag where the eyes would be (a white there may be the flag's),
      // inside the band where the shader blends the rim and the outline (a device px of it each).
      const inner = BALL_R - OUTLINE_SHARE - 2 / b.half;
      const dotEyes = eyeCentres(b.facing).filter(([x, y]) => Math.hypot(x, y) < inner);
      const points: [number, number][] = size >= EYES_FULL_PX ? [[0.45 * away, 0.45], [0.45 * away, -0.3], [0, 0.55]] : size <= EYES_NONE_PX ? [[0, 0], ...dotEyes] : [[0, 0]];
      for (const [x, y] of points) {
        const { rgb, p } = at(b, x, y);
        const d = dist(rgb, flagAt(b, p));
        worst = Math.max(worst, d);
        flagAll++;
        if (d <= 40) flagOk++;
      }
      // The darkest pixel on the way down from 0.7 to the rim.
      let dark = 255;
      for (let r = 0.7; r <= BALL_R; r += 0.25 / b.half) dark = Math.min(dark, Math.max(...at(b, 0, r).rgb));
      if (dark < 90) outlineDark++;
      const eyes = eyeCentres(b.facing).map(([x, y]) => at(b, x, y).rgb);
      if (eyes.every(white)) eyesWhite++;
    }
    console.log(`${m} m/px: ball ${size.toFixed(1)} px (dpr ${dpr}), ${balls.length} balls clear of the others; flag points ${flagOk} of ${flagAll} within 40 (worst ${worst.toFixed(0)}); outline dark ${outlineDark}; both eyes white ${eyesWhite}`);
    expect(balls.length, `${m} m/px: balls read`).toBeGreaterThanOrEqual(8);
    expect(flagOk, `${m} m/px: the flag's colour where the shader puts it${size <= EYES_NONE_PX ? ', at the eyes too (a flag dot)' : ''}`).toBe(flagAll);
    if (size >= EYES_FULL_PX) {
      expect(outlineDark, `${m} m/px: the outline`).toBe(balls.length);
      expect(eyesWhite, `${m} m/px: two white eyes`).toBe(balls.length);
    }
  }

  // As many instanced draws as the classic sprites, at both zooms.
  for (const m of [100, 15]) {
    await look(m);
    await page.waitForTimeout(800);
    const balls = await instancedDraws(page);
    await page.evaluate(() => window.__warsim!.settings.setUnitLook('classic'));
    const classic = await instancedDraws(page);
    await page.evaluate(() => window.__warsim!.settings.setUnitLook('balls'));
    console.log(`${m} m/px: instanced draws in a frame, balls ${balls}, classic ${classic}`);
    expect(balls, `${m} m/px`).toBe(classic);
  }
});
