import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import { NATIONS_1938 } from '../../src/sim/scenario1938';
import { Frame, isShipFrame } from '../../src/shared/unitLooks';

// PLAN 7.10a (critic run 7, naval 5: "ships at 15 m/px are flat coloured bars",
// `critic/shots/c7e_9043_1_0015m.png`): a ship's marks were light grey, which the tint made a paler
// shade of its hull. They are now dark (`SHIP_DETAIL`) and large enough to read at its least size.
// The critic's game (seed 9043, Germany on the United Kingdom, the first sea battle) at 15 m/px:
// along each ship's centre line, inside its outline, the darkest point against the brightest: the
// marks against the hull. Light-grey marks: a median of 0.51, the least 0.17; dark ones 0.67 and 0.29.

const id = (tag: string): number => NATIONS_1938.findIndex((n) => n.tag === tag) + 1;

/** The critic's game at 15 m/px, on the fleet of its first sea battle with a row nearest the row's middle, its figures drawn. */
async function atSeaBattle(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1400, height: 800 });
  await page.goto('/?scenario=1938&paused=1&seed=9043');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null, null, { timeout: 60_000 });
  const at = await page.evaluate(async ([g, e]) => {
    const { sim, view, hud } = window.__warsim!;
    sim.command({ kind: 'declareWar', attacker: g!, defender: e! });
    // An hour at a time (PLAN 7.19b: the battles at the days' turns are a carrier's wings alone).
    for (let d = 0; d < 20 * 24; d++) {
      const tick = (await sim.step(1)).tick;
      await new Promise<void>((done) => {
        const wait = (): void => (view!.lastTick === tick ? done() : void setTimeout(wait, 5));
        wait();
      });
      // A battle with a row, at its pair (PLAN 7.19b: its fleets close, and a battle's first place
      // may have none of them now; one of a carrier's wings alone has no pair).
      const sb = hud.seaBattles.value.find((b) => b.pair !== null && [b.a, b.b].includes(g!) && [b.a, b.b].includes(e!));
      if (!sb) continue;
      // Its fleet nearest the pair's middle: at 15 m/px the pair's middle is open sea.
      let at: [number, number] | null = null;
      let bd = Infinity;
      for (const f of view!.formationIds()) {
        const p = view!.formationAfloat(f) && view!.formationEngaged(f) ? view!.formationPos(f) : null;
        const d = p ? Math.hypot(p[0] - sb.pair!.x, p[1] - sb.pair!.y) : Infinity;
        if (d < bd) [at, bd] = [p, d];
      }
      if (at) return [at[0], at[1]] as [number, number];
    }
    return null;
  }, [id('GER'), id('ENG')]);
  expect(at, 'a sea battle within 20 days').not.toBeNull();
  await page.evaluate(({ x, y }) => {
    const v = window.__warsim!.view!;
    v.controller.set({ cx: x, cy: y, scale: (v.metresPerPx * v.controller.cam.scale) / 15 });
  }, { x: at![0], y: at![1] });
  await page.waitForFunction(() => window.__warsim!.view!.subscription?.tier === 3 && window.__warsim!.view!.individualCount > 0, null, { timeout: 15_000 });
  await page.waitForTimeout(1500);
}

test('T3: a ship at 15 m/px has dark marks on its hull, not a flat bar', async ({ page }) => {
  test.setTimeout(300_000);
  await atSeaBattle(page);
  const shipFrames = Array.from({ length: 32 }, (_, f) => isShipFrame(f));
  const got = await page.evaluate((shipFrames) => {
    const v = window.__warsim!.view!;
    const canvas = document.querySelector('canvas')!;
    const gl = canvas.getContext('webgl2')!;
    v.draw(performance.now());
    const dpr = canvas.width / canvas.clientWidth;
    const cam = v.controller.cam;
    const [vw, vh] = [canvas.clientWidth, canvas.clientHeight];
    const index = new Map<number, number>();
    for (let i = 0; i < v.elementCount; i++) index.set(v.elementId[i]!, i);
    const lum = (sx: number, sy: number): number => {
      const p = new Uint8Array(4);
      gl.readPixels(Math.round(sx * dpr), canvas.height - Math.round(sy * dpr) - 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, p);
      return 0.2126 * p[0]! + 0.7152 * p[1]! + 0.0722 * p[2]!;
    };
    const ships: { contrast: number; len: number }[] = [];
    for (let j = 0; j < v.individualCount; j++) {
      const e = index.get(v.individualOwner[j]!);
      if (e === undefined || !shipFrames[v.elementFrame(e)]) continue;
      const sx = (v.individualX[j]! - cam.cx) * cam.scale + vw / 2;
      const sy = (v.individualY[j]! - cam.cy) * cam.scale + vh / 2;
      if (sx < 40 || sy < 80 || sx > vw - 40 || sy > vh - 140) continue;
      const f = v.elementFacing(e);
      // Its length on the screen: the larger of its least size and its own (the shader's rule) is
      // more than the sprite's side times its hull's share; along the middle 10 px, inside the smallest hull.
      const half = 10;
      const l: number[] = [];
      for (let t = -0.5; t <= 0.5; t += 0.05) l.push(lum(sx + Math.cos(f) * t * half, sy + Math.sin(f) * t * half));
      const hi = Math.max(...l);
      const lo = Math.min(...l);
      ships.push({ contrast: hi > 0 ? (hi - lo) / hi : 0, len: l.length });
    }
    ships.sort((a, b) => a.contrast - b.contrast);
    return { n: ships.length, median: ships.length > 0 ? ships[Math.floor(ships.length / 2)]!.contrast : 0, least: ships[0]?.contrast ?? 0 };
  }, shipFrames);
  console.log(`ships at 15 m/px: ${got.n}; along the centre line, (brightest − darkest) / brightest: median ${got.median.toFixed(2)}, least ${got.least.toFixed(2)}`);
  await page.screenshot({ path: path.resolve('docs/evidence/7.10/a-ships-15m.png'), clip: { x: 450, y: 200, width: 500, height: 400 } });
  expect(got.n).toBeGreaterThan(3);
  expect(got.median, 'the marks against the hull, the median ship').toBeGreaterThan(0.6);
  expect(got.least, 'the marks against the hull, the least').toBeGreaterThan(0.25);
});

// PLAN 7.22b (critic run 8, naval 6: "at 1× a ship is about 20 to 30 px long at 15 m/px"): closer in
// than 20 m/px a ship's least length grows with the room between two ships (`shipFrameMinPx`): at
// 15 m/px a battleship 35 px, a cruiser 28, a destroyer 21 (26, 21 and 15.6 before). Each hull's
// length on the screen: from its middle along its heading, out to where the sea's colour is back
// (its bow; the wake is astern), doubled.
test('T3: at 15 m/px a ship is drawn long enough to read its class (PLAN 7.22b)', async ({ page }) => {
  test.setTimeout(300_000);
  await atSeaBattle(page);
  const shipFrames = Array.from({ length: 32 }, (_, f) => isShipFrame(f));
  const got = await page.evaluate(
    ([shipFrames, classes]) => {
      const v = window.__warsim!.view!;
      const canvas = document.querySelector('canvas')!;
      const gl = canvas.getContext('webgl2')!;
      v.draw(performance.now());
      const dpr = canvas.width / canvas.clientWidth;
      const cam = v.controller.cam;
      const [vw, vh] = [canvas.clientWidth, canvas.clientHeight];
      const index = new Map<number, number>();
      for (let i = 0; i < v.elementCount; i++) index.set(v.elementId[i]!, i);
      const rgb = (sx: number, sy: number): number[] => {
        const p = new Uint8Array(4);
        gl.readPixels(Math.round(sx * dpr), canvas.height - Math.round(sy * dpr) - 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, p);
        return [p[0]!, p[1]!, p[2]!];
      };
      const apart = (a: number[], b: number[]): number => Math.abs(a[0]! - b[0]!) + Math.abs(a[1]! - b[1]!) + Math.abs(a[2]! - b[2]!);
      const len: Record<string, number[]> = {};
      for (let j = 0; j < v.individualCount; j++) {
        const e = index.get(v.individualOwner[j]!);
        if (e === undefined) continue;
        const frame = v.elementFrame(e);
        const cls = Object.keys(classes).find((k) => classes[k] === frame);
        if (!cls || !shipFrames[frame]) continue;
        const sx = (v.individualX[j]! - cam.cx) * cam.scale + vw / 2;
        const sy = (v.individualY[j]! - cam.cy) * cam.scale + vh / 2;
        if (sx < 60 || sy < 100 || sx > vw - 60 || sy > vh - 160) continue;
        const f = v.elementFacing(e);
        // The sea beside it: 24 px abeam, both sides; the one less like the hull's middle.
        const mid = rgb(sx, sy);
        const sides = [1, -1].map((k) => rgb(sx - Math.sin(f) * 24 * k, sy + Math.cos(f) * 24 * k));
        const sea = apart(sides[0]!, mid) > apart(sides[1]!, mid) ? sides[0]! : sides[1]!;
        let t = 0;
        while (t < 40 && apart(rgb(sx + Math.cos(f) * t, sy + Math.sin(f) * t), sea) > 40) t += 0.5;
        (len[cls] ??= []).push(2 * t);
      }
      const median = (a: number[]): number => [...a].sort((x, y) => x - y)[a.length >> 1]!;
      return Object.fromEntries(Object.entries(len).map(([k, a]) => [k, { n: a.length, median: median(a) }]));
    },
    [shipFrames, { battleship: Frame.battleship, cruiser: Frame.ship, destroyer: Frame.destroyer, carrier: Frame.carrier } as Record<string, number>] as const,
  );
  console.log(`hull lengths at 15 m/px (CSS px, median, ships): ${JSON.stringify(got)}`);
  // Whichever classes the battle has on the screen; a destroyer is in every fleet but a battleship's.
  expect(Object.keys(got).length, 'ships of some class on the screen').toBeGreaterThan(0);
  if (got.battleship) expect(got.battleship.median, 'a battleship (35 px by the rule; 26 before)').toBeGreaterThan(31);
  if (got.carrier) expect(got.carrier.median, 'a carrier (36 px by the rule; 27 before)').toBeGreaterThan(32);
  // PLAN 7.35c (ADR-548): a cruiser's sprite 31 px (28 by 7.22b's rule), a destroyer's 28 (21); its
  // hull measured 17 px at `951b1c6` (8 hulls of 20 px at 7.22b were that run's scene) and 23 since.
  if (got.cruiser) expect(got.cruiser.median, 'a cruiser (31 px by the rule; 21 before 7.22b)').toBeGreaterThan(24.5);
  if (got.destroyer) expect(got.destroyer.median, 'a destroyer (28 px by the rule, its hull 23; 15.6 before 7.22b)').toBeGreaterThan(21);
});

// PLAN 7.35c (critic run 9, naval 6: "at 20 m/px at 1×, destroyers are about 10 × 3 px and
// submarines about 5 px", `critic/shots/c9n_2251_ships_20m_crop4x.png`). The critic's game (seed
// 2251, Italy on the United Kingdom) at its first sea battle with a row; at 20 m/px on each fleet
// of that battle and near it, every ship's hull on the screen by class: its length (from its middle
// to its bow, where the sea's colour is back, doubled: the wake is astern) and its beam (from its
// middle abeam, out to the sea, the nearer side doubled). A ship is drawn at least its class's share of a
// battleship's least length (`shipFrameMinPx`, ADR-548): before, the others in proportion to
// their own length: so measured, a destroyer's hull 14.5 × 4.5 px and a submarine's 9 × 2.
test('T3: at 20 m/px every class of ship is drawn long and broad enough to read (PLAN 7.35c)', async ({ page }) => {
  test.setTimeout(400_000);
  await page.setViewportSize({ width: 1400, height: 800 });
  await page.goto('/?scenario=1938&paused=1&seed=2251');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null, null, { timeout: 60_000 });
  const fleets = await page.evaluate(async ([a, d]) => {
    const { sim, view, hud } = window.__warsim!;
    sim.command({ kind: 'declareWar', attacker: a!, defender: d! });
    for (let h = 0; h < 20 * 24; h++) {
      const tick = (await sim.step(1)).tick;
      await new Promise<void>((done) => {
        const wait = (): void => (view!.lastTick === tick ? done() : void setTimeout(wait, 5));
        wait();
      });
      const sb = hud.seaBattles.value.find((b) => b.pair !== null && [b.a, b.b].includes(a!) && [b.a, b.b].includes(d!));
      if (!sb) continue;
      // Its fleets, and those within 8 cells (about 160 km) of its pair: nearest first.
      const near: { x: number; y: number; d: number }[] = [];
      for (const f of view!.formationIds()) {
        const p = view!.formationAfloat(f) ? view!.formationPos(f) : null;
        const dist = p ? Math.hypot(p[0] - sb.pair!.x, p[1] - sb.pair!.y) : Infinity;
        if (p && dist < 8) near.push({ x: p[0], y: p[1], d: dist });
      }
      if (near.length > 0) return near.sort((u, w) => u.d - w.d).slice(0, 8);
    }
    return [];
  }, [id('ITA'), id('ENG')]);
  expect(fleets.length, 'a sea battle within 20 days').toBeGreaterThan(0);
  const classes = { battleship: Frame.battleship, carrier: Frame.carrier, cruiser: Frame.ship, destroyer: Frame.destroyer, submarine: Frame.submarine, transport: Frame.transport } as Record<string, number>;
  const len: Record<string, number[]> = {};
  const beam: Record<string, number[]> = {};
  let [shot, subShot] = [false, false];
  for (const f of fleets) {
    await page.evaluate(({ x, y }) => {
      const v = window.__warsim!.view!;
      v.controller.set({ cx: x, cy: y, scale: (v.metresPerPx * v.controller.cam.scale) / 20 });
    }, f);
    await page.waitForFunction(() => window.__warsim!.view!.subscription?.tier === 3 && window.__warsim!.view!.individualCount > 0, null, { timeout: 15_000 }).catch(() => undefined);
    await page.waitForTimeout(1500);
    const got = await page.evaluate(([classes, a, d]) => {
      const v = window.__warsim!.view!;
      const canvas = document.querySelector('canvas')!;
      const gl = canvas.getContext('webgl2')!;
      v.draw(performance.now());
      // The two sides' ships alone: since 7.35d2 France's fleets stand on station with Britain's,
      // and its dark blue hulls read as the sea to this measure (a median of 6.5 px for a destroyer).
      const sides = new Set([...v.formationsOf(a), ...v.formationsOf(d)]);
      const dpr = canvas.width / canvas.clientWidth;
      const cam = v.controller.cam;
      const [vw, vh] = [canvas.clientWidth, canvas.clientHeight];
      const index = new Map<number, number>();
      for (let i = 0; i < v.elementCount; i++) index.set(v.elementId[i]!, i);
      const rgb = (sx: number, sy: number): number[] => {
        const p = new Uint8Array(4);
        gl.readPixels(Math.round(sx * dpr), canvas.height - Math.round(sy * dpr) - 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, p);
        return [p[0]!, p[1]!, p[2]!];
      };
      const apart = (a: number[], b: number[]): number => Math.abs(a[0]! - b[0]!) + Math.abs(a[1]! - b[1]!) + Math.abs(a[2]! - b[2]!);
      const out: { cls: string; len: number; beam: number }[] = [];
      // Every figure's place on the screen, of any nation: a ship with another's middle within
      // 24 px is not measured. Since PLAN 7.139–7.146 the first battle is a melee of British and French
      // ships, and a British bow over a French hull (read as the sea, above) measured short.
      const screen: [number, number][] = [];
      for (let j = 0; j < v.individualCount; j++) {
        screen.push([(v.individualX[j]! - cam.cx) * cam.scale + vw / 2, (v.individualY[j]! - cam.cy) * cam.scale + vh / 2]);
      }
      const crowded = (j: number): boolean =>
        screen.some(([x, y], k) => k !== j && Math.hypot(x - screen[j]![0], y - screen[j]![1]) < 24);
      for (let j = 0; j < v.individualCount; j++) {
        const e = index.get(v.individualOwner[j]!);
        if (e === undefined || !sides.has(v.elementFormation[e]!)) continue;
        const frame = v.elementFrame(e);
        const cls = Object.keys(classes).find((k) => classes[k] === frame);
        if (!cls) continue;
        const sx = (v.individualX[j]! - cam.cx) * cam.scale + vw / 2;
        const sy = (v.individualY[j]! - cam.cy) * cam.scale + vh / 2;
        if (sx < 60 || sy < 100 || sx > vw - 60 || sy > vh - 160) continue;
        if (crowded(j)) continue;
        const h = v.elementFacing(e);
        const [ux, uy, nx, ny] = [Math.cos(h), Math.sin(h), -Math.sin(h), Math.cos(h)];
        // The sea: 24 px ahead and 24 px abeam each side; the one least like the hull's middle.
        const mid = rgb(sx, sy);
        const seas = [rgb(sx + nx * 24, sy + ny * 24), rgb(sx - nx * 24, sy - ny * 24), rgb(sx + ux * 24, sy + uy * 24)];
        const sea = seas.reduce((s, c) => (apart(c, mid) > apart(s, mid) ? c : s));
        if (apart(sea, mid) <= 40) continue;
        const out1 = (dx: number, dy: number): number => {
          let t = 0;
          while (t < 40 && apart(rgb(sx + dx * t, sy + dy * t), sea) > 40) t += 0.25;
          return t;
        };
        // The beam from the nearer side, doubled: in a fleet's pile a neighbour may touch the other.
        out.push({ cls, len: 2 * out1(ux, uy), beam: 2 * Math.min(out1(nx, ny), out1(-nx, -ny)) });
      }
      return out;
    }, [classes, id('ITA'), id('ENG')] as const);
    for (const s of got) {
      (len[s.cls] ??= []).push(s.len);
      (beam[s.cls] ??= []).push(s.beam);
    }
    if (!shot && new Set(got.map((s) => s.cls)).size >= 2) {
      shot = true;
      await page.screenshot({ path: path.resolve('docs/evidence/7.35/c-ships-20m.png'), clip: { x: 400, y: 200, width: 600, height: 400 } });
    }
    if (!subShot && got.some((s) => s.cls === 'submarine')) {
      subShot = true;
      await page.screenshot({ path: path.resolve('docs/evidence/7.35/c-subs-20m.png'), clip: { x: 400, y: 200, width: 600, height: 400 } });
    }
  }
  const median = (a: number[]): number => [...a].sort((x, y) => x - y)[a.length >> 1]!;
  const got = Object.fromEntries(Object.keys(len).map((k) => [k, { n: len[k]!.length, len: median(len[k]!), beam: median(beam[k]!) }]));
  console.log(`hulls at 20 m/px (CSS px, median length and beam, ships): ${JSON.stringify(got)}`);
  expect(Object.keys(got).length, 'ships of two classes or more on the screen').toBeGreaterThan(1);
  for (const [cls, g] of Object.entries(got)) {
    console.log(`  ${cls}: ${g.n} ships, ${g.len} × ${g.beam} px`);
  }
  // The critic's two classes (before the rule: a destroyer 14.5 × 4.5 px, a submarine 9 × 2).
  expect(got.destroyer, 'destroyers on the screen').toBeDefined();
  expect(got.destroyer!.len, 'a destroyer (about 19 px by the rule; 14.5 before)').toBeGreaterThan(17);
  if (got.submarine) {
    expect(got.submarine.len, 'a submarine (about 15.5 px by the rule; 9 before)').toBeGreaterThan(13);
    expect(got.submarine.beam, 'a submarine\'s beam (3 px by the rule; 2 before)').toBeGreaterThan(2.5);
  }
  // The classes in the order of their lengths.
  if (got.submarine) expect(got.submarine.len).toBeLessThan(got.destroyer!.len);
  if (got.cruiser) expect(got.cruiser.len).toBeGreaterThan(got.destroyer!.len);
  if (got.cruiser && got.battleship) expect(got.battleship.len).toBeGreaterThan(got.cruiser.len);
});
