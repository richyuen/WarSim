// Critic run 7, session G: the map sizes S and L (PLAN 7.1b): boot, Berlin at the tier ladder, a year at Max.
import { launch, BASE, shot, save, lookAt, run, pause } from './c7_lib.mjs';

const size = process.argv[2] ?? 'L';
const seed = Number(process.argv[3] ?? 3119);
const years = Number(process.argv[4] ?? 1);
const tag = `c7g_${size}_${seed}`;
const out = { size, seed, views: [], years: [] };
const { browser, page, errors } = await launch();
try {
  const t0 = Date.now();
  await page.goto(`${BASE}/?scenario=1938&paused=1&seed=${seed}&size=${size}`);
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0, null, { timeout: 300_000 });
  await page.waitForFunction(() => window.__warsim.hud.stats.value !== null && window.__warsim.sim.mapLayers !== null, null, { timeout: 300_000 });
  out.bootMs = Date.now() - t0;
  const dims = await page.evaluate(() => { const l = window.__warsim.sim.mapLayers; return [l.w ?? l.width, l.h ?? l.height]; });
  out.dims = dims;
  // Berlin by its lon/lat on the Miller projection is awkward; take it from the inspect's cities
  const berlin = await page.evaluate(async () => (await window.__warsim.sim.inspect(true)).cities.find((c) => c.name === 'Berlin'));
  out.berlin = berlin;
  await shot(page, `${tag}_00_boot.png`);
  for (const m of [6000, 1500, 400, 100, 25]) {
    await lookAt(page, berlin.x, berlin.y, m);
    await page.waitForTimeout(400);
    await shot(page, `${tag}_1_berlin_${String(m).padStart(4, '0')}m.png`);
  }
  await lookAt(page, berlin.x, berlin.y, 2500);
  await page.evaluate(() => window.__warsim.hud.setSpeedLevel(99));
  await run(page);
  for (let y = 1; y <= years; y++) {
    const w0 = Date.now();
    const f0 = await page.evaluate(() => window.__warsim.view.frames);
    const startTick = await page.evaluate(() => window.__warsim.hud.tick.value);
    await page.waitForFunction((t) => window.__warsim.hud.tick.value >= t + 8760, startTick, { timeout: 1_200_000, polling: 1000 });
    const f1 = await page.evaluate(() => window.__warsim.view.frames);
    const wallS = (Date.now() - w0) / 1000;
    out.years.push({ y, wallS, fps: +((f1 - f0) / wallS).toFixed(1) });
    await shot(page, `${tag}_2_year${y}.png`);
    save(`c7_g_${size}_${seed}.json`, { ...out, errors });
  }
  await pause(page);
  out.hash = await page.evaluate(async () => (await window.__warsim.sim.hash()));
} catch (e) {
  out.fatal = String(e?.stack ?? e);
}
out.errors = errors;
save(`c7_g_${size}_${seed}.json`, out);
await browser.close();
console.log(JSON.stringify({ fatal: out.fatal, errors: errors.length, boot: out.bootMs, dims: out.dims, years: out.years }));
