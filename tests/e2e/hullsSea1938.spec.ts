import { expect, test } from '@playwright/test';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import { NATIONS_1938 } from '../../src/sim/scenario1938';
import { Frame, isShipFrame } from '../../src/shared/unitLooks';

// PLAN 7.41b (critic run 11, naval 7: "at 20–40 m/px the enemy side reads as dark ovals beside red
// British silhouettes"; France's dark blue hulls read as the sea, seen at 7.35c). A battle squadron
// of every nation of the 1938 world, placed by the editor's command on open sea, at 20 m/px: the
// tinted part of each hull, its brightest pixel along its centre line, at least HULL_APART (summed
// RGB) from the sea's colour there.

const HULL_APART = 40;
/** Where the squadrons are placed: open sea, deep (the mid-Atlantic) and shallow (the North Sea's shelf). */
const SEAS = { deep: { lon: -38, lat: 28 }, shelf: { lon: 3, lat: 55.5 } } as const;
/** Cells between two nations' squadrons. */
const STEP = 3;
const COLS = 11;

for (const [sea, at] of Object.entries(SEAS)) {
  test(`T3: every nation's hulls stand off the ${sea} sea at 20 m/px (PLAN 7.41b)`, async ({ page }) => {
    test.setTimeout(900_000);
    await page.setViewportSize({ width: 1400, height: 800 });
    await page.goto('/?scenario=1938&paused=1&seed=99');
    await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null && window.__warsim!.hud.templates.value.length > 0, null, { timeout: 60_000 });
    const nations = NATIONS_1938.length;
    // Each nation's squadron at its own place of a grid about the sea's point (Miller projection, the map's).
    const placed = await page.evaluate(
      async ({ nations, at, step, cols }) => {
        const { sim, view, hud } = window.__warsim!;
        const v = view as unknown as { geo: { w: number; h: number } };
        const { w, h } = v.geo;
        const miller = (lat: number): number => 1.25 * Math.log(Math.tan(Math.PI / 4 + (0.4 * lat * Math.PI) / 180));
        const top = miller(80);
        const bottom = miller(-64.16507274496172);
        const x0 = ((at.lon + 180) / 360) * w;
        const y0 = ((top - miller(at.lat)) / (top - bottom)) * h;
        const template = hud.templates.value.findIndex((t) => t.nameKey === 'template.battle_squadron');
        // After the first hour: the month's start at tick 0 lays up the fleets a small nation cannot pay for.
        await sim.step(1);
        const rows = Math.ceil(nations / cols);
        for (let n = 1; n <= nations; n++) {
          const k = n - 1;
          const x = x0 + ((k % cols) - (cols - 1) / 2) * step;
          const y = y0 + (Math.floor(k / cols) - (rows - 1) / 2) * step;
          sim.command({ kind: 'spawnFleet', nation: n, x, y, template });
        }
        const tick = (await sim.step(1)).tick;
        await new Promise<void>((done) => {
          const wait = (): void => (view!.lastTick === tick ? done() : void setTimeout(wait, 5));
          wait();
        });
        return template;
      },
      { nations, at, step: STEP, cols: COLS },
    );
    expect(placed).toBeGreaterThanOrEqual(0);
    const shipFrames = Array.from({ length: 32 }, (_, f) => isShipFrame(f));
    const rows: { nation: number; tag: string; frame: number; hull: number[]; bright?: number[]; sea: number[]; apart: number; brightApart?: number }[] = [];
    // Each nation's squadron, the fleet of it placed last (the highest id), from the world's snapshot:
    // at 20 m/px the snapshot carries the formations about the view alone.
    // The nations living in 1938 (Ethiopia is Italy's): those the view has a capital of.
    const { fleets, living } = await page.evaluate(() => {
      const v = window.__warsim!.view!;
      const living = [...(v as unknown as { capitals: Map<number, unknown> }).capitals.keys()];
      const out: Record<number, { id: number; x: number; y: number }> = {};
      for (const f of v.formationIds()) {
        const t = v.formationTitle(f);
        const p = v.formationPos(f);
        if (!t || !p || !v.formationAfloat(f) || (out[t.nation]?.id ?? -1) > f) continue;
        out[t.nation] = { id: f, x: p[0], y: p[1] };
      }
      return { fleets: out, living };
    });
    expect(living.length, 'the nations living in 1938').toBeGreaterThan(100);
    for (const n of living) {
      const pos = fleets[n];
      if (!pos) {
        rows.push({ nation: n, tag: NATIONS_1938[n - 1]!.tag, frame: -1, hull: [], sea: [], apart: -1 });
        continue;
      }
      await page.evaluate(({ x, y }) => {
        const v = window.__warsim!.view!;
        v.controller.set({ cx: x, cy: y, scale: (v.metresPerPx * v.controller.cam.scale) / 20 });
      }, pos);
      await page.waitForFunction(
        (id) => {
          const v = window.__warsim!.view!;
          if (v.subscription?.tier !== 3 || v.individualCount === 0) return false;
          for (let i = 0; i < v.elementCount; i++) if (v.elementFormation[i] === id) return true;
          return false;
        },
        pos.id,
        { timeout: 30_000 },
      );
      await page.waitForTimeout(600);
      const got = await page.evaluate(
        ({ id, shipFrames }) => {
          const v = window.__warsim!.view!;
          const canvas = document.querySelector('canvas')!;
          const gl = canvas.getContext('webgl2')!;
          v.draw(performance.now());
          const dpr = canvas.width / canvas.clientWidth;
          const cam = v.controller.cam;
          const [vw, vh] = [canvas.clientWidth, canvas.clientHeight];
          const rgb = (sx: number, sy: number): number[] => {
            const p = new Uint8Array(4);
            gl.readPixels(Math.round(sx * dpr), canvas.height - Math.round(sy * dpr) - 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, p);
            return [p[0]!, p[1]!, p[2]!];
          };
          const apart = (a: number[], b: number[]): number => Math.abs(a[0]! - b[0]!) + Math.abs(a[1]! - b[1]!) + Math.abs(a[2]! - b[2]!);
          const lum = (c: number[]): number => 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
          // The sea's colour there: the commonest of 16 pixels on a ring 22 px about the ship (a
          // neighbour or its wake may cover a few).
          const seaAt = (sx: number, sy: number): number[] => {
            const count = new Map<string, number>();
            for (let k = 0; k < 16; k++) {
              const key = rgb(sx + 22 * Math.cos((k * Math.PI) / 8), sy + 22 * Math.sin((k * Math.PI) / 8)).join(',');
              count.set(key, (count.get(key) ?? 0) + 1);
            }
            return [...count.entries()].sort((a, b) => b[1] - a[1])[0]![0].split(',').map(Number);
          };
          const index = new Map<number, number>();
          for (let i = 0; i < v.elementCount; i++) index.set(v.elementId[i]!, i);
          const out: { frame: number; hull: number[]; bright: number[]; sea: number[]; apart: number; brightApart: number }[] = [];
          for (let j = 0; j < v.individualCount; j++) {
            const e = index.get(v.individualOwner[j]!);
            if (e === undefined || v.elementFormation[e] !== id || !shipFrames[v.elementFrame(e)]) continue;
            const sx = (v.individualX[j]! - cam.cx) * cam.scale + vw / 2;
            const sy = (v.individualY[j]! - cam.cy) * cam.scale + vh / 2;
            if (sx < 40 || sy < 100 || sx > vw - 40 || sy > vh - 150) continue;
            const f = v.elementFacing(e);
            // The middle of its hull (the bar), and the brightest pixel of the middle 10 px of its centre
            // line, inside the smallest hull (the tint's, for the record).
            const hull = rgb(sx, sy);
            let bright = hull;
            for (let t = -5; t <= 5; t += 0.5) {
              const c = rgb(sx + Math.cos(f) * t, sy + Math.sin(f) * t);
              if (lum(c) > lum(bright)) bright = c;
            }
            const sea = seaAt(sx, sy);
            out.push({ frame: v.elementFrame(e), hull, bright, sea, apart: apart(hull, sea), brightApart: apart(bright, sea) });
          }
          return { out };
        },
        { id: pos.id, shipFrames },
      );
      if (NATIONS_1938[n - 1]!.tag === 'FRA') await page.screenshot({ path: path.resolve(`docs/evidence/7.41/b-france-${sea}-20m${process.env['SHOT_TAG'] ?? ''}.png`), clip: { x: 450, y: 200, width: 500, height: 400 } });
      for (const o of got.out) rows.push({ nation: n, tag: NATIONS_1938[n - 1]!.tag, ...o });
      if (got.out.length === 0) rows.push({ nation: n, tag: NATIONS_1938[n - 1]!.tag, frame: -1, hull: [], sea: [], apart: -1 });
    }
    // Each nation's least, by class.
    const name: Record<number, string> = { [Frame.battleship]: 'battleship', [Frame.ship]: 'cruiser', [Frame.destroyer]: 'destroyer' };
    const least = new Map<string, (typeof rows)[number]>();
    for (const r of rows) {
      const k = `${r.tag} ${name[r.frame] ?? r.frame}`;
      if (!least.has(k) || r.apart < least.get(k)!.apart) least.set(k, r);
    }
    const sorted = [...least.entries()].sort((a, b) => a[1].apart - b[1].apart);
    console.log(`${sea}: ${rows.length} ships of ${living.length} nations; the 25 nearest the sea:\n` + sorted.slice(0, 25).map(([k, r]) => `${k}: middle ${r.hull.join(',')} sea ${r.sea.join(',')} apart ${r.apart}; brightest ${r.bright?.join(',')} apart ${r.brightApart}`).join('\n'));
    const missing = [...new Set(rows.filter((r) => r.frame < 0).map((r) => r.tag))];
    expect(missing, 'every nation has its ships on the screen').toEqual([]);
    const under = sorted.filter(([, r]) => r.apart < HULL_APART).map(([k, r]) => `${k} ${r.apart}`);
    expect(under, `hulls under ${HULL_APART} from the sea`).toEqual([]);
  });
}
