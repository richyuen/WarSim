/**
 * PLAN 7.119: the stalls the player sees at Max, in the page. A saved state is loaded into the 1938
 * world, the game runs at Max for `years` game years; the page reads the HUD's tick every 20 ms and
 * keeps the wall time between its changes (the critic's measure, run 14 `c14_l_lategame.mjs`). Per
 * year: wall seconds, frames a second, the gaps over 500 ms and the longest 8.
 *
 * Usage: `npm run build`, `npx vite preview --port 5299`, then
 * `npx tsx tools/diag/maxStalls.ts <seed> <state.bin | -> [years = 1] [out.json] [size]`. Run alone. `-`: no
 * save, the 1938 world from its start; `size` the map's (S, M, L, XL). `CAM=cx,cy,m` sets the view first
 * (the critic's run 15: `CAM=1100,267,3000`, Berlin at 3,000 m/px; PLAN 7.131).
 */
/* eslint-disable @typescript-eslint/no-explicit-any -- the page's debug handle, `window.__warsim`, is read untyped */
import { readFileSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const seed = Number(process.argv[2]);
const bin = process.argv[3]!;
const years = Number(process.argv[4] ?? 1);
const outFile = process.argv[5] ?? `.cache/maxStalls_${seed}.json`;
const size = process.argv[6];
const BASE = process.env.BASE ?? 'http://localhost:5299';

const browser = await chromium.launch({ args: ['--ignore-gpu-blocklist', '--enable-gpu'] });
const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
await context.addInitScript({ content: 'window.__name = (f) => f;' });
const page = await context.newPage();
const errors: string[] = [];
page.on('pageerror', (e) => errors.push(e.message));
const bytes = bin === '-' ? null : readFileSync(bin);
if (bytes) await page.route('**/__state.bin', (r) => r.fulfill({ status: 200, body: bytes, contentType: 'application/octet-stream' }));
await page.goto(`${BASE}/?scenario=1938&paused=1&seed=${seed}${size ? `&size=${size}` : ''}`);
await page.waitForFunction(() => ((window as any).__warsim?.view?.frames ?? 0) > 0, null, { timeout: 120_000 });
await page.waitForFunction(() => (window as any).__warsim.hud.stats.value !== null, null, { timeout: 120_000 });
if (bytes)
  await page.evaluate(async () => {
    const b = new Uint8Array(await (await fetch('/__state.bin')).arrayBuffer());
    return (window as any).__warsim.sim.load(b);
  });
await page.waitForTimeout(3000);
// `CAM=cx,cy,m`: the view's centre cell and metres a pixel during the run (the critic's run 15 looks at
// Berlin, `CAM=1100,267,3000`); unset, the view the page opens with.
const cam = process.env.CAM?.split(',').map(Number) as [number, number, number] | undefined;
if (cam)
  await page.evaluate(([cx, cy, m]) => {
    const v = (window as any).__warsim.view;
    v.controller.set({ cx, cy, scale: (v.metresPerPx * v.controller.cam.scale) / m });
  }, cam);
await page.evaluate(() => {
  const w = (window as any).__warsim;
  w.__gaps = [];
  let last = w.hud.tick.value;
  let lastT = performance.now();
  setInterval(() => {
    if (w.hud.paused.value && w.__running) w.hud.togglePause();
    const t = w.hud.tick.value;
    const now = performance.now();
    if (t !== last) {
      w.__gaps.push(now - lastT);
      last = t;
      lastT = now;
    }
  }, 20);
  w.hud.setSpeedLevel(99);
  w.__running = true;
  if (w.hud.paused.value) w.hud.togglePause();
});
const out: { seed: number; bin: string; years: unknown[]; errors: string[] } = { seed, bin, years: [], errors };
for (let y = 1; y <= years; y++) {
  const w0 = Date.now();
  const f0 = await page.evaluate(() => (window as any).__warsim.view.frames as number);
  const start = await page.evaluate(() => (window as any).__warsim.hud.tick.value as number);
  await page.waitForFunction((t) => (window as any).__warsim.hud.tick.value >= t + 8760, start, { timeout: 1_800_000, polling: 1000 });
  const f1 = await page.evaluate(() => (window as any).__warsim.view.frames as number);
  const wallS = (Date.now() - w0) / 1000;
  const gaps = await page.evaluate(() => {
    const g: number[] = (window as any).__warsim.__gaps.splice(0);
    g.sort((a, b) => b - a);
    return { n: g.length, over500: g.filter((x) => x > 500).length, over250: g.filter((x) => x > 250).length, top: g.slice(0, 8).map((x) => Math.round(x)) };
  });
  const row = { y, wallS, fps: +((f1 - f0) / wallS).toFixed(1), gaps };
  out.years.push(row);
  console.log(JSON.stringify(row));
  writeFileSync(outFile, JSON.stringify(out, null, 1));
}
await browser.close();
console.log('done:');
