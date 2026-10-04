import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import type { Command } from '../../src/shared/commands';
import { NATIONS_1938, TEMPLATES_LAND } from '../../src/sim/scenario1938';
import { settle } from './settle';

// PLAN 2.7i (ADR-74, finding 4): the element sprites and the figures wear the nation's own colour
// in every map mode, as the T1 markers and the T0 counters do. They took the colours of the map
// mode, at the moment they were uploaded: in the wars mode every belligerent's sprites were one
// red, and a zoom across 300 m/px changed a unit's colour.
//
// A division of Japan and one of Manchukuo side by side where nothing else is, at T2. Japan is
// at war (with China): red in the wars mode.

const SITE = [1578.5, 338.8] as const; // western China, far from every other formation
const nation = (tag: string): number => NATIONS_1938.findIndex((n) => n.tag === tag) + 1;
const infantry = TEMPLATES_LAND.findIndex((t) => t.id === 'infantry_div');
const JAP = nation('JAP');
const MAN = nation('MAN');
const SETUP: Command[] = [
  { kind: 'setAi', nation: JAP, enabled: false },
  { kind: 'setAi', nation: MAN, enabled: false },
  { kind: 'spawnFormation', nation: JAP, x: SITE[0] - 1, y: SITE[1], strength: 0, template: infantry },
  { kind: 'spawnFormation', nation: MAN, x: SITE[0] + 1, y: SITE[1], strength: 0, template: infantry },
];

/** Steps `cmds` and one tick, and waits for the view to have that tick. */
async function step(page: Page, cmds: Command[]): Promise<void> {
  await page.evaluate(async (cmds) => {
    const sim = window.__warsim!.sim;
    for (const c of cmds) sim.command(c);
    const tick = (await sim.step(1)).tick;
    await new Promise<void>((done) => {
      const wait = (): void => (window.__warsim!.view!.lastTick === tick ? done() : void setTimeout(wait, 5));
      wait();
    });
  }, cmds);
}

/** The tints of the element sprites in view, by nation: every distinct "r,g,b" a nation's sprites have. */
async function tints(page: Page): Promise<Record<number, string[]>> {
  return page.evaluate(async () => {
    const v = window.__warsim!.view!;
    const nationOf = new Map((await window.__warsim!.sim.inspect(true)).formations.map((f) => [f.id, f.nation]));
    const out: Record<number, Set<string>> = {};
    for (let i = 0; i < v.elementCount; i++) (out[nationOf.get(v.elementFormation[i]!)!] ??= new Set()).add(v.elementTint(i).join(','));
    return Object.fromEntries(Object.entries(out).map(([n, s]) => [n, [...s]]));
  });
}

test('element sprites wear their nation\'s own colour in every map mode', async ({ page }, info) => {
  test.setTimeout(120_000);
  const out = process.env['EVIDENCE'] !== undefined ? path.resolve(import.meta.dirname, '../../docs/evidence/2.7') : info.outputPath();
  mkdirSync(out, { recursive: true });
  await page.setViewportSize({ width: 1400, height: 800 });
  await page.goto('/?scenario=1938&paused=1&seed=1938');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null && window.__warsim!.sim.mapLayers !== null, null, { timeout: 60_000 });
  await step(page, SETUP);
  await page.evaluate(({ x, y }) => {
    const v = window.__warsim!.view!;
    v.controller.set({ cx: x, cy: y, scale: (v.metresPerPx * v.controller.cam.scale) / 150 });
  }, { x: SITE[0], y: SITE[1] });
  await page.waitForFunction(() => window.__warsim!.view!.elementCount >= 56, null, { timeout: 15_000 }); // two divisions of 28
  await settle(page);

  // The political mode: one tint a nation, and the two are told apart.
  expect(await page.evaluate(() => window.__warsim!.view!.mapMode)).toBe('political');
  const political = await tints(page);
  expect(Object.keys(political).map(Number).sort((a, b) => a - b)).toEqual([JAP, MAN].sort((a, b) => a - b));
  expect(political[JAP]).toHaveLength(1);
  expect(political[MAN]).toHaveLength(1);
  expect(political[JAP]![0]).not.toBe(political[MAN]![0]);

  // Every other mode, and a tick in it (the sprites are uploaded with each snapshot): the same tints.
  for (const mode of ['wars', 'alliances', 'puppets', 'terrain', 'diplomacy', 'income', 'revolts'] as const) {
    await page.evaluate((mode) => window.__warsim!.view!.setMapMode(mode), mode);
    // Paused, with no snapshot: nothing of the sprites changes with the mode.
    expect(await tints(page), `${mode}, before a snapshot`).toEqual(political);
    await step(page, []);
    await page.waitForFunction(() => window.__warsim!.view!.elementCount >= 56, null, { timeout: 15_000 });
    expect(await tints(page), `${mode}, after a tick`).toEqual(political);
  }
  // Evidence: the two divisions in the wars mode, close enough to see the sprites' colours.
  await page.evaluate(({ x, y }) => {
    const v = window.__warsim!.view!;
    v.setMapMode('wars');
    v.controller.set({ cx: x, cy: y, scale: (v.metresPerPx * v.controller.cam.scale) / 45 });
  }, { x: SITE[0] + 0.4, y: SITE[1] }); // a little east, so that the list of nations covers neither
  await page.waitForFunction(() => Math.abs(window.__warsim!.view!.elementsZoom / 45 - 1) < 0.01, null, { timeout: 15_000 });
  await settle(page);
  await page.screenshot({ path: path.join(out, 'sprites-in-the-wars-mode.png'), clip: { x: 0, y: 250, width: 1100, height: 300 } });
  console.log(`tints in every mode: Japan ${political[JAP]![0]}, Manchukuo ${political[MAN]![0]}`);
});
