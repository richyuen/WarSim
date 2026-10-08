import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import { T1_MIN_M } from '../../src/render/units/markers';
import type { Command } from '../../src/shared/commands';
import { NATIONS_1938, SIZE_1938, TEMPLATES_LAND } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { assets1938 } from '../helpers/earth';
import { settle } from './settle';

// PLAN 2.14c1 (the critic's R2-B2, "no battle in a T3 view"): enemy formations stand a cell or
// more apart, and a view at 20 m/px is 28 by 16 km: it showed one side's battalions, with shots
// leaving the screen. The blocks of two formations in contact are now deployed against each
// other in the middle between them: both sides in one view at 20 m/px, facing each other, a
// kilometre between their front rows, and the hour's shots between them.
//
// A German and a Polish infantry division a cell apart across their border, at war by God Mode.

const nation = (tag: string): number => NATIONS_1938.findIndex((n) => n.tag === tag) + 1;
const infantry = TEMPLATES_LAND.findIndex((t) => t.id === 'infantry_div');
const GER = nation('GER');
const POL = nation('POL');
const VIEW = { width: 1400, height: 800 };

/** A German cell with a Polish one east of it, where the order of battle has fewest formations near: the point between the two cells' middles. */
function border(): readonly [number, number] {
  const w = new Sim({ scenario: '1938', seed: 1938, assets: assets1938(SIZE_1938.w) }).world;
  const { owner, w: cw, h: ch } = w.cells;
  const fc = w.formations.cols;
  const forms = w.formations.ids().map((f) => [fc.x[f]!, fc.y[f]!] as const);
  let best: [number, number] | null = null;
  let fewest = Infinity;
  for (let y = 1; y < ch - 1; y++) {
    for (let x = 1; x < cw - 2; x++) {
      if (owner[y * cw + x] !== GER || owner[y * cw + x + 1] !== POL) continue;
      const near = forms.filter(([fx, fy]) => Math.hypot(fx - (x + 1), fy - (y + 0.5)) < 3).length;
      if (near < fewest) {
        fewest = near;
        best = [x + 1, y + 0.5];
      }
    }
  }
  if (!best) throw new Error('no German cell with a Polish one east of it');
  return best;
}

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

test('two formations in contact are both in one view at 20 m/px, and face each other', async ({ page }, info) => {
  test.setTimeout(180_000);
  const out = process.env['EVIDENCE'] !== undefined ? path.resolve(import.meta.dirname, '../../docs/evidence/2.14') : info.outputPath();
  mkdirSync(out, { recursive: true });
  await page.setViewportSize(VIEW);
  await page.goto('/?scenario=1938&paused=1&seed=1938');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null && window.__warsim!.sim.mapLayers !== null, null, { timeout: 60_000 });
  const SITE = border();
  await step(page, [
    { kind: 'setSetting', key: 'aiEnabled', value: false },
    { kind: 'declareWar', attacker: GER, defender: POL },
    { kind: 'spawnFormation', nation: GER, x: SITE[0] - 0.5, y: SITE[1], strength: 0, template: infantry },
    { kind: 'spawnFormation', nation: POL, x: SITE[0] + 0.5, y: SITE[1], strength: 0, template: infantry },
  ]);
  const [german, polish] = (await page.evaluate(() => window.__warsim!.view!.formationIds())).sort((a, b) => a - b).slice(-2) as [number, number];
  // A day of it, so that the picture is of a battle with losses.
  await step(page, [], 24);

  // 20 m/px on the point between the two formations' places, a cell apart: 980 px.
  await page.evaluate(({ x, y }) => {
    const v = window.__warsim!.view!;
    v.controller.set({ cx: x, cy: y, scale: (v.metresPerPx * v.controller.cam.scale) / 20 });
  }, { x: SITE[0], y: SITE[1] });
  await page.waitForFunction(({ x, y }) => {
    const v = window.__warsim!.view!;
    if (Math.abs(v.elementsZoom / 20 - 1) >= 0.01) return false;
    for (let i = 0; i < v.elementCount; i++) if (Math.abs(v.elementX[i]! - x) < 0.3 && Math.abs(v.elementY[i]! - y) < 0.3) return true;
    return false;
  }, { x: SITE[0], y: SITE[1] }, { timeout: 20_000 });
  await settle(page);

  const seen = await page.evaluate(({ german, polish }) => {
    const v = window.__warsim!.view!;
    const cam = v.controller.cam;
    const side = (id: number): { all: number; on: number; xs: number[]; facing: number[]; engaged: boolean } => {
      const s = { all: 0, on: 0, xs: [] as number[], facing: [] as number[], engaged: false };
      for (let i = 0; i < v.elementCount; i++) {
        if (v.elementFormation[i] !== id) continue;
        s.all++;
        const px = (v.elementX[i]! - cam.cx) * cam.scale + window.innerWidth / 2;
        const py = (v.elementY[i]! - cam.cy) * cam.scale + window.innerHeight / 2;
        if (px >= 0 && px <= window.innerWidth && py >= 0 && py <= window.innerHeight) s.on++;
        s.xs.push(px);
        s.facing.push(v.elementFacing(i));
        s.engaged = (v.elementFlags[i]! & 2) !== 0;
      }
      return s;
    };
    return { m: v.metresPerPx, cam: { cx: cam.cx, scale: cam.scale }, width: window.innerWidth, german: side(german), polish: side(polish), places: [v.formationPos(german)!, v.formationPos(polish)!], tags: v.tagRects.filter((t) => t.id === german || t.id === polish).length };
  }, { german, polish });

  // The formations are said to be where their blocks stand (PLAN 3.11a), not a cell apart as the
  // rules have them (980 px at this zoom, each off or at the edge of what the blocks take): each
  // place is among its own elements, the German's west of the Pole's.
  const px = (x: number): number => (x - seen.cam.cx) * seen.cam.scale + seen.width / 2;
  expect(px(seen.places[0]![0]), 'the place of the German formation').toBeGreaterThan(Math.min(...seen.german.xs));
  expect(px(seen.places[0]![0]), 'the place of the German formation').toBeLessThan(Math.max(...seen.german.xs));
  expect(px(seen.places[1]![0]), 'the place of the Polish formation').toBeGreaterThan(Math.min(...seen.polish.xs));
  expect(px(seen.places[1]![0]), 'the place of the Polish formation').toBeLessThan(Math.max(...seen.polish.xs));
  expect(seen.places[1]![0] - seen.places[0]![0]).toBeGreaterThan(0.05);
  expect(seen.places[1]![0] - seen.places[0]![0]).toBeLessThan(0.4);
  // Both sides are in the one view, whole.
  expect(seen.german.engaged && seen.polish.engaged).toBe(true);
  expect(seen.german.all).toBeGreaterThan(20);
  expect(seen.polish.all).toBeGreaterThan(20);
  expect(seen.german.on, 'German elements on the screen').toBe(seen.german.all);
  expect(seen.polish.on, 'Polish elements on the screen').toBe(seen.polish.all);
  // Facing each other: the Germans east (0), the Poles west (π). Until PLAN 3.11c4 every element
  // was at its block's facing to five places; each is now turned off it by its id, 0.3 rad at
  // most (`DEPLOY_TURN`, ADR-204), and not all one way: the block as a whole still faces its enemy.
  const TURN = 0.3;
  for (const [facing, east] of [[seen.german.facing, 1], [seen.polish.facing, -1]] as const) {
    for (const f of facing) expect(Math.cos(f) * east).toBeGreaterThan(Math.cos(TURN) - 1e-6);
    const mean = Math.atan2(facing.reduce((s, f) => s + Math.sin(f), 0) * east, facing.reduce((s, f) => s + Math.cos(f), 0) * east);
    expect(Math.abs(mean), 'how far the mean facing of a block is off its line to the enemy, rad').toBeLessThan(TURN / 3);
    expect(Math.max(...facing.map((f) => Math.sin(f))) - Math.min(...facing.map((f) => Math.sin(f))), 'between the two elements of a block turned furthest apart').toBeGreaterThan(Math.sin(TURN));
  }
  // Front to front: every German element west of every Polish one, the front rows about a kilometre apart (50 px at 20 m/px), no more than two.
  const gap = Math.min(...seen.polish.xs) - Math.max(...seen.german.xs);
  expect(gap, 'px between the front rows').toBeGreaterThan(30);
  expect(gap, 'px between the front rows').toBeLessThan(110);
  // Each has its tag.
  expect(seen.tags).toBe(2);

  // An hour of the fight, stepped while the view is on it: the picture has that hour's shots,
  // between the two blocks. (How long a shot is, is the unit test's: tests/unit/deploy.test.ts.)
  await step(page, [], 1);
  await page.evaluate(() => window.__warsim!.view!.draw());
  console.log(`20 m/px between a German and a Polish division a cell apart: ${seen.german.on} of ${seen.german.all} German and ${seen.polish.on} of ${seen.polish.all} Polish elements on the screen, ${gap.toFixed(0)} px between the front rows`);
  await page.screenshot({ path: path.join(out, 'battle-20m.png') });

  // PLAN 2.14c2: a battalion in contact looks like one. At 5 m/px on the ground between the
  // front rows: the infantry of both sides is down (the prone frame) in a loose line at the
  // front of each battalion's ground; the guns are guns.
  const figures = (x: number, y: number): Promise<{ frames: Record<number, number>; depth: number; battalions: number }> =>
    page.evaluate(async ({ x, y }) => {
      const v = window.__warsim!.view!;
      v.controller.set({ cx: x, cy: y, scale: (v.metresPerPx * v.controller.cam.scale) / 5 });
      const t0 = performance.now();
      const near = (): boolean => {
        if (Math.abs(v.elementsZoom / 5 - 1) >= 0.01 || v.individualCount === 0) return false;
        for (let i = 0; i < v.elementCount; i++) if (Math.abs(v.elementX[i]! - x) < 0.2 && Math.abs(v.elementY[i]! - y) < 0.2) return true;
        return false;
      };
      while (!near()) {
        if (performance.now() - t0 > 20_000) throw new Error('no figures at 5 m/px');
        await new Promise((d) => setTimeout(d, 50));
      }
      for (let k = 0; k < 40 && v.unitsAnimating(); k++) {
        v.draw();
        await new Promise((d) => setTimeout(d, 25));
      }
      v.draw();
      const frames: Record<number, number> = {};
      // Per battalion (an element with more than 16 figures): how deep its figures stand along the block's facing (east-west here), cells.
      const by = new Map<number, number[]>();
      for (let j = 0; j < v.individualCount; j++) {
        frames[v.individualFrame(j)] = (frames[v.individualFrame(j)] ?? 0) + 1;
        by.set(v.individualOwner[j]!, [...(by.get(v.individualOwner[j]!) ?? []), v.individualX[j]!]);
      }
      const depths = [...by.values()].filter((xs) => xs.length > 16).map((xs) => Math.max(...xs) - Math.min(...xs));
      return { frames, depth: depths.reduce((s, d) => s + d, 0) / Math.max(1, depths.length), battalions: depths.length };
    }, { x, y });
  const fight = await figures(SITE[0], SITE[1]);
  await page.screenshot({ path: path.join(out, 'contact-5m.png') });
  expect(fight.battalions, 'battalions in the view').toBeGreaterThan(4);
  expect(fight.frames[0] ?? 0, 'figures standing, in contact').toBe(0);
  expect(fight.frames[5] ?? 0, 'figures prone, in contact').toBeGreaterThan(200);

  // Peace by God Mode: the contact ends, the blocks go back to the formations' places, the men stand in their ranks.
  const war = await page.evaluate(async ({ ger, pol }) => (await window.__warsim!.sim.inspect()).wars.find((w) => w.attackers.includes(ger) && w.defenders.includes(pol))!.id, { ger: GER, pol: POL });
  await step(page, [{ kind: 'forcePeace', war }], 2);
  const rest = await figures(SITE[0] - 0.5, SITE[1]);
  await page.screenshot({ path: path.join(out, 'rest-5m.png') });
  expect(rest.battalions, 'battalions in the view, at rest').toBeGreaterThan(4);
  expect(rest.frames[5] ?? 0, 'figures prone, at rest').toBe(0);
  expect(rest.frames[0] ?? 0, 'figures standing, at rest').toBeGreaterThan(200);
  // The ranks of a battalion in contact take about half the depth they take at rest.
  expect(fight.depth / rest.depth, 'depth of a battalion\'s figures, in contact against at rest').toBeLessThan(0.65);
  console.log(`5 m/px: in contact ${JSON.stringify(fight.frames)} figures by frame, a battalion ${(fight.depth * 19_570).toFixed(0)} m deep; at rest ${JSON.stringify(rest.frames)}, ${(rest.depth * 19_570).toFixed(0)} m deep`);
});

// PLAN 2.14f4 (ADR-92): the T1 → T2 handover of a pair in contact. A marker stands on its
// formation, which the rules read; the block of a formation in contact stands between the two
// (above). So at the boundary of 300 m/px the box goes where the formation is, and the
// elements come in up to 43 px from it: at a cell apart 27 px, at the 1.5 cells of contact 43.
// The marker stays on the formation (two enemies' boxes, 26 px wide, would stand 10 px apart
// at their blocks). What the handover does not do is leave the strength bar and the number
// behind for the 220 ms that they linger "on the group" (ADR-72): beside the group they go
// with the box. A German division three cells behind, not in contact, keeps its bar as before.
test('the T1 → T2 handover of a pair in contact: the boxes go where the formations stand, and their bars with them', async ({ page }, info) => {
  test.setTimeout(180_000);
  const out = process.env['EVIDENCE'] !== undefined ? path.resolve(import.meta.dirname, '../../docs/evidence/2.14') : info.outputPath();
  mkdirSync(out, { recursive: true });
  await page.setViewportSize(VIEW);
  await page.goto('/?scenario=1938&paused=1&seed=1938');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null && window.__warsim!.sim.mapLayers !== null, null, { timeout: 60_000 });
  const SITE = border();
  await step(page, [
    { kind: 'setSetting', key: 'aiEnabled', value: false },
    { kind: 'declareWar', attacker: GER, defender: POL },
    { kind: 'spawnFormation', nation: GER, x: SITE[0] - 3.5, y: SITE[1], strength: 0, template: infantry },
    { kind: 'spawnFormation', nation: GER, x: SITE[0] - 0.5, y: SITE[1], strength: 0, template: infantry },
    { kind: 'spawnFormation', nation: POL, x: SITE[0] + 0.5, y: SITE[1], strength: 0, template: infantry },
  ]);
  const [behind, german, polish] = (await page.evaluate(() => window.__warsim!.view!.formationIds())).sort((a, b) => a - b).slice(-3) as [number, number, number];
  await step(page, [], 24);
  // At rest at T1, just above the boundary.
  await page.evaluate(({ x, y, m }) => {
    const v = window.__warsim!.view!;
    v.controller.set({ cx: x, cy: y, scale: (v.metresPerPx * v.controller.cam.scale) / m });
  }, { x: SITE[0] - 1, y: SITE[1], m: T1_MIN_M * 1.0002 });
  await settle(page);

  const rec = await page.evaluate(async ({ x, y, m, ids }) => {
    const v = window.__warsim!.view!;
    const overlay = document.querySelector<HTMLCanvasElement>('canvas.map-nations')!;
    const k = overlay.width / overlay.clientWidth;
    /** The frame at `now`: the three markers, and the 560 × 180 px around the view's middle. */
    const frame = (now: number, picture: boolean): { marks: ({ alpha: number; bar: number; cx: number } | null)[]; picture: string } => {
      v.draw(now);
      const marks = ids.map((id) => {
        const r = v.markerRects.find((r) => r.id === id);
        return r ? { alpha: r.alpha, bar: r.bar, cx: r.x + r.w / 2 } : null;
      });
      if (!picture) return { marks, picture: '' };
      const crop = document.createElement('canvas');
      crop.width = 560 * k;
      crop.height = 180 * k;
      const c2 = crop.getContext('2d')!;
      for (const layer of document.querySelectorAll('canvas')) c2.drawImage(layer, overlay.width / 2 - crop.width / 2, overlay.height / 2 - crop.height / 2, crop.width, crop.height, 0, 0, crop.width, crop.height);
      return { marks, picture: crop.toDataURL('image/png') };
    };
    const now = performance.now();
    const rest = frame(now, true);
    // The step across the boundary, then the camera stays. The elements of the view at the new zoom come from the worker.
    v.controller.set({ cx: x, cy: y, scale: (v.metresPerPx * v.controller.cam.scale) / m });
    v.draw(now);
    const t0 = performance.now();
    while (Math.abs(v.elementsZoom / v.metresPerPx - 1) > 0.01) {
      if (performance.now() - t0 > 20_000) throw new Error('no elements at the new zoom');
      await new Promise((d) => setTimeout(d, 10));
    }
    const cam = v.controller.cam;
    /** The middle of a formation's elements, px from the left. */
    const block = (id: number): number => {
      let sum = 0;
      let n = 0;
      for (let i = 0; i < v.elementCount; i++) {
        if (v.elementFormation[i] !== id) continue;
        sum += (v.elementX[i]! - cam.cx) * cam.scale + window.innerWidth / 2;
        n++;
      }
      return sum / n;
    };
    const frames: { t: number; marks: ({ alpha: number; bar: number; cx: number } | null)[]; picture: string }[] = [];
    for (let t = 0; t <= 480; t += 16) frames.push({ t, ...frame(now + t, t === 96 || t === 352) });
    return { rest, frames, blocks: ids.map(block), m: v.metresPerPx };
  }, { x: SITE[0] - 1, y: SITE[1], m: T1_MIN_M * 0.9998, ids: [behind, german, polish] });
  writeFileSync(path.join(out, 'handover-contact-t1.png'), Buffer.from(rec.rest.picture.split(',')[1]!, 'base64'));
  for (const f of rec.frames) if (f.picture) writeFileSync(path.join(out, `handover-contact-${f.t}ms.png`), Buffer.from(f.picture.split(',')[1]!, 'base64'));

  // Where the boxes stand and where the elements come in: the one behind on its formation; the
  // two in contact 27 px from theirs, towards each other, their blocks 10 px apart.
  const [mb, mg, mp] = rec.rest.marks.map((m) => m!.cx) as [number, number, number];
  const [bb, bg, bp] = rec.blocks as [number, number, number];
  console.log(`at ${rec.m.toFixed(0)} m/px: the boxes at ${mb.toFixed(1)}, ${mg.toFixed(1)}, ${mp.toFixed(1)} px, the blocks at ${bb.toFixed(1)}, ${bg.toFixed(1)}, ${bp.toFixed(1)} px`);
  expect(Math.abs(bb - mb), 'the block of the one behind, px from its box').toBeLessThan(1.5);
  expect(bg - mg, 'the German block, px east of its box').toBeGreaterThan(24);
  expect(bg - mg).toBeLessThan(30);
  expect(mp - bp, 'the Polish block, px west of its box').toBeGreaterThan(24);
  expect(mp - bp).toBeLessThan(30);
  expect(bp - bg, 'px between the two blocks').toBeGreaterThan(8);
  expect(bp - bg).toBeLessThan(13);

  // (The step of the camera itself, 0.04% of the zoom, moves a box 200 px from the middle by 0.07 px.)
  const stepped = rec.frames[0]!.marks.map((m) => m!.cx);
  for (const f of rec.frames) {
    const [b, g, p] = f.marks;
    // The boxes do not travel (ADR-72): each stands where it stood at the step for as long as it is drawn.
    for (const [i, m] of [b, g, p].entries()) if (m) expect(Math.abs(m.cx - stepped[i]!), `${f.t} ms: a box, px from where it stood`).toBeLessThan(0.01);
    // In contact: the bar and the number have the box's opacity, in every frame.
    for (const m of [g, p]) if (m) expect(m.bar, `${f.t} ms: the bar of a formation in contact`).toBe(m.alpha);
  }
  // Not in contact: the bar lingers, as before. 256 ms on the box is gone and the bar is there in full; the two in contact have nothing left.
  const late = rec.frames.find((f) => f.t === 256)!.marks;
  expect(late[0]!.alpha, 'the one behind, 256 ms on: its box').toBe(0);
  expect(late[0]!.bar, 'the one behind, 256 ms on: its bar').toBeGreaterThan(0.99);
  for (const m of [late[1], late[2]]) expect(m?.bar ?? 0, 'in contact, 256 ms on: the bar').toBeLessThan(0.011);
  // And half-way, all three boxes are on their way out together.
  const half = rec.frames.find((f) => f.t === 128)!.marks;
  for (const m of half) {
    expect(m!.alpha).toBeGreaterThan(0.3);
    expect(m!.alpha).toBeLessThan(0.7);
  }
  expect(half[0]!.bar).toBe(1);
});
