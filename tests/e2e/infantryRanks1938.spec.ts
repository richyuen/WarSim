import { expect, test } from '@playwright/test';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import { NATIONS_1938 } from '../../src/sim/scenario1938';
import { Frame } from '../../src/shared/unitLooks';

// PLAN 7.21a (critic run 8, semantic zoom 7: "infantry at 10 m/px are shapeless clumps of figures,
// the two sides near one colour on the grass", `critic/shots/c8c_6047_inf_0010m.png`). The critic's
// case: seed 6047, Germany on Poland, day 3, the first German infantry division in contact. At 10
// m/px the pixels at the middles of the two sides' infantry figures are measured against each other
// and against the ground, as PLAN 7.9b measured the tanks (`tankSides1938`). Pictures at 25 and 10.

const id = (tag: string): number => NATIONS_1938.findIndex((n) => n.tag === tag) + 1;
type Rgb = [number, number, number];
const lum = ([r, g, b]: Rgb): number => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const apart = (a: Rgb, b: Rgb): number => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

test("T3: the critic's infantry fight, the two sides' men told apart and from the ground", async ({ page }) => {
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto('/?scenario=1938&paused=1&seed=6047');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null, null, { timeout: 60_000 });
  const GER = id('GER');
  const pick = await page.evaluate(async ([g, p]) => {
    const { sim, view } = window.__warsim!;
    sim.command({ kind: 'declareWar', attacker: g!, defender: p! });
    for (let d = 0; d < 3; d++) {
      const tick = (await sim.step(24)).tick;
      await new Promise<void>((done) => {
        const wait = (): void => (view!.lastTick === tick ? done() : void setTimeout(wait, 5));
        wait();
      });
    }
    const inf = view!.formationsOf(g!).filter((f) => view!.formationEngaged(f) && /Infantry/i.test(view!.formationTitle(f)?.kind ?? ''));
    return inf.length > 0 ? { f: inf[0]!, at: view!.formationPos(inf[0]!)! } : null;
  }, [GER, id('POL')]);
  expect(pick, 'a German infantry division in contact on day 3').not.toBeNull();
  const look = async (m: number): Promise<void> => {
    await page.evaluate(({ x, y, m }) => {
      const v = window.__warsim!.view!;
      v.controller.set({ cx: x, cy: y, scale: (v.metresPerPx * v.controller.cam.scale) / m });
    }, { x: pick!.at[0], y: pick!.at[1], m });
  };
  await look(25);
  await page.waitForFunction(() => {
    const v = window.__warsim!.view!;
    return v.subscription?.tier === 3 && v.individualsShown && v.shares.individuals === 1 && v.individualCount > 0;
  }, null, { timeout: 15_000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.resolve('docs/evidence/7.21/a-infantry-25m.png') });
  await look(10);
  await page.waitForFunction(() => {
    const v = window.__warsim!.view!;
    return v.subscription?.tier === 3 && v.individualsShown && v.shares.individuals === 1 && v.individualCount > 0 && v.metresPerPx < 11;
  }, null, { timeout: 15_000 });
  await page.waitForTimeout(1500);

  const got = await page.evaluate(({ GER, infantry, prone }) => {
    const v = window.__warsim!.view!;
    const canvas = document.querySelector('canvas')!;
    const gl = canvas.getContext('webgl2')!;
    v.draw(performance.now());
    const dpr = canvas.width / canvas.clientWidth;
    const cam = v.controller.cam;
    const read = (sx: number, sy: number): [number, number, number] => {
      const px = new Uint8Array(4);
      gl.readPixels(Math.round(sx * dpr), canvas.height - Math.round(sy * dpr) - 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      return [px[0]!, px[1]!, px[2]!];
    };
    const index = new Map<number, number>();
    for (let i = 0; i < v.elementCount; i++) index.set(v.elementId[i]!, i);
    const nationOf = new Map<number, number>();
    const ours: [number, number, number][] = [];
    const theirs: [number, number, number][] = [];
    const placed: [number, number][] = [];
    const [vw, vh] = [canvas.clientWidth, canvas.clientHeight];
    for (let j = 0; j < v.individualCount; j++) {
      const e = index.get(v.individualOwner[j]!);
      if (e === undefined) continue;
      const f = v.elementFormation[e]!;
      if (!nationOf.has(f)) nationOf.set(f, v.formationTitle(f)?.nation ?? 0);
      const sx = (v.individualX[j]! - cam.cx) * cam.scale + vw / 2;
      const sy = (v.individualY[j]! - cam.cy) * cam.scale + vh / 2;
      placed.push([sx, sy]);
      if (sx < 20 || sy < 60 || sx > vw - 20 || sy > vh - 120 || (v.individualFrame(j) !== infantry && v.individualFrame(j) !== prone)) continue;
      const n = nationOf.get(f)!;
      if (n === GER) ours.push(read(sx, sy));
      else if (n !== 0) theirs.push(read(sx, sy));
    }
    // The ground: points of a grid 12 px or more from every figure.
    const ground: [number, number, number][] = [];
    for (let sy = 80; sy < vh - 140; sy += 23) {
      for (let sx = 30; sx < vw - 30; sx += 23) {
        if (placed.some(([x, y]) => Math.abs(x - sx) < 12 && Math.abs(y - sy) < 12)) continue;
        ground.push(read(sx, sy));
      }
    }
    const mean = (l: [number, number, number][]): [number, number, number] => {
      const m: [number, number, number] = [0, 0, 0];
      for (const c of l) for (let k = 0; k < 3; k++) m[k] = m[k]! + c[k]! / l.length;
      return m;
    };
    return { ours: ours.length, theirs: theirs.length, ground: ground.length, ger: mean(ours), pol: mean(theirs), soil: mean(ground) };
  }, { GER, infantry: Frame.infantry, prone: Frame.prone });
  const f = (c: Rgb): string => c.map((x) => Math.round(x)).join(',');
  console.log(
    `German men ${got.ours} (${f(got.ger)}), Polish men ${got.theirs} (${f(got.pol)}), ground ${got.ground} (${f(got.soil)}); ` +
      `apart ${apart(got.ger, got.pol).toFixed(0)}; from the ground: German ${apart(got.ger, got.soil).toFixed(0)} (lightness ${(lum(got.ger) - lum(got.soil)).toFixed(0)}), ` +
      `Polish ${apart(got.pol, got.soil).toFixed(0)} (lightness ${(lum(got.pol) - lum(got.soil)).toFixed(0)})`,
  );
  await page.screenshot({ path: path.resolve('docs/evidence/7.21/a-infantry-10m.png') });
  expect(got.ours).toBeGreaterThan(200);
  expect(got.theirs).toBeGreaterThan(200);
  expect(apart(got.ger, got.pol), 'the two sides, RGB').toBeGreaterThan(60);
  expect(apart(got.ger, got.soil), 'German men from the ground, RGB').toBeGreaterThan(40);
  expect(apart(got.pol, got.soil), 'Polish men from the ground, RGB').toBeGreaterThan(40);
});
