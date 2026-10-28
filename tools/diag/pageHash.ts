/**
 * PLAN 7.152b's AT: critic run 17's browser probe of seed 1307 (`critic/scripts/c17_h_misc.mjs`),
 * run again in the page `runs` times: the 1938 game opened paused, a look at London at 2,500 m/px,
 * the mouse over it, six wheel steps out with the mouse still, a drag, the mouse away; then each
 * year stepped in one message and its state hash read. Each year's hash is compared with `want`
 * (the headless hashes, comma-separated, `tools/diag/workerDeterminism.ts`'s `plain` arm). Runs go
 * `parallel` at a time, so the machine is loaded as in the critic's wave.
 *
 * Usage: npx tsx tools/diag/pageHash.ts <base url> <seed> <years> <want,...> [runs = 10] [parallel = 3] [out]
 */
import { writeFileSync } from 'node:fs';
import { chromium, type Page } from '@playwright/test';

const [base = 'http://127.0.0.1:5401', seedS = '1307', yearsS = '1', wantS = '', runsS = '10', parS = '3', outPath = '.cache/pageHash.json'] = process.argv.slice(2);
const seed = Number(seedS);
const years = Number(yearsS);
const want = wantS.split(',');
const LONDON: [number, number] = [1023.3173333333333, 275.18807703521844];

async function screenOf(page: Page, x: number, y: number): Promise<[number, number]> {
  return page.evaluate(
    ([x, y]) => {
      const c = window.__warsim!.view!.controller.cam;
      return [(x - c.cx) * c.scale + window.innerWidth / 2, (y - c.cy) * c.scale + window.innerHeight / 2] as [number, number];
    },
    [x, y] as const,
  );
}

interface Run {
  run: number;
  years: { y: number; tick: number; hash: string; same: boolean }[];
  errors: string[];
  fatal?: string;
}

async function one(run: number): Promise<Run> {
  const browser = await chromium.launch({ args: ['--ignore-gpu-blocklist', '--enable-gpu'] });
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  await context.addInitScript({ content: 'window.__name = (f) => f;' });
  const page = await context.newPage();
  const out: Run = { run, years: [], errors: [] };
  page.on('pageerror', (e) => out.errors.push(`pageerror: ${e.message}`));
  try {
    await page.goto(`${base}/?scenario=1938&paused=1&seed=${seed}`);
    await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0, null, { timeout: 180_000 });
    await page.waitForFunction(() => window.__warsim!.hud.stats.value !== null && window.__warsim!.sim.mapLayers !== null && window.__warsim!.sim.elevation !== null, null, { timeout: 180_000 });
    await page.evaluate(
      ([cx, cy]) => {
        const v = window.__warsim!.view!;
        v.controller.set({ cx, cy, scale: (v.metresPerPx * v.controller.cam.scale) / 2500 });
      },
      LONDON,
    );
    await page.waitForTimeout(1500);
    const [sx, sy] = await screenOf(page, LONDON[0], LONDON[1]);
    await page.mouse.move(sx, sy);
    await page.waitForTimeout(700);
    for (let i = 0; i < 6; i++) {
      await page.mouse.wheel(0, 400);
      await page.waitForTimeout(150);
    }
    await page.waitForTimeout(900);
    await page.mouse.down();
    await page.mouse.move(sx - 300, sy - 100, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(900);
    await page.mouse.move(5, 5);
    for (let y = 1; y <= years; y++) {
      const st = await page.evaluate(async () => {
        const w = window.__warsim!;
        const tick = (await w.sim.hash()).tick;
        await w.sim.step(Math.ceil((tick + 1) / 8760) * 8760 - tick);
        return w.sim.hash();
      });
      const hash = (st.hash >>> 0).toString(16).padStart(8, '0');
      out.years.push({ y, tick: st.tick, hash, same: hash === want[y - 1] });
    }
  } catch (e) {
    out.fatal = String((e as Error).stack ?? e);
  }
  await browser.close();
  process.stderr.write(`run ${run}: ${out.years.map((y) => `${y.hash}${y.same ? '' : ' DIFFERENT'}`).join(' ')}${out.fatal ? ` fatal ${out.fatal.slice(0, 200)}` : ''}\n`);
  return out;
}

const runs = Number(runsS);
const par = Number(parS);
const results: Run[] = [];
for (let r = 0; r < runs; r += par) {
  results.push(...(await Promise.all(Array.from({ length: Math.min(par, runs - r) }, (_, i) => one(r + i + 1)))));
}
const same = results.filter((r) => !r.fatal && r.years.length === years && r.years.every((y) => y.same)).length;
writeFileSync(outPath, JSON.stringify({ base, seed, years, want, runs, parallel: par, same, results }, null, 1));
process.stdout.write(`${same} of ${runs} runs equal to headless every year\n`);
