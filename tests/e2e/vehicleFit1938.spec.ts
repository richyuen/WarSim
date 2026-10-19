import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import { vehicleBox } from '../../src/render/units/atlas';
import { figureCount, figureOffsets, figureCells, gridSide, isVehicleFrame } from '../../src/render/units/individuals';
import { NATIONS_1938 } from '../../src/sim/scenario1938';
import { settle } from './settle';

// PLAN 7.34c2 AT (critic run 9, semantic zoom 7: "at 10 m/px on German infantry division 11 tanks
// overlap in piles", `c9c_4483_inf_0010m_top_crop2x.png`). The critic's case: seed 4483, Germany
// at war with Poland; the camera at 10 m/px on each German armoured formation in contact on the
// first day one is. A block in contact stands off its slots (`DEPLOY_SCATTER`), its elements 0.012
// to 0.015 cells apart, and its vehicles are fitted to that room (`fitScales`, ADR-540). Every
// vehicle figure the view built (tanks, half-tracks) as its drawn box (`vehicleBox`, its outline
// with it, at its drawn size): none meets another. The same elements unfitted are counted too.

const id = (tag: string): number => NATIONS_1938.findIndex((n) => n.tag === tag) + 1;
const M_PER_PX = 10;
/** The least side of a figure on screen, CSS px (MapView's FIGURE_MIN_PX). */
const FIGURE_MIN_PX = 2.5;

interface Box {
  x: number;
  y: number;
  f: number;
  hl: number;
  hw: number;
}

function corners(h: Box): [number, number][] {
  const [c, s] = [Math.cos(h.f), Math.sin(h.f)];
  return [[1, 1], [1, -1], [-1, -1], [-1, 1]].map(([a, b]) => [h.x + c * a! * h.hl - s * b! * h.hw, h.y + s * a! * h.hl + c * b! * h.hw]);
}

/** Two boxes meet: no axis of either parts them. */
function meet(a: Box, b: Box): boolean {
  for (const f of [a.f, a.f + Math.PI / 2, b.f, b.f + Math.PI / 2]) {
    const [c, s] = [Math.cos(f), Math.sin(f)];
    const span = (h: Box): [number, number] => {
      const p = corners(h).map(([x, y]) => x * c + y * s);
      return [Math.min(...p), Math.max(...p)];
    };
    const [p, q] = [span(a), span(b)];
    if (p[1] <= q[0] + 1e-12 || q[1] <= p[0] + 1e-12) return false;
  }
  return true;
}

/** Figures on another: a grid of 0.02 cells, each box against those of its cell and the next. */
function overlapped(boxes: readonly Box[]): number {
  const cell = 0.02;
  const grid = new Map<string, number[]>();
  boxes.forEach((b, i) => {
    const k = `${Math.floor(b.x / cell)},${Math.floor(b.y / cell)}`;
    grid.set(k, [...(grid.get(k) ?? []), i]);
  });
  const hit = new Set<number>();
  boxes.forEach((a, i) => {
    const [gx, gy] = [Math.floor(a.x / cell), Math.floor(a.y / cell)];
    for (let ox = -1; ox <= 1; ox++)
      for (let oy = -1; oy <= 1; oy++)
        for (const j of grid.get(`${gx + ox},${gy + oy}`) ?? []) {
          if (j <= i) continue;
          if (meet(a, boxes[j]!)) {
            hit.add(i);
            hit.add(j);
          }
        }
  });
  return hit.size;
}

function boxOf(x: number, y: number, facing: number, frame: number, cells: number): Box {
  const box = vehicleBox(frame);
  const shift = ((box.front - box.back) / 2) * cells;
  return { x: x + Math.cos(facing) * shift, y: y + Math.sin(facing) * shift, f: facing, hl: ((box.front + box.back) / 2) * cells, hw: box.half * cells };
}

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

test("the critic's 4483 armour in contact at 10 m/px: no vehicle figure on another (counted)", async ({ page }, info) => {
  test.setTimeout(300_000);
  const GER = id('GER');
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto('/?scenario=1938&paused=1&seed=4483');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null && window.__warsim!.sim.mapLayers !== null, null, { timeout: 60_000 });
  await page.evaluate(({ a, d }) => window.__warsim!.sim.command({ kind: 'declareWar', attacker: a, defender: d }), { a: GER, d: id('POL') });
  let armour: number[] = [];
  for (let day = 0; day < 12 && armour.length === 0; day++) {
    await stepDay(page);
    armour = await page.evaluate((n) => {
      const v = window.__warsim!.view!;
      return v.formationsOf(n).filter((f) => v.formationEngaged(f) && /Armoured/i.test(JSON.stringify(v.formationTitle(f))));
    }, GER);
  }
  expect(armour.length, 'a German armoured formation in contact').toBeGreaterThan(0);
  const out = process.env['EVIDENCE'] ? path.resolve(import.meta.dirname, '../../docs/evidence/7.34') : info.outputPath();
  mkdirSync(out, { recursive: true });

  let fitted = 0;
  let unfitted = 0;
  let vehicles = 0;
  let least = Infinity;
  for (const f of armour) {
    const pos = await page.evaluate((f) => window.__warsim!.view!.formationPos(f)!, f);
    await page.evaluate(({ x, y, m }) => {
      const v = window.__warsim!.view!;
      v.controller.set({ cx: x, cy: y, scale: (v.metresPerPx * v.controller.cam.scale) / m });
    }, { x: pos[0], y: pos[1], m: M_PER_PX });
    await page.waitForFunction(() => {
      const v = window.__warsim!.view!;
      return v.subscription?.tier === 3 && v.individualsShown && v.shares.individuals === 1 && v.elementCount > 0 && v.individualCount > 0;
    }, null, { timeout: 30_000 });
    await settle(page);
    const r = await page.evaluate((f) => {
      const v = window.__warsim!.view!;
      return {
        mpp: v.metresPerPx,
        pxPerCell: v.controller.cam.scale,
        unit: v.unitScale,
        engaged: v.formationEngaged(f),
        elements: { id: [...v.elementId], formation: [...v.elementFormation], frame: Array.from({ length: v.elementCount }, (_, i) => v.elementFrame(i)), facing: Array.from({ length: v.elementCount }, (_, i) => v.elementFacing(i)), size: [...v.elementSize], strength: [...v.elementStrength], x: [...v.elementX], y: [...v.elementY] },
        figures: { owner: [...v.individualOwner.slice(0, v.individualCount)], x: [...v.individualX], y: [...v.individualY], cells: [...v.individualCells] },
      };
    }, f);
    expect(Math.round(r.mpp)).toBe(M_PER_PX);
    expect(r.engaged).toBe(true);
    const index = new Map(r.elements.id.map((e, i) => [e, i]));
    // The view's figures as drawn: the shader's least size, the unit-size setting.
    const drawn: Box[] = [];
    let ofFormation = 0;
    for (let k = 0; k < r.figures.owner.length; k++) {
      const i = index.get(r.figures.owner[k]!)!;
      const frame = r.elements.frame[i]!;
      if (!isVehicleFrame(frame)) continue;
      const cells = (Math.max(r.figures.cells[k]! * r.pxPerCell, FIGURE_MIN_PX) * r.unit) / r.pxPerCell;
      drawn.push(boxOf(r.figures.x[k]!, r.figures.y[k]!, r.elements.facing[i]!, frame, cells));
      least = Math.min(least, cells * r.pxPerCell);
      if (r.elements.formation[i] === f) ofFormation++;
    }
    // The same elements at full figure (before PLAN 7.34c2).
    const whole: Box[] = [];
    for (let i = 0; i < r.elements.id.length; i++) {
      const frame = r.elements.frame[i]!;
      if (!isVehicleFrame(frame)) continue;
      const size = r.elements.size[i]!;
      const side = gridSide(frame, figureCount(size, size));
      const off = figureOffsets(r.elements.id[i]!, side, figureCount(r.elements.strength[i]!, size), r.elements.facing[i]!);
      for (let k = 0; k < off.length; k += 2) whole.push(boxOf(r.elements.x[i]! + off[k]!, r.elements.y[i]! + off[k + 1]!, r.elements.facing[i]!, frame, figureCells(side) * r.unit));
    }
    const on = overlapped(drawn);
    const before = overlapped(whole);
    console.log(`seed 4483, formation ${f} in contact at ${r.mpp.toFixed(1)} m/px: ${drawn.length} vehicle figures built (${ofFormation} its own), ${on} on another; unfitted ${before} of ${whole.length}`);
    fitted += on;
    unfitted += before;
    vehicles += ofFormation;
    if (f === armour[0]) await page.screenshot({ path: path.join(out, `c2-4483-arm${f}-contact-10m.png`) });
  }
  console.log(`seed 4483: ${armour.length} German armoured formations in contact; ${vehicles} of their vehicles; ${fitted} on another (unfitted ${unfitted}); the least vehicle drawn ${least.toFixed(1)} px`);
  expect(vehicles).toBeGreaterThan(50);
  expect(unfitted, 'the case still has vehicles in contact close enough to meet at full figure').toBeGreaterThan(0);
  expect(fitted).toBe(0);
});
