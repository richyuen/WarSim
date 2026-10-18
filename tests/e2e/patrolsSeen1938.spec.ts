import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import { Leg, sortieAt } from '../../src/shared/sorties';
import { NATIONS_1938, SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { deployOf, elementIndex, loopW, slotCount } from '../../src/sim/systems/elements';
import { assets1938 } from '../helpers/earth';

// PLAN 7.24c (critic run 8, aircraft 6: "at 25 m/px no sortie drawn" over the war on Poland). The
// critic's game: seed 6047, Germany at war with Poland and France from the start. On days 3 and
// 10, the first hour after which a fighter patrol circles over a land formation in contact, found
// in Node (the worker runs the same sim: I4; the hashes are compared): the camera on its circle's
// middle at 80 m/px (T2) and at 25 m/px (T3), the page paused, its planes drawn there. Since PLAN
// 7.24a the wings spread over the front, and since 7.24c the circle at T3 stays on the screen
// (`ORBIT_VIEW`: it was 12 km round, more than half the view). Since PLAN 7.24d a patrol is set on
// its formation's block, not its place: "over a fight" is near the block of the hour, as drawn.

const id = (tag: string): number => NATIONS_1938.findIndex((n) => n.tag === tag) + 1;
const DAYS = [3, 10] as const;
/** Cells: a patrol's target this near the block of a formation in contact is over its fight. */
const OVER_FIGHT = 0.3;

interface Patrol {
  tick: number;
  hash: number;
  nation: number;
  x: number;
  y: number;
  formation: number;
}

/** For each of DAYS, the first hour of the day after which a fighter patrol of the war's nations circles within OVER_FIGHT of a formation in contact. */
function patrols(): (Patrol | null)[] {
  const sim = new Sim({ scenario: '1938', seed: 6047, assets: assets1938(SIZE_1938.w) });
  const war = [id('GER'), id('POL'), id('FRA')];
  sim.command({ kind: 'declareWar', attacker: war[0]!, defender: war[1]! });
  sim.command({ kind: 'declareWar', attacker: war[0]!, defender: war[2]! });
  const w = sim.world;
  const c = w.formations.cols;
  return DAYS.map((day) => {
    if (w.tick < 24 * day) sim.step(24 * day - w.tick);
    for (let h = 0; h < 24; h++) {
      sim.step(1);
      // Each formation in contact with where its block stands this hour, as the view draws it.
      const fights: [number, number, number][] = [];
      w.formations.forEach((f) => {
        if (c.engaged[f] !== 1 || !war.includes(c.nation[f]!) || w.offLand(f) || w.isFleet(f)) return;
        const d = deployOf(w, f, slotCount(w, f, elementIndex(w).get(f)?.length ?? 0));
        fights.push([f, d?.x ?? c.x[f]!, d?.y ?? c.y[f]!]);
      });
      for (const [wing, s] of [...w.sorties].sort((a, b) => a[0] - b[0])) {
        if (s.over <= 0 || !war.includes(c.nation[wing]!) || sortieAt(s, w.tick, loopW(w)).leg !== Leg.Over) continue;
        const under = fights.find(([, x, y]) => Math.hypot(x - s.tx, y - s.ty) < OVER_FIGHT)?.[0];
        if (under !== undefined) return { tick: w.tick, hash: sim.hash(), nation: c.nation[wing]!, x: s.tx, y: s.ty, formation: under };
      }
    }
    return null;
  });
}

/** The camera on (x, y) at `m` metres a pixel, the view settled, a frame drawn: the planes over the circle's middle there, of `nation`. */
async function planesAt(page: Page, x: number, y: number, m: number, nation: number): Promise<{ drawn: number; over: number; mpp: number }> {
  return page.evaluate(
    async ({ x, y, m, nation, over }) => {
      const v = window.__warsim!.view!;
      v.controller.set({ cx: x, cy: y, scale: (v.metresPerPx * v.controller.cam.scale) / m });
      const t0 = performance.now();
      while (v.controller.animating && performance.now() - t0 < 10_000) await new Promise((d) => setTimeout(d, 30));
      await new Promise((d) => setTimeout(d, 400));
      v.draw(performance.now());
      const mine = v.sortieMarks.filter((s) => s.nation === nation);
      return { drawn: mine.length, over: mine.filter((s) => s.leg === over).length, mpp: Math.round(v.metresPerPx) };
    },
    { x, y, m, nation, over: Leg.Over },
  );
}

test('the critic\'s war on Poland: on days 3 and 10 a patrol over a fight is drawn at T2 and at T3', async ({ page }, info) => {
  test.setTimeout(300_000);
  const found = patrols();
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto('/?scenario=1938&paused=1&seed=6047');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null && window.__warsim!.sim.mapLayers !== null, null, { timeout: 60_000 });
  await page.evaluate(([g, p, f]) => {
    const { sim } = window.__warsim!;
    sim.command({ kind: 'declareWar', attacker: g!, defender: p! });
    sim.command({ kind: 'declareWar', attacker: g!, defender: f! });
  }, [id('GER'), id('POL'), id('FRA')]);
  const out = process.env['EVIDENCE'] !== undefined ? path.resolve(import.meta.dirname, '../../docs/evidence/7.24') : info.outputPath();
  mkdirSync(out, { recursive: true });
  const seen: string[] = [];
  for (const [k, day] of DAYS.entries()) {
    const p = found[k]!;
    expect(p, `day ${day}: a fighter patrol over a fight`).not.toBeNull();
    const at = await page.evaluate(async (tick) => {
      const { sim, view } = window.__warsim!;
      const s = await sim.step(tick - view!.lastTick);
      await new Promise<void>((done) => {
        const wait = (): void => (view!.lastTick === s.tick ? done() : void setTimeout(wait, 5));
        wait();
      });
      return sim.hash();
    }, p.tick);
    expect(at).toEqual({ tick: p.tick, hash: p.hash });
    for (const m of [80, 25]) {
      const got = await planesAt(page, p.x, p.y, m, p.nation);
      expect(got.mpp).toBe(m);
      expect(got.over, `day ${day} at ${m} m/px: planes of the patrol over formation ${p.formation}`).toBeGreaterThanOrEqual(1);
      seen.push(`day ${day} at ${m} m/px: ${got.drawn} of the nation's sorties drawn, ${got.over} over their targets`);
      if (day === 10) await page.screenshot({ path: path.join(out, `c-patrol-day10-${String(m).padStart(3, '0')}m.png`) });
    }
  }
  console.log(`patrols over fights (seed 6047): ${seen.join('; ')}`);
});
