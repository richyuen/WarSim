import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import { NATIONS_1938 } from '../../src/sim/scenario1938';

// PLAN 7.132 (critic run 15, naval 7): "a sea battle at 15–150 m/px is a few small hulls far apart":
// seed 3613 with Germany at war with Poland and Britain from the start, the row of a British transport
// group against a Nationalist Spanish cruiser squadron (`critic/shots/c15e_3613_sea_01_row_live_1.png`):
// at 47 m/px each ship an element sprite of 0.026 cells, its hull 6–9 px, the two groups 540 px apart
// in 1600. Here that battle and four more of the same game's rows (`tools/diag/seaPairs.ts 3613 70
// GER:POL,GER:ENG`): from each row's press, ship elements of both sides on the screen, the nearest two
// of the two sides within a third of the view's width, and every ship on the screen at least 12 px
// from stern to bow (`MapView.shipHullPx`, the shader's rule of the layer that draws it).

const id = (tag: string): number => NATIONS_1938.findIndex((n) => n.tag === tag) + 1;

/** The game's rows: about the hour the row has stood two hours running (`seaPairs`), its two sides, and what fights. */
const CASES = [
  { hour: 45, a: 'ENG', b: 'GER', what: 'destroyers against destroyers, 12 km' },
  { hour: 172, a: 'ENG', b: 'ITA', what: 'a battle fleet against submarines, 6 km' },
  { hour: 1268, a: 'ENG', b: 'NSP', what: "the critic's: transports against a cruiser squadron, 20 km" },
  { hour: 1424, a: 'ENG', b: 'JAP', what: 'a battle fleet against destroyers, 12 km' },
  { hour: 1477, a: 'NSP', b: 'POR', what: 'a cruiser squadron against destroyers, 18 km' },
] as const;

/** After a flight of the camera: until it is over, and a snapshot of the new view. */
async function landed(page: Page): Promise<void> {
  await page.waitForTimeout(300);
  await page.waitForFunction(() => !window.__warsim!.view!.controller.animating, null, { timeout: 60_000 });
  await page.waitForTimeout(700);
}

/** Steps the game to `tick` and waits for the view to have its snapshot. */
async function stepTo(page: Page, tick: number): Promise<void> {
  await page.evaluate(async (tick) => {
    const { sim, view } = window.__warsim!;
    const now = view!.lastTick;
    if (tick <= now) return;
    const t = (await sim.step(tick - now)).tick;
    await new Promise<void>((done) => {
      const wait = (): void => (view!.lastTick === t ? done() : void setTimeout(wait, 5));
      wait();
    });
  }, tick);
}

/** The index among the rows of a pair (the ticker lists those first) of the battle of `a` and `b`, or −1. */
async function rowOf(page: Page, a: number, b: number): Promise<number> {
  return page.evaluate(([a, b]) => window.__warsim!.view!.seaBattles().filter((s) => s.pair !== null).findIndex((s) => [s.a, s.b].includes(a!) && [s.a, s.b].includes(b!)), [a, b]);
}

test('a sea battle seen close from its row: both sides near, hulls that read (PLAN 7.132)', async ({ page }) => {
  test.setTimeout(900_000);
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto('/?scenario=1938&paused=1&seed=3613');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null, null, { timeout: 60_000 });
  await page.evaluate(
    ([g, p, e]) => {
      const { sim } = window.__warsim!;
      sim.command({ kind: 'declareWar', attacker: g!, defender: p! });
      sim.command({ kind: 'declareWar', attacker: g!, defender: e! });
    },
    [id('GER'), id('POL'), id('ENG')],
  );
  const lines: string[] = [];
  const results: { what: string; a: number; b: number; near: number; hull: number; m: number }[] = [];
  for (const c of CASES) {
    const [a, b] = [id(c.a), id(c.b)];
    // The row, two hours running, from a few hours before the scan's hour.
    await stepTo(page, c.hour - 4);
    let run = 0;
    let k = -1;
    for (let h = c.hour - 3; h <= c.hour + 6 && run < 2; h++) {
      await stepTo(page, h);
      k = await rowOf(page, a, b);
      run = k >= 0 ? run + 1 : 0;
    }
    expect(k, `${c.what}: its row`).toBeGreaterThanOrEqual(0);
    await page.getByTestId('sea-battle-row').nth(k).click();
    await landed(page);
    const r = await page.evaluate(
      async ([a, b]) => {
        const v = window.__warsim!.view!;
        v.draw(performance.now());
        const cam = v.controller.cam;
        const nationOf = new Map<number, number>();
        for (const f of (await window.__warsim!.sim.inspect(true)).formations) if (v.formationAfloat(f.id)) nationOf.set(f.id, f.nation);
        const on: { side: number; x: number; y: number; hull: number }[] = [];
        for (let i = 0; i < v.elementCount; i++) {
          const n = nationOf.get(v.elementFormation[i]!);
          if (n !== a && n !== b) continue;
          const x = (v.elementX[i]! - cam.cx) * cam.scale + window.innerWidth / 2;
          const y = (v.elementY[i]! - cam.cy) * cam.scale + window.innerHeight / 2;
          if (x < 0 || x > window.innerWidth || y < 0 || y > window.innerHeight || document.elementFromPoint(x, y)?.tagName !== 'CANVAS') continue;
          on.push({ side: n!, x, y, hull: v.shipHullPx(i) });
        }
        let near = Infinity;
        for (const p of on) for (const q of on) if (p.side === a && q.side === b) near = Math.min(near, Math.hypot(p.x - q.x, p.y - q.y));
        return {
          a: on.filter((p) => p.side === a).length,
          b: on.filter((p) => p.side === b).length,
          near: near / window.innerWidth,
          hull: on.length > 0 ? Math.min(...on.map((p) => p.hull)) : 0,
          m: v.metresPerPx,
        };
      },
      [a, b],
    );
    await page.screenshot({ path: path.resolve(`docs/evidence/7.132/row-${c.hour}-${c.a}-${c.b}.png`) });
    results.push({ what: c.what, ...r });
    lines.push(`hour ${c.hour} ${c.a}/${c.b} (${c.what}): ${r.m.toFixed(1)} m/px, ships on the screen ${r.a} and ${r.b}, nearest of the two sides ${(r.near * 100).toFixed(1)} % of the width, least hull ${r.hull.toFixed(1)} px`);
  }
  console.log(lines.join('\n'));
  for (const r of results) {
    expect(r.a, `${r.what}: ships of the one side on the screen`).toBeGreaterThan(0);
    expect(r.b, `${r.what}: ships of the other`).toBeGreaterThan(0);
    expect(r.near, `${r.what}: the nearest enemy hulls within a third of the view's width`).toBeLessThanOrEqual(1 / 3);
    expect(r.hull, `${r.what}: every hull on the screen at least 12 px long`).toBeGreaterThanOrEqual(12);
  }
});
