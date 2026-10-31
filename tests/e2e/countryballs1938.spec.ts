import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import { BALL_R, BallClass, ballClassOf, ballShade, BallState, EYES_FULL_PX, EYES_NONE_PX, eyeCentres, FLINCH_HZ, OUTLINE_SHARE, propPoint, WING_RGB } from '../../src/render/units/ballShader';
import { WING_RY, WING_Y } from '../../src/render/units/ball2d';
import { FLAG_ATLAS_COLS, FLAG_PAD, FLAG_SLOT_H, FLAG_SLOT_W } from '../../src/render/units/flagAtlas';
import { PLANE_BALL } from '../../src/render/units/sorties';
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
  /** `BallState` bits as uploaded: engaged, hit. */
  state: number;
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
    ({ frames, cols, slotW, slotH, shakeHz }) => {
      const v = window.__warsim!.view!;
      const canvas = document.getElementById('map') as HTMLCanvasElement;
      const gl = canvas.getContext('webgl2')!;
      // A time when a flinch's shake is nought (PLAN 7.174e): a whole number of its periods.
      const now = (Math.ceil(((performance.now() + 100) * shakeHz) / 1000) * 1000) / shakeHz;
      v.draw(now);
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
        balls.push({ facing: v.elementFacing(i), state: v.elementBallState(i), cx: sx * dpr - x0, cy: sy * dpr - y0, half, side, box, flag });
      }
      return { balls, px: size, dpr };
    },
    { frames: FRAMES, cols: FLAG_ATLAS_COLS, slotW: FLAG_SLOT_W, slotH: FLAG_SLOT_H, shakeHz: 2 * FLINCH_HZ },
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
    let calm = 0;
    let eyesWhite = 0;
    let underFire = 0;
    let eyesSquint = 0;
    for (const b of balls) {
      const away = Math.cos(b.facing) >= 0 ? -1 : 1; // the side without the eyes
      // A dot without eyes is its flag where the eyes would be (a white there may be the flag's),
      // inside the band where the shader blends the rim and the outline (a device px of it each).
      const inner = BALL_R - OUTLINE_SHARE - 2 / b.half;
      const dotEyes = eyeCentres(b.facing).filter(([x, y]) => Math.hypot(x, y) < inner);
      const points: [number, number][] = size >= EYES_FULL_PX ? [[0.45 * away, 0.45], [0.45 * away, -0.15], [0, 0.55]] : size <= EYES_NONE_PX ? [[0, 0], ...dotEyes] : [[0, 0]];
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
      // Under fire the eyes are squeezed to dark slits (a flinch); else white, but for a blink.
      if ((b.state & BallState.hit) !== 0) {
        underFire++;
        if (eyes.every((c) => Math.max(...c) < 90)) eyesSquint++;
      } else {
        calm++;
        if (eyes.every(white)) eyesWhite++;
      }
    }
    console.log(`${m} m/px: ball ${size.toFixed(1)} px (dpr ${dpr}), ${balls.length} balls clear of the others; flag points ${flagOk} of ${flagAll} within 40 (worst ${worst.toFixed(0)}); outline dark ${outlineDark}; both eyes white ${eyesWhite} of ${calm} not under fire, squeezed dark ${eyesSquint} of ${underFire} under fire`);
    expect(balls.length, `${m} m/px: balls read`).toBeGreaterThanOrEqual(8);
    expect(flagOk, `${m} m/px: the flag's colour where the shader puts it${size <= EYES_NONE_PX ? ', at the eyes too (a flag dot)' : ''}`).toBe(flagAll);
    if (size >= EYES_FULL_PX) {
      expect(outlineDark, `${m} m/px: the outline`).toBe(balls.length);
      // A blink shuts a ball's eyes for 0.18 s in 3 to 6: a ninth of the balls may blink.
      expect(eyesWhite, `${m} m/px: two white eyes, not under fire`).toBeGreaterThanOrEqual(Math.floor(calm * 0.89));
      expect(eyesSquint, `${m} m/px: two dark slits, under fire`).toBeGreaterThanOrEqual(Math.floor(underFire * 0.89));
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

// PLAN 7.174d (ADR-777): the class by props. A German panzer and infantry division west of Berlin
// and a battle squadron in the Baltic, at 15 m/px (T3) and 60 m/px (T2, where a ball is still over
// EYES_FULL_PX): for each ball whose prop point (`propPoint`) is clear of every other element's
// ball, the pixel there is the prop's colour. Infantry's helmet, a tank's treads and its turret's
// barrel (along the turret's aim, as the classic turret turned), a gun's barrel, a ship's hull.
test('countryballs wear their class: helmet, treads and barrel, the gun, the hull', async ({ page }, info) => {
  test.setTimeout(300_000);
  await open(page);
  await page.waitForFunction(() => window.__warsim!.hud.templates.value.length > 0, null, { timeout: 30_000 });
  const GER = id('GER');
  const [bx, by] = cellOf(12.6, 52.5, W, H);
  const [sx, sy] = cellOf(14.5, 54.8, W, H);
  await page.evaluate(
    async ({ GER, bx, by, sx, sy }) => {
      const { sim, view, hud } = window.__warsim!;
      const t = hud.templates.value;
      const idx = (k: string): number => t.findIndex((x) => x.nameKey === k);
      // After the first hour: the month's start at tick 0 lays up a fleet (as hullsSea1938 does).
      await sim.step(1);
      sim.command({ kind: 'spawnFormation', nation: GER, x: bx - 0.4, y: by, strength: 0, template: idx('template.panzer_div') });
      sim.command({ kind: 'spawnFormation', nation: GER, x: bx + 0.4, y: by, strength: 0, template: idx('template.infantry_div') });
      sim.command({ kind: 'spawnFleet', nation: GER, x: sx, y: sy, template: idx('template.battle_squadron') });
      const tick = (await sim.step(1)).tick;
      await new Promise<void>((done) => {
        const wait = (): void => (view!.lastTick === tick ? done() : void setTimeout(wait, 5));
        wait();
      });
    },
    { GER, bx, by, sx, sy },
  );
  const found = new Map<number, { checked: number; ok: number; worst: number }>();
  for (const [name, x, y] of [
    ['panzer', bx - 0.4, by],
    ['infantry', bx + 0.4, by],
    ['fleet', sx, sy],
  ] as const) {
    for (const m of [15, 60]) {
      await page.evaluate(({ x, y, m }) => {
        const v = window.__warsim!.view!;
        v.controller.set({ cx: x, cy: y, scale: (v.metresPerPx * v.controller.cam.scale) / m });
      }, { x, y, m });
      await page.waitForFunction(() => (window.__warsim!.view!.subscription?.tier ?? 0) >= 2 && window.__warsim!.view!.elementCount > 0, null, { timeout: 20_000 });
      await page.waitForTimeout(1500);
      // The elements on the screen: where, how big, what, which way.
      const els = await page.evaluate(() => {
        const v = window.__warsim!.view!;
        const canvas = document.getElementById('map') as HTMLCanvasElement;
        const cam = v.controller.cam;
        const [vw, vh] = [canvas.clientWidth, canvas.clientHeight];
        const out: { sx: number; sy: number; px: number; frame: number; facing: number; aim: number | null }[] = [];
        for (let i = 0; i < v.elementCount; i++) out.push({ sx: (v.elementX[i]! - cam.cx) * cam.scale + vw / 2, sy: (v.elementY[i]! - cam.cy) * cam.scale + vh / 2, px: v.elementBallPx(i), frame: v.elementFrame(i), facing: v.elementFacing(i), aim: v.elementTurretAim(i) });
        return { out, dpr: canvas.width / vw, vw, vh };
      });
      // Each ball's prop points (the turret's too), where no other element's ball is.
      const probes: { cls: number; x: number; y: number; rgb: readonly number[] }[] = [];
      for (const [k, e] of els.out.entries()) {
        if (e.px < EYES_FULL_PX) continue;
        const cls = ballClassOf(e.frame);
        const props = [{ cls, pt: propPoint(cls, e.facing) }];
        if (e.aim !== null) props.push({ cls: BallClass.turret, pt: propPoint(BallClass.turret, e.aim) });
        for (const { cls: c, pt } of props) {
          if (!pt) continue;
          const x = e.sx + (pt.p[0] * e.px) / 2;
          const y = e.sy + (pt.p[1] * e.px) / 2;
          if (x < 4 || y < 4 || x > els.vw - 4 || y > els.vh - 4) continue;
          // A turret's barrel is drawn over every ball (the turrets come after the elements).
          const clear = c === BallClass.turret || els.out.every((o, j) => j === k || Math.hypot(o.sx - x, o.sy - y) > (o.px / 2) * BALL_R + 3);
          if (clear) probes.push({ cls: c, x, y, rgb: pt.rgb });
        }
      }
      const got = await page.evaluate(
        ({ probes, dpr }) => {
          const canvas = document.getElementById('map') as HTMLCanvasElement;
          const gl = canvas.getContext('webgl2')!;
          window.__warsim!.view!.draw(performance.now());
          const out = new Uint8Array(4);
          return probes.map((p) => {
            gl.readPixels(Math.floor(p.x * dpr), canvas.height - 1 - Math.floor(p.y * dpr), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, out);
            return [out[0]!, out[1]!, out[2]!];
          });
        },
        { probes, dpr: els.dpr },
      );
      await page.screenshot({ path: path.join(info.outputPath(), `props-${name}-${m}m.png`) });
      probes.forEach((p, i) => {
        const d = dist(got[i]!, p.rgb.map((c) => c * 255));
        const f = found.get(p.cls) ?? { checked: 0, ok: 0, worst: 0 };
        f.checked++;
        if (d <= 40) f.ok++;
        else console.log(`${name} at ${m} m/px, class ${p.cls}: (${p.x.toFixed(1)}, ${p.y.toFixed(1)}) got ${got[i]!.join(',')}, want ${p.rgb.map((c) => Math.round(c * 255)).join(',')}`);
        f.worst = Math.max(f.worst, d);
        found.set(p.cls, f);
      });
    }
  }
  const name = (c: number): string => Object.entries(BallClass).find(([, v]) => v === c)![0];
  for (const [c, f] of [...found].sort((a, b) => a[0] - b[0])) console.log(`${name(c)}: prop colour at ${f.ok} of ${f.checked} points (worst ${f.worst.toFixed(0)})`);
  for (const c of [BallClass.infantry, BallClass.tank, BallClass.turret, BallClass.gun, BallClass.ship]) {
    const f = found.get(c);
    expect(f?.checked ?? 0, `${name(c)}: points read`).toBeGreaterThanOrEqual(3);
    expect(f!.ok, `${name(c)}: the prop's colour`).toBe(f!.checked);
  }
});

// PLAN 7.174e (ADR-777): the balls move on the render clock. A German infantry division ordered
// east, the game paused while it marches: the same frame drawn at one time is the same picture,
// and drawn 0.3 s later its balls stand elsewhere (they bob); a division at rest drawn 0.3 s apart
// moves only for a blink.
test('countryballs on the march bob: two frames 0.3 s apart differ in their places', async ({ page }, info) => {
  test.setTimeout(240_000);
  await open(page);
  const GER = id('GER');
  const [bx, by] = cellOf(12.6, 52.5, W, H);
  const f = await page.evaluate(
    async ({ GER, INFANTRY, bx, by }) => {
      const { sim, view } = window.__warsim!;
      const before = new Set(view!.formationsOf(GER));
      sim.command({ kind: 'spawnFormation', nation: GER, x: bx, y: by, strength: 0, template: INFANTRY });
      let tick = (await sim.step(1)).tick;
      const wait = (t: number): Promise<void> =>
        new Promise<void>((done) => {
          const go = (): void => (view!.lastTick === t ? done() : void setTimeout(go, 5));
          go();
        });
      await wait(tick);
      const f = view!.formationsOf(GER).find((x) => !before.has(x))!;
      sim.command({ kind: 'moveFormation', id: f, x: bx + 3, y: by });
      tick = (await sim.step(3)).tick;
      await wait(tick);
      return f;
    },
    { GER, INFANTRY, bx, by },
  );
  const [fx, fy] = (await page.evaluate((f) => window.__warsim!.view!.formationPos(f), f))!;
  await page.evaluate(({ fx, fy }) => {
    const v = window.__warsim!.view!;
    v.controller.set({ cx: fx, cy: fy, scale: (v.metresPerPx * v.controller.cam.scale) / 15 });
  }, { fx, fy });
  await page.waitForFunction(() => (window.__warsim!.view!.subscription?.tier ?? 0) >= 2 && window.__warsim!.view!.elementCount > 0, null, { timeout: 20_000 });
  await page.waitForTimeout(2000); // past the tick's interpolation
  const marching = await page.evaluate((f) => {
    const v = window.__warsim!.view!;
    let n = 0;
    for (let i = 0; i < v.elementCount; i++) if (v.elementFormation[i] === f && v.elementWalks(i)) n++;
    return n;
  }, f);
  expect(marching, 'the division on the march').toBeGreaterThan(10);
  // The rows of ball pixels (unlike the ground) about the division, drawn at `ms` of the clock.
  const shot = (ms: number): Promise<number[]> =>
    page.evaluate((ms) => {
      const v = window.__warsim!.view!;
      const canvas = document.getElementById('map') as HTMLCanvasElement;
      const gl = canvas.getContext('webgl2')!;
      v.draw(ms);
      const px = new Uint8Array(canvas.width * canvas.height * 4);
      gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, px);
      return Array.from(px.filter((_, k) => k % 4 !== 3));
    }, ms);
  const t0 = await page.evaluate(() => performance.now() + 10_000);
  const a = await shot(t0);
  const same = await shot(t0);
  const later = await shot(t0 + 300);
  const differ = (x: number[], y: number[]): number => {
    let n = 0;
    for (let k = 0; k < x.length; k += 3) if (Math.abs(x[k]! - y[k]!) + Math.abs(x[k + 1]! - y[k + 1]!) + Math.abs(x[k + 2]! - y[k + 2]!) > 60) n++;
    return n;
  };
  const still = differ(a, same);
  const moved = differ(a, later);
  await page.screenshot({ path: path.join(info.outputPath(), 'march-15m.png') });
  console.log(`march at 15 m/px: ${marching} balls walking; pixels changed drawing one time twice ${still}, 0.3 s later ${moved}`);
  expect(still, 'one time, one picture').toBe(0);
  expect(moved, '0.3 s later the balls stand elsewhere').toBeGreaterThan(marching * 20);
});

/** The map and its overlays composed at device px (counters, markers and planes are on the overlay): RGB rows. */
function composite(page: Page): Promise<{ px: number[]; w: number; h: number; dpr: number }> {
  return page.evaluate(() => {
    const v = window.__warsim!.view!;
    v.draw(performance.now());
    const c = document.getElementById('map') as HTMLCanvasElement;
    const out = document.createElement('canvas');
    out.width = c.width;
    out.height = c.height;
    const ctx = out.getContext('2d')!;
    ctx.drawImage(c, 0, 0);
    for (const o of document.querySelectorAll<HTMLCanvasElement>('canvas.map-labels')) ctx.drawImage(o, 0, 0, c.width, c.height);
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    const px: number[] = [];
    for (let k = 0; k < d.length; k += 4) px.push(d[k]!, d[k + 1]!, d[k + 2]!);
    return { px, w: c.width, h: c.height, dpr: c.width / c.clientWidth };
  });
}

/** The colours of nation `n`'s flag that hold a twentieth of it or more. */
function flagColours(page: Page, n: number): Promise<number[][]> {
  return page.evaluate((n) => {
    const px = window.__warsim!.view!.flags.pixelsOf(n);
    const count = new Map<number, number>();
    for (const c of px) count.set(c, (count.get(c) ?? 0) + 1);
    return [...count].filter(([, k]) => k >= px.length / 20).map(([c]) => [(c >> 16) & 255, (c >> 8) & 255, c & 255]);
  }, n);
}

/** The share of the pixels within `r` CSS px of (x, y) that are one of `colours` (within 60: the ball's shading about them). */
function discOf(img: { px: number[]; w: number; dpr: number }, x: number, y: number, r: number, colours: number[][]): number {
  let n = 0;
  let near = 0;
  for (let dy = -r; dy <= r; dy += 0.5)
    for (let dx = -r; dx <= r; dx += 0.5) {
      if (dx * dx + dy * dy > r * r) continue;
      const o = (Math.floor((y + dy) * img.dpr) * img.w + Math.floor((x + dx) * img.dpr)) * 3;
      const c = [img.px[o]!, img.px[o + 1]!, img.px[o + 2]!];
      n++;
      if (colours.some((f) => dist(c, f) <= 60)) near++;
    }
  return near / Math.max(1, n);
}

// PLAN 7.174f (ADR-777): the far tiers and the sky in the ball look. At 3000 m/px (T0) each
// counter's chip is a ball of its nation's flag; at 800 m/px (T1) each marker's box; a click on a
// marker's ball opens its formation's panel; Germany at war with Poland, the planes over the front
// are winged balls of their flags.
test('countryballs far out and in the air: counters and markers are flag balls; a click opens the panel; planes have wings', async ({ page }, info) => {
  test.setTimeout(400_000);
  await open(page);
  const [bx, by] = cellOf(14, 52, W, H);
  const at = async (x: number, y: number, m: number): Promise<void> => {
    await page.evaluate(({ x, y, m }) => {
      const v = window.__warsim!.view!;
      v.controller.set({ cx: x, cy: y, scale: (v.metresPerPx * v.controller.cam.scale) / m });
    }, { x, y, m });
    await page.waitForTimeout(1500);
  };
  // Inside each ball, below its eyes and clear of its rim: a disc of 0.45 of its radius, a quarter
  // of the radius below its middle.
  for (const m of [3000, 800]) {
    await at(bx, by, m);
    const items = await page.evaluate((m) => {
      const v = window.__warsim!.view!;
      if (m > 2000) return v.counters.drawn.filter((d) => d.alpha > 0.9 && !d.naval).map((d) => ({ nation: d.nation, x: d.x + 7 * v.unitScale, y: d.y + d.h / 2, r: 8 * v.unitScale }));
      return v.markerRects.filter((r) => r.alpha > 0.9 && r.scale === 1).map((r) => ({ nation: r.nation, x: r.x + r.w / 2, y: r.y + (17 / 2) * v.unitScale, r: 9.5 * v.unitScale }));
    }, m);
    const img = await composite(page);
    await page.screenshot({ path: path.join(info.outputPath(), `far-${m}m.png`) });
    let ok = 0;
    const read = items.slice(0, 30);
    for (const it of read) if (discOf(img, it.x, it.y + it.r * 0.25, it.r * 0.45, await flagColours(page, it.nation)) >= 0.6) ok++;
    console.log(`${m} m/px: ${items.length} ${m > 2000 ? 'counters' : 'markers'}; ${ok} of ${read.length} read are discs of their flag's colours`);
    expect(read.length, `${m} m/px: drawn`).toBeGreaterThanOrEqual(10);
    expect(ok, `${m} m/px: flag balls`).toBeGreaterThanOrEqual(Math.ceil(read.length * 0.9));
  }

  // A click on a marker's ball opens its formation's panel.
  const target = await page.evaluate(() => {
    const v = window.__warsim!.view!;
    const c = (document.getElementById('map') as HTMLCanvasElement).getBoundingClientRect();
    const r = v.markerRects.find((m) => m.alpha > 0.9 && m.members.length === 1 && m.x > 200 && m.y > 150 && m.x < c.width - 400 && m.y < c.height - 200)!;
    return { id: r.id, x: c.left + r.x + r.w / 2, y: c.top + r.y + (17 / 2) * v.unitScale };
  });
  await page.mouse.click(target.x, target.y);
  await expect.poll(() => page.evaluate(() => document.querySelector<HTMLElement>('[data-testid=formation-panel]')?.dataset['formation'] ?? null)).toBe(String(target.id));

  // The air: Germany at war with Poland, an hour at a time until planes are over the front.
  await page.keyboard.press('Escape');
  await page.evaluate(({ a, d }) => window.__warsim!.sim.command({ kind: 'declareWar', attacker: a, defender: d }), { a: id('GER'), d: id('POL') });
  const [fx, fy] = cellOf(17.5, 52.3, W, H);
  await at(fx, fy, 1000);
  let planes: { nation: number; x: number; y: number; span: number; look: number }[] = [];
  for (let h = 0; h < 96 && planes.length < 6; h++) {
    planes = await page.evaluate(async () => {
      const w = window.__warsim!;
      const v = w.view!;
      const target = v.lastTick + 1;
      await w.sim.step(1);
      await new Promise<void>((done) => {
        const go = (): void => void (v.lastTick >= target ? done() : setTimeout(go, 4));
        go();
      });
      v.draw(performance.now());
      return v.sortieMarks.flatMap((s) => s.at.map(([x, y]) => ({ nation: s.nation, x, y, span: s.span, look: Math.cos(s.heading) >= 0 ? 1 : -1 })));
    });
  }
  const img = await composite(page);
  await page.screenshot({ path: path.join(info.outputPath(), 'air-1000m.png') });
  const wing = WING_RGB.map((c) => c * 255);
  let winged = 0;
  let flagged = 0;
  // A vee's planes fly 0.8 to 0.9 of a span apart: their balls (0.7 of it across) do not touch, their wings may.
  const clear = planes.filter((p) => planes.every((q) => q === p || Math.hypot(q.x - p.x, q.y - p.y) > p.span * 0.75) && p.x > 20 && p.y > 20);
  for (const p of clear) {
    const r = PLANE_BALL * p.span;
    const u = r / BALL_R;
    if (discOf(img, p.x - 0.3 * u * p.look, p.y + 0.3 * u, r * 0.35, await flagColours(page, p.nation)) >= 0.5) flagged++;
    // A wing's colour out of the ball, either side.
    if ([-1, 1].some((s) => discOf(img, p.x + s * 1.3 * u, p.y + WING_Y * u, Math.max(0.6, WING_RY * u), [wing]) > 0)) winged++;
  }
  console.log(`air at 1000 m/px: ${planes.length} planes, ${clear.length} clear of the others; ${flagged} a ball of their flag, ${winged} with wings`);
  expect(clear.length, 'planes over the front').toBeGreaterThanOrEqual(3);
  expect(flagged, 'flag balls').toBeGreaterThanOrEqual(Math.ceil(clear.length * 0.8));
  expect(winged, 'with wings').toBeGreaterThanOrEqual(Math.ceil(clear.length * 0.8));
});
