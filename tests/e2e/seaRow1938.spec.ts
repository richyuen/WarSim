import { expect, test } from '@playwright/test';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import { NATIONS_1938 } from '../../src/sim/scenario1938';

// PLAN 7.10b (critic run 7, naval 5: "a sea battle's row must land on both fleets firing"): the
// critic's game (seed 9043, Germany on the United Kingdom): the row framed the box of all the
// battle's fleets, 24 cells across (668 m/px, counters, no fire), and the battle's place had one
// side's fleet alone. The row now frames its nearest two fleets at war with each other: from the
// row, a fleet of each side on the screen with its ships drawn, and their fire in the battle's hours.

const id = (tag: string): number => NATIONS_1938.findIndex((n) => n.tag === tag) + 1;

test("a sea battle's row lands on both fleets firing (the critic's game)", async ({ page }) => {
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 1400, height: 800 });
  await page.goto('/?scenario=1938&paused=1&seed=9043');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null, null, { timeout: 60_000 });
  const [GER, ENG] = [id('GER'), id('ENG')];
  const tick = await page.evaluate(async ([g, e]) => {
    const { sim, view } = window.__warsim!;
    sim.command({ kind: 'declareWar', attacker: g!, defender: e! });
    // A day at a time, as the critic's run: its battle by then had more fleets joined.
    for (let d = 0; d < 20; d++) {
      const t = (await sim.step(24)).tick;
      await new Promise<void>((done) => {
        const wait = (): void => (view!.lastTick === t ? done() : void setTimeout(wait, 5));
        wait();
      });
      if (view!.seaBattles().length > 0) return t;
    }
    return -1;
  }, [GER, ENG]);
  expect(tick, 'a sea battle within 20 days').toBeGreaterThan(0);
  const first = await page.evaluate(() => window.__warsim!.view!.seaBattles()[0]!);
  await page.getByTestId('sea-battle-row').first().click();
  await page.waitForTimeout(2500);
  let shots = 0;
  let seen = { a: 0, b: 0, m: 0 };
  let hour = tick;
  for (let h = 0; h < 6 && (await page.evaluate(() => window.__warsim!.view!.seaBattles().length)) > 0; h++) {
    const r = await page.evaluate(async (b) => {
      const v = window.__warsim!.view!;
      v.draw(performance.now());
      const cam = v.controller.cam;
      const side = { a: 0, b: 0 };
      for (const f of (await window.__warsim!.sim.inspect(true)).formations) {
        if (!v.formationAfloat(f.id)) continue;
        const s = f.nation === b.a ? 'a' : f.nation === b.b ? 'b' : null;
        if (!s) continue;
        let on = 0;
        for (let i = 0; i < v.elementCount; i++) {
          if (v.elementFormation[i] !== f.id) continue;
          const x = (v.elementX[i]! - cam.cx) * cam.scale + window.innerWidth / 2;
          const y = (v.elementY[i]! - cam.cy) * cam.scale + window.innerHeight / 2;
          if (x >= 0 && x <= window.innerWidth && y >= 0 && y <= window.innerHeight && document.elementFromPoint(x, y)?.tagName === 'CANVAS') on++;
        }
        if (on > 0) side[s]++;
      }
      return { ...side, m: v.metresPerPx, shots: (v as unknown as { fire: { shots: unknown[] } }).fire.shots.length };
    }, first);
    if (h === 0) seen = { a: r.a, b: r.b, m: r.m };
    shots = Math.max(shots, r.shots);
    if (h === 0) await page.screenshot({ path: path.resolve('docs/evidence/7.10/b-sea-row.png') });
    await page.evaluate(() => window.__warsim!.sim.step(1));
    hour++;
    await page.waitForFunction((t) => window.__warsim!.view!.lastTick >= t, hour);
  }
  console.log(`battle of ${first.a} and ${first.b}: its fleets' box ${first.span[0].toFixed(1)} × ${first.span[1].toFixed(1)} cells, its pair ${first.pair.w.toFixed(1)} × ${first.pair.h.toFixed(1)}; from the row at ${seen.m.toFixed(0)} m/px, fleets with ships on the screen ${seen.a} and ${seen.b}; at most ${shots} shots drawn`);
  expect(seen.a, 'a fleet of the one side, its ships on the screen').toBeGreaterThan(0);
  expect(seen.b, 'a fleet of the other, its ships on the screen').toBeGreaterThan(0);
  expect(shots, 'their fire drawn in the battle\'s hours').toBeGreaterThan(0);
});
