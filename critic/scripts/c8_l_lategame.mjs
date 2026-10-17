// Critic run 8, session L: the late game in the browser at Max from a headless checkpoint (seed 3371, year 27):
// wall time per year, the longest gap between ticks seen by the page, the frame rate, and the world at the end.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { launch, open1938, shot, save, lookAt, run, pause, CELLS } from './c8_lib.mjs';

const seed = Number(process.argv[2] ?? 3371);
const bin = process.argv[3] ?? 'critic/c7_seed3371_y27.bin';
const years = Number(process.argv[4] ?? 3);
const tag = `c8l_${seed}`;
const out = { seed, bin, years: [] };
const { browser, page, errors } = await launch();
try {
  const bytes = readFileSync(path.resolve(bin));
  await page.route('**/__critic_ck.bin', (r) => r.fulfill({ status: 200, body: bytes, contentType: 'application/octet-stream' }));
  await open1938(page, seed);
  const st = await page.evaluate(async () => {
    const b = new Uint8Array(await (await fetch('/__critic_ck.bin')).arrayBuffer());
    return window.__warsim.sim.load(b);
  });
  out.loaded = st;
  await page.waitForTimeout(3000);
  await lookAt(page, 1024, 420, 12000);
  await shot(page, `${tag}_00_world_loaded.png`);
  await lookAt(page, CELLS.berlin[0], CELLS.berlin[1], 3000);
  await shot(page, `${tag}_01_europe_loaded.png`);
  await page.evaluate(() => {
    const w = window.__warsim;
    w.__gaps = [];
    let lastTick = w.hud.tick.value;
    let lastT = performance.now();
    w.__autoResumes = 0;
    setInterval(() => {
      // a nuclear alert pauses the game (the setting's default): resume, counting it
      if (w.hud.paused.value && w.__running) { w.__autoResumes++; w.hud.togglePause(); }
      const t = w.hud.tick.value;
      const now = performance.now();
      if (t !== lastTick) {
        w.__gaps.push(now - lastT);
        lastTick = t;
        lastT = now;
      }
    }, 20);
  });
  await page.evaluate(() => window.__warsim.hud.setSpeedLevel(99));
  await run(page);
  await page.evaluate(() => { window.__warsim.__running = true; });
  for (let y = 1; y <= years; y++) {
    const w0 = Date.now();
    const f0 = await page.evaluate(() => window.__warsim.view.frames);
    const startTick = await page.evaluate(() => window.__warsim.hud.tick.value);
    await page.waitForFunction((t) => window.__warsim.hud.tick.value >= t + 8760, startTick, { timeout: 1_200_000, polling: 1000 });
    const f1 = await page.evaluate(() => window.__warsim.view.frames);
    const wallS = (Date.now() - w0) / 1000;
    const gaps = await page.evaluate(() => { const g = window.__warsim.__gaps.splice(0); g.sort((a, b) => b - a); return { n: g.length, top: g.slice(0, 8).map((x) => Math.round(x)), over500: g.filter((x) => x > 500).length }; });
    const autoResumes = await page.evaluate(() => window.__warsim.__autoResumes);
    out.years.push({ y, autoResumes, wallS, fps: +((f1 - f0) / wallS).toFixed(1), gaps });
    await shot(page, `${tag}_2_year${y}.png`);
    save(`c8_l_${seed}.json`, { ...out, errors });
  }
  await page.evaluate(() => { window.__warsim.__running = false; });
  await pause(page);
  await lookAt(page, 1024, 420, 12000);
  await shot(page, `${tag}_3_world_end.png`);
} catch (e) {
  out.fatal = String(e?.stack ?? e);
}
out.errors = errors;
save(`c8_l_${seed}.json`, out);
await browser.close();
console.log(JSON.stringify(out));
