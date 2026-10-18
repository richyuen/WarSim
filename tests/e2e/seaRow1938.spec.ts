import { expect, test, type Page } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import { Terrain } from '../../src/shared/terrain';
import { NATIONS_1938 } from '../../src/sim/scenario1938';

// PLAN 7.10b (critic run 7, naval 5: "a sea battle's row must land on both fleets firing"): the
// critic's game (seed 9043, Germany on the United Kingdom): the row framed the box of all the
// battle's fleets, 24 cells across (668 m/px, counters, no fire), and the battle's place had one
// side's fleet alone. The row now frames its nearest two fleets at war with each other: from the
// row, a fleet of each side on the screen with its ships drawn, and their fire in the battle's hours.
//
// PLAN 7.19 (critic run 8, R8-B2): seed 5591, Germany on the United Kingdom, hour 41: the row landed
// on dry land at Groningen, the pair a British carrier group and a German battle squadron 279 km
// apart, joined by the carrier's wings. Since 7.19a a battle is fought at the distance of its fleets
// (they close; a ship fires at fleets its weapon reaches), and since 7.19b a battle's row frames two
// fleets within reach of a ship's weapon, its middle on the water; a battle with no such pair (a
// carrier's wings alone reach) has no row. So each test takes the first battle that has a row.

const id = (tag: string): number => NATIONS_1938.findIndex((n) => n.tag === tag) + 1;

/** After a flight of the camera: until it is over (a fixed wait was short under load), and a snapshot of the new view. */
async function landed(page: Page): Promise<void> {
  await page.waitForTimeout(300);
  await page.waitForFunction(() => !window.__warsim!.view!.controller.animating, null, { timeout: 60_000 });
  await page.waitForTimeout(700);
}

/** From the first sea battle of `attacker` and `defender` with a ticker row after the one declares war on the other, stepping `step` hours at a time: what the row shows. */
async function fromRow(page: Page, seed: number, attacker: string, defender: string, step: number, evidence: string): Promise<{ a: number; b: number; m: number; shots: number; water: boolean; tick: number }> {
  await page.setViewportSize({ width: 1400, height: 800 });
  await page.goto(`/?scenario=1938&paused=1&seed=${seed}`);
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null, null, { timeout: 60_000 });
  const tick = await page.evaluate(
    async ([g, e, step]) => {
      const { sim, view } = window.__warsim!;
      sim.command({ kind: 'declareWar', attacker: g!, defender: e! });
      for (let h = 0; h < 20 * 24; h += step!) {
        const t = (await sim.step(step!)).tick;
        await new Promise<void>((done) => {
          const wait = (): void => (view!.lastTick === t ? done() : void setTimeout(wait, 5));
          wait();
        });
        if (view!.seaBattles().some((b) => b.pair !== null && [b.a, b.b].includes(g!) && [b.a, b.b].includes(e!))) return t;
      }
      return -1;
    },
    [id(attacker), id(defender), step],
  );
  expect(tick, 'a sea battle with a row within 20 days').toBeGreaterThan(0);
  // Its row: the ticker lists the battles with a pair, in the view's order.
  const [first, k] = await page.evaluate(
    ([g, e]) => {
      const rows = window.__warsim!.view!.seaBattles().filter((b) => b.pair !== null);
      const k = rows.findIndex((b) => [b.a, b.b].includes(g!) && [b.a, b.b].includes(e!));
      return [rows[k]!, k] as const;
    },
    [id(attacker), id(defender)],
  );
  const row = page.getByTestId('sea-battle-row').nth(k);
  await expect(row).toBeVisible();
  const pair = first.pair!;
  // The pair's middle is on the water: its cell of the terrain layer is no land.
  const water = await page.evaluate(
    ([x, y, plains]) => {
      const t = window.__warsim!.sim.mapLayers!.terrain;
      return t.data[Math.floor(y!) * t.w + Math.floor(x!)]! < plains!;
    },
    [pair.x, pair.y, Terrain.Plains],
  );
  await row.click();
  await landed(page);
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
    if (h === 0) await page.screenshot({ path: path.resolve(evidence) });
    await page.evaluate(() => window.__warsim!.sim.step(1));
    hour++;
    await page.waitForFunction((t) => window.__warsim!.view!.lastTick >= t, hour);
  }
  const kmPerCell = await page.evaluate(() => (window.__warsim!.view!.metresPerPx * window.__warsim!.view!.controller.cam.scale) / 1000);
  console.log(
    `seed ${seed}, hour ${tick}: battle of ${first.a} and ${first.b}: its fleets' box ${first.span[0].toFixed(1)} × ${first.span[1].toFixed(1)} cells, its pair ${pair.w.toFixed(1)} × ${pair.h.toFixed(1)} (about ${(Math.hypot(pair.w, pair.h) * kmPerCell).toFixed(0)} km at the equator's cell), its middle on ${water ? 'water' : 'land'}; from the row at ${seen.m.toFixed(0)} m/px, fleets with ships on the screen ${seen.a} and ${seen.b}; at most ${shots} shots drawn`,
  );
  return { ...seen, shots, water, tick };
}

test("a sea battle's row lands on both fleets firing (the critic's game of run 7)", async ({ page }) => {
  test.setTimeout(300_000);
  // An hour at a time (a day at a time until PLAN 7.19b: the battles at the days' turns are
  // now a carrier's wings alone, with no row).
  const r = await fromRow(page, 9043, 'GER', 'ENG', 1, 'docs/evidence/7.10/b-sea-row.png');
  expect(r.a, 'a fleet of the one side, its ships on the screen').toBeGreaterThan(0);
  expect(r.b, 'a fleet of the other, its ships on the screen').toBeGreaterThan(0);
  expect(r.shots, "their fire drawn in the battle's hours").toBeGreaterThan(0);
  expect(r.water, "the row's centre on the water").toBe(true);
});

test("a sea battle's row lands on the fight, on the water (the critic's game of run 8, R8-B2)", async ({ page }) => {
  test.setTimeout(300_000);
  // An hour at a time: the critic clicked the row at hour 41, when the battle was the carrier's
  // wings alone; its row now comes when two fleets are within reach of a ship's weapon.
  const r = await fromRow(page, 5591, 'GER', 'ENG', 1, 'docs/evidence/7.19/c-sea-row-5591.png');
  // The pair is within reach of a ship's weapon by the server's rule (`inShipReach`, its unit test).
  expect(r.water, "the row's centre on the water").toBe(true);
  expect(r.m, 'ships drawn as ships: under T2\'s limit').toBeLessThan(250);
  expect(r.a, 'a fleet of the one side, its ships on the screen').toBeGreaterThan(0);
  expect(r.b, 'a fleet of the other, its ships on the screen').toBeGreaterThan(0);
  expect(r.shots, "their fire drawn in the battle's hours").toBeGreaterThan(0);
});

test("from the row of the critic's battle, both fleets' fire on the screen within seconds at Speed x1 (PLAN 7.22a)", async ({ page }) => {
  test.setTimeout(300_000);
  // The critic (run 8, naval 6) stepped six hours at a time, clicked the row and watched 6 s at
  // Speed x1: no gunfire. The tests above step an hour at a time while paused, when a tick's shots
  // are spread over STEP_SPREAD_MS; here the game runs, so they are spread over the tick's wall time.
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto('/?scenario=1938&paused=1&seed=5591');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null, null, { timeout: 60_000 });
  const [g, e] = [id('GER'), id('ENG')];
  const hour = await page.evaluate(
    async ([g, e]) => {
      const { sim, view } = window.__warsim!;
      sim.command({ kind: 'declareWar', attacker: g!, defender: e! });
      for (let h = 6; h <= 20 * 24; h += 6) {
        const t = (await sim.step(6)).tick;
        await new Promise<void>((done) => {
          const wait = (): void => (view!.lastTick === t ? done() : void setTimeout(wait, 5));
          wait();
        });
        if (view!.seaBattles().some((b) => b.pair !== null && [b.a, b.b].includes(g!) && [b.a, b.b].includes(e!))) return h;
      }
      return -1;
    },
    [g, e],
  );
  expect(hour, 'a sea battle of the two with a row within 20 days').toBeGreaterThan(0);
  const k = await page.evaluate(
    ([g, e]) => window.__warsim!.view!.seaBattles().filter((b) => b.pair !== null).findIndex((b) => [b.a, b.b].includes(g!) && [b.a, b.b].includes(e!)),
    [g, e],
  );
  await page.getByTestId('sea-battle-row').nth(k).click();
  await landed(page);
  // Each formation's nation, from the sim (the fleets of the battle are all there at the row).
  await page.evaluate(async () => {
    const w = window as unknown as { __nationOf: Record<number, number> };
    w.__nationOf = {};
    for (const f of (await window.__warsim!.sim.inspect(true)).formations) w.__nationOf[f.id] = f.nation;
  });
  // Every frame the page draws for 6 s at Speed x1: the ships' tracers it holds, by the shooter's
  // and the target's side (`FireFx.tracers`: in flight and on the screen, `CULL_PX`). Counted in
  // the frame itself: a tracer lives about a second, and a sampler under load comes by less often.
  await page.evaluate(
    ([g, e]) => {
      const v = window.__warsim!.view!;
      const nationOf = (window as unknown as { __nationOf: Record<number, number> }).__nationOf;
      const sideOf = (el: number): number => {
        const i = v.elementId.indexOf(el);
        return i < 0 ? 0 : (nationOf[v.elementFormation[i]!] ?? 0);
      };
      const rec = { ab: 0, ba: 0, firstMs: -1, best: 0, picture: '', frames: 0, t0: performance.now(), tick0: v.lastTick, ticks: 0 };
      (window as unknown as { __seaFire: typeof rec }).__seaFire = rec;
      const fire = (v as unknown as { fire: { tracers: { shooter: number; target: number; weapon: number }[]; draw: (...a: unknown[]) => void } }).fire;
      const draw = fire.draw.bind(fire);
      fire.draw = (...a: unknown[]): void => {
        draw(...a);
        rec.frames++;
        rec.ticks = v.lastTick - rec.tick0;
        let ab = 0;
        let ba = 0;
        for (const s of fire.tracers) {
          // Ships' guns and torpedoes (`Weapon.naval`, `Weapon.torpedo`).
          if (s.weapon < 3) continue;
          const [from, to] = [sideOf(s.shooter), sideOf(s.target)];
          if (from === g && to === e) ab++;
          if (from === e && to === g) ba++;
        }
        rec.ab = Math.max(rec.ab, ab);
        rec.ba = Math.max(rec.ba, ba);
        if (ab > 0 && ba > 0 && rec.firstMs < 0) rec.firstMs = performance.now() - rec.t0;
        // The picture of the frame with the most of both sides' fire, once the frame is whole.
        if (ab > 0 && ba > 0 && ab + ba > rec.best) {
          rec.best = ab + ba;
          queueMicrotask(() => {
            const map = document.createElement('canvas');
            const first = document.querySelector('canvas')!;
            map.width = first.width;
            map.height = first.height;
            const c2 = map.getContext('2d')!;
            for (const layer of document.querySelectorAll('canvas')) c2.drawImage(layer, 0, 0, map.width, map.height);
            rec.picture = map.toDataURL('image/png');
          });
        }
      };
      const hud = window.__warsim!.hud;
      hud.setSpeedLevel(0);
      if (hud.paused.value) hud.togglePause();
    },
    [g, e],
  );
  await page.waitForTimeout(6000);
  const seen = await page.evaluate(() => {
    const hud = window.__warsim!.hud;
    if (!hud.paused.value) hud.togglePause();
    return (window as unknown as { __seaFire: { ab: number; ba: number; firstMs: number; picture: string; frames: number; ticks: number } }).__seaFire;
  });
  if (seen.picture) writeFileSync(path.resolve('docs/evidence/7.22/a-sea-row-x1.png'), Buffer.from(seen.picture.split(',')[1]!, 'base64'));
  console.log(`(6 s: ${seen.frames} frames, ${seen.ticks} ticks)`);
  console.log(`seed 5591: the row of Germany's and Britain's battle at hour ${hour}; at Speed x1, shots on the screen at once: at most ${seen.ab} German and ${seen.ba} British; both sides' within ${seen.firstMs.toFixed(0)} ms`);
  expect(seen.ab, "Germany's ships' fire at Britain's on the screen").toBeGreaterThan(0);
  expect(seen.ba, "Britain's ships' fire at Germany's on the screen").toBeGreaterThan(0);
  expect(seen.firstMs, 'both within 6 s at Speed x1').toBeGreaterThanOrEqual(0);
});
