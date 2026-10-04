import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import { cellOf } from '../../src/sim/data/terrain';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { lookAt, measureGround, open1938 } from './mapView';

// PLAN 2.8b (ADR-78): the ground's texture. The elevation data has one sample in 20 km: its
// hillshade (PLAN 2.8a) is a slow wash of light and dark at T2 and nothing a soldier stands on at
// T3. Noise seeded by the place gives the ground its small relief and its grain, by terrain
// class, with finer octaves the nearer the camera.
//
// Read from the map canvas, in the largest fill of the view: how much the brightness of a pixel
// differs from the next (`fineX`, `fineY`). A flat fill has none; a smooth wash next to none.

const { w: W, h: H } = SIZE_1938;
const [AX, AY] = cellOf(10.5, 46.6, W, H); // the central Alps: mountains
const [PX, PY] = cellOf(20.5, 47.0, W, H); // the Hungarian plain
const [RX, RY] = cellOf(-106.5, 39.5, W, H); // the Rockies: no army stands there in 1938

test('the ground shows more detail at each of four zooms from T1 to T3, most in the mountains', async ({ page }, info) => {
  test.setTimeout(180_000);
  await open1938(page);
  const out = process.env['EVIDENCE'] ? path.resolve(import.meta.dirname, '../../docs/evidence/2.8') : info.outputPath();
  mkdirSync(out, { recursive: true });

  const fine: number[] = [];
  for (const mPerPx of [1000, 250, 60, 5]) {
    await lookAt(page, AX, AY, mPerPx);
    const m = await measureGround(page);
    fine.push((m.fineX + m.fineY) / 2);
    console.log(`the Alps, ${mPerPx} m/px: the largest fill has ${(m.fill * 100).toFixed(0)}% of the view; a pixel differs from the next by ${m.fineX.toFixed(2)} across and ${m.fineY.toFixed(2)} down, of 255`);
    await page.screenshot({ path: path.join(out, `ground-alps-${mPerPx}m.png`) });
    expect(m.fill, `${mPerPx} m/px: a fill to measure`).toBeGreaterThan(0.2);
  }
  // T1: a flat fill. Then more at each zoom, by a fifth at least.
  expect(fine[0], 'T1, 1000 m/px').toBe(0);
  expect(fine[1], 'T2, 250 m/px').toBeGreaterThan(0.5);
  expect(fine[2], 'T2, 60 m/px, against 250 m/px').toBeGreaterThan(fine[1]! * 1.2);
  expect(fine[3], 'T3, 5 m/px, against 60 m/px').toBeGreaterThan(fine[2]! * 1.2);

  // By terrain class: large in the mountains, faint on a plain.
  const classAt = (cx: number, cy: number): Promise<number> => page.evaluate(({ cx, cy }) => {
    const t = window.__warsim!.sim.mapLayers!.terrain;
    return t.data[Math.floor(cy) * t.w + Math.floor(cx)]!;
  }, { cx, cy });
  expect(await classAt(AX, AY), 'the Alps are mountains (6)').toBe(6);
  expect([2, 3], 'the Hungarian plain is plains or grassland').toContain(await classAt(PX, PY));
  await lookAt(page, PX, PY, 60);
  const plain = await measureGround(page);
  const plainFine = (plain.fineX + plain.fineY) / 2;
  console.log(`the Hungarian plain, 60 m/px: a pixel differs from the next by ${plainFine.toFixed(2)}; the Alps ${fine[2]!.toFixed(2)}`);
  await page.screenshot({ path: path.join(out, 'ground-plain-60m.png') });
  expect(plainFine, 'the plain has a ground too').toBeGreaterThan(0.1);
  expect(fine[2], 'the mountains against the plain, at 60 m/px').toBeGreaterThan(plainFine * 1.5);
});

test('at 1 m/px the ground has no streaks and does not repeat; it is the same after a reload', async ({ page }, info) => {
  test.setTimeout(180_000);
  const out = process.env['EVIDENCE'] ? path.resolve(import.meta.dirname, '../../docs/evidence/2.8') : info.outputPath();
  mkdirSync(out, { recursive: true });
  const hashes: string[][] = [];
  for (let load = 0; load < 2; load++) {
    await open1938(page);
    const row: string[] = [];
    for (const mPerPx of [150, 5, 1]) {
      await lookAt(page, RX, RY, mPerPx);
      const m = await measureGround(page);
      expect(await page.evaluate(() => window.__warsim!.view!.elementCount), 'no sprites in the view').toBe(0);
      row.push(m.hash);
      if (load === 0 && mPerPx === 1) {
        console.log(`the Rockies, 1 m/px: a pixel differs from the next by ${m.fineX.toFixed(2)} across and ${m.fineY.toFixed(2)} down; ${m.blocks} blocks of 64 px in the fill, ${m.distinct} different`);
        await page.screenshot({ path: path.join(out, 'ground-rockies-1m.png') });
        // A ground is there, as much across as down (a streak has none along itself), and no block of it comes twice.
        expect(m.fill).toBeGreaterThan(0.9);
        expect(Math.min(m.fineX, m.fineY), 'the ground at 1 m/px').toBeGreaterThan(0.5);
        expect(m.fineX / m.fineY, 'across against down').toBeGreaterThan(0.6);
        expect(m.fineX / m.fineY, 'across against down').toBeLessThan(1.67);
        expect(m.blocks).toBeGreaterThan(100);
        expect(m.distinct, 'different blocks').toBe(m.blocks);
      }
    }
    hashes.push(row);
  }
  console.log(`the Rockies at 150, 5 and 1 m/px, two loads: ${hashes.map((r) => r.join(' ')).join(' | ')}`);
  expect(hashes[1]).toEqual(hashes[0]);
});

test('the seam of the looping map shows no line in the ground', async ({ page }, info) => {
  test.setTimeout(150_000);
  await open1938(page);
  const out = process.env['EVIDENCE'] ? path.resolve(import.meta.dirname, '../../docs/evidence/2.8') : info.outputPath();
  mkdirSync(out, { recursive: true });
  // Where land lies on both sides of the seam: the middle of the longest run of rows that have land in the first column and the last.
  const row = await page.evaluate(() => {
    const t = window.__warsim!.sim.mapLayers!.terrain;
    let best = [0, 0];
    for (let y = 0, start = -1; y <= t.h; y++) {
      const land = y < t.h && t.data[y * t.w]! >= 2 && t.data[y * t.w + t.w - 1]! >= 2;
      if (land && start < 0) start = y;
      if (!land && start >= 0) {
        if (y - start > best[1]! - best[0]!) best = [start, y];
        start = -1;
      }
    }
    return (best[0]! + best[1]!) / 2;
  });
  for (const mPerPx of [150, 10]) {
    await lookAt(page, 0, row, mPerPx);
    const m = await measureGround(page);
    console.log(`the seam at row ${row}, ${mPerPx} m/px: the largest fill has ${(m.fill * 100).toFixed(0)}% of the view; across the seam a pixel differs from the next by ${m.middleX.toFixed(2)}, elsewhere by ${m.fineX.toFixed(2)}`);
    await page.screenshot({ path: path.join(out, `ground-seam-${mPerPx}m.png`) });
    expect(m.fill, `${mPerPx} m/px: land on the seam`).toBeGreaterThan(0.5);
    expect(m.same, `${mPerPx} m/px: the ground is there`).toBe(false);
    expect(m.middleX, `${mPerPx} m/px: across the seam against elsewhere`).toBeLessThan(m.fineX * 1.5 + 0.2);
  }
});
