import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import { NATIONS_1938 } from '../../src/sim/scenario1938';

// PLAN 3.11e (the critic's R3-B3: "Soviet tanks are tinted pink, near Poland's own pink",
// `critic/shots/c3j_12_tank_live_006m_2.png`): the critic's game (seed 1212, the Soviet Union
// against Poland by God Mode) on day 6, at the fight of a Soviet armour formation. A sprite's
// tint was its nation's colour mixed 45% toward white: the Soviet (194, 131, 131), Poland's
// (226, 157, 169). It is now the nation's colour, a dark one made lighter with its hue and
// saturation kept: the Soviet elements are a red as saturated as the Soviet Union's on the map,
// and Poland's have Poland's colour.

const nation = (tag: string): number => NATIONS_1938.findIndex((n) => n.tag === tag) + 1;
const colour = (tag: string): [number, number, number] => {
  const c = parseInt(NATIONS_1938.find((n) => n.tag === tag)!.color.slice(1), 16);
  return [(c >> 16) & 255, (c >> 8) & 255, c & 255];
};
const SOV = nation('SOV');
const POL = nation('POL');
/** Saturation and lightness (HSL) and whether red is the greatest channel by far. */
const look = ([r, g, b]: number[]): { s: number; l: number } => {
  const [max, min] = [Math.max(r!, g!, b!) / 255, Math.min(r!, g!, b!) / 255];
  return { s: max === min ? 0 : (max - min) / (1 - Math.abs(max + min - 1)), l: (max + min) / 2 };
};

test('Soviet sprites are the Soviet red and Polish ones Poland\'s colour, in one view', async ({ page }, info) => {
  test.setTimeout(300_000);
  const out = process.env['EVIDENCE'] !== undefined ? path.resolve(import.meta.dirname, '../../docs/evidence/3.11') : info.outputPath();
  mkdirSync(out, { recursive: true });
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto('/?scenario=1938&paused=1&seed=1212');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null && window.__warsim!.sim.mapLayers !== null, null, { timeout: 60_000 });
  await page.evaluate(async ({ SOV, POL }) => {
    const sim = window.__warsim!.sim;
    sim.command({ kind: 'declareWar', attacker: SOV, defender: POL });
    let tick = 0;
    for (let d = 0; d < 6; d++) tick = (await sim.step(24)).tick;
    await new Promise<void>((done) => {
      const wait = (): void => (window.__warsim!.view!.lastTick === tick ? done() : void setTimeout(wait, 5));
      wait();
    });
  }, { SOV, POL });

  // The Soviet armour formation in contact whose block stands nearest the Pole's it goes to.
  const fight = await page.evaluate(async ({ SOV, POL }) => {
    const { sim, view } = window.__warsim!;
    const templates = sim.mapLayers!.templates;
    const poles = new Set(view!.formationsOf(POL));
    let best: { id: number; x: number; y: number; span: number } | null = null;
    for (const id of view!.formationsOf(SOV)) {
      const d = await sim.formation(id);
      if (!d?.engaged || !d.fight || templates[d.template]?.symbol !== 'armour' || !poles.has(d.fight.enemy)) continue;
      const span = Math.hypot(...d.fight.span);
      if (!best || span < best.span) best = { id, x: d.fight.x, y: d.fight.y, span };
    }
    return best;
  }, { SOV, POL });
  expect(fight, 'a Soviet armour formation in contact with a Pole on day 6').not.toBeNull();

  const goTo = (m: number): Promise<void> =>
    page.evaluate(async ({ x, y, m }) => {
      const v = window.__warsim!.view!;
      v.controller.set({ cx: x, cy: y, scale: (v.metresPerPx * v.controller.cam.scale) / m });
      const t0 = performance.now();
      while (Math.abs(v.elementsZoom / m - 1) >= 0.01 && performance.now() - t0 < 5000) await new Promise((d) => setTimeout(d, 30));
      await new Promise((d) => setTimeout(d, 400));
      v.draw(performance.now());
    }, { x: fight!.x, y: fight!.y, m });

  /** The tints of the elements on the screen, by nation, with how many elements have each. */
  const tints = (): Promise<Record<number, Record<string, number>>> =>
    page.evaluate(async () => {
      const v = window.__warsim!.view!;
      const cam = v.controller.cam;
      const nationOf = new Map((await window.__warsim!.sim.inspect(true)).formations.map((f) => [f.id, f.nation]));
      const out: Record<number, Record<string, number>> = {};
      for (let i = 0; i < v.elementCount; i++) {
        const px = (v.elementX[i]! - cam.cx) * cam.scale + window.innerWidth / 2;
        const py = (v.elementY[i]! - cam.cy) * cam.scale + window.innerHeight / 2;
        if (px < 0 || px > window.innerWidth || py < 0 || py > window.innerHeight) continue;
        const of = (out[nationOf.get(v.elementFormation[i]!)!] ??= {});
        const key = v.elementTint(i).join(',');
        of[key] = (of[key] ?? 0) + 1;
      }
      return out;
    });

  await goTo(20);
  const seen = await tints();
  expect(Object.keys(seen[SOV] ?? {}), 'one tint for the Soviet elements on the screen').toHaveLength(1);
  expect(Object.keys(seen[POL] ?? {}), 'one tint for the Polish elements on the screen').toHaveLength(1);
  const sov = Object.keys(seen[SOV]!)[0]!.split(',').map(Number);
  const pol = Object.keys(seen[POL]!)[0]!.split(',').map(Number);
  const apart = Math.hypot(...sov.map((v, i) => v - pol[i]!));
  console.log(`seed 1212, day 6, the fight of Soviet formation ${fight!.id} at 20 m/px: ${Object.values(seen[SOV]!)[0]} Soviet elements (${sov.join(', ')}), ${Object.values(seen[POL]!)[0]} Polish (${pol.join(', ')}); ${apart.toFixed(0)} apart in RGB; saturation ${look(sov).s.toFixed(2)} and ${look(pol).s.toFixed(2)}, lightness ${look(sov).l.toFixed(2)} and ${look(pol).l.toFixed(2)}`);

  // Poland's colour is light enough: its sprites have it. The Soviet red is as saturated as on
  // the map (0.66; the tint before: 0.34), darker than Poland's, and no green or blue is in it
  // beyond the colour's own share (before: 131 of 194).
  expect(pol).toEqual(colour('POL'));
  expect(look(sov).s).toBeGreaterThan(look(colour('SOV')).s - 0.03);
  expect(look(sov).l).toBeLessThan(look(pol).l - 0.1);
  expect(sov[1]! / sov[0]!).toBeCloseTo(colour('SOV')[1]! / colour('SOV')[0]!, 1);
  expect(sov[2]! / sov[0]!).toBeCloseTo(colour('SOV')[2]! / colour('SOV')[0]!, 1);
  // Before: 56.
  expect(apart, 'the tints of the Soviet Union and Poland, apart in RGB').toBeGreaterThan(75);

  await page.screenshot({ path: path.join(out, 'e-the-tint-20m.png') });
  await goTo(6);
  await page.screenshot({ path: path.join(out, 'e-the-tint-6m.png') });
  await goTo(2);
  await page.screenshot({ path: path.join(out, 'e-the-tint-2m.png') });
  await goTo(80);
  await page.screenshot({ path: path.join(out, 'e-the-tint-t2-80m.png') });
});
