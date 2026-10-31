// Critic run 21, session LW: a new seed watched in the page at Max for 10 years (1600x900). Each year: the wall time
// of the year, frames drawn, the longest gap between frames, a world shot, the ticker's last rows and the war chips.
// At year 10: a zoom series (30000, 3500, 800, 250, 25 m/px) over the largest land fight.
// Usage: node critic/scripts/c21_long_watch.mjs <seed> [years]
import { launch, open1938, shot, save, lookAt, CELLS } from './c21_lib.mjs';
const seed = Number(process.argv[2] ?? 8243);
const years = Number(process.argv[3] ?? 10);
const out = { seed, years: [] };
const { browser, page, errors } = await launch();
try {
  await open1938(page, seed);
  await page.evaluate(() => { try { window.__warsim.settings.nukePause.value = false; } catch {} });
  await lookAt(page, CELLS.berlin[0], CELLS.berlin[1], 30000);
  await page.evaluate(() => {
    window.__lw = { gaps: [], last: performance.now(), frames: 0 };
    const f = (t) => { const w = window.__lw; w.gaps.push(t - w.last); w.last = t; w.frames++; requestAnimationFrame(f); };
    requestAnimationFrame(f);
    window.__warsim.hud.setSpeedLevel(99);
  });
  for (let y = 1; y <= years; y++) {
    const tk = await page.evaluate(() => window.__warsim.hud.tick.value);
    await page.evaluate(() => { window.__lw.gaps = []; window.__lw.frames = 0; if (window.__warsim.hud.paused.value) window.__warsim.hud.togglePause(); });
    const w0 = Date.now();
    await page.waitForFunction((t) => window.__warsim.hud.tick.value >= t + 8760, tk, { timeout: 900_000, polling: 250 });
    const wall = (Date.now() - w0) / 1000;
    await page.evaluate(() => { if (!window.__warsim.hud.paused.value) window.__warsim.hud.togglePause(); });
    const s = await page.evaluate(() => {
      const g = window.__lw.gaps.slice().sort((a, b) => a - b);
      return {
        frames: window.__lw.frames,
        maxGap: Math.round(g[g.length - 1] ?? 0),
        p99Gap: Math.round(g[Math.floor(g.length * 0.99)] ?? 0),
        over500: g.filter((x) => x > 500).length,
        ticker: [...document.querySelectorAll('[data-testid=ticker] > *')].map((e) => e.innerText.replace(/\n/g, ' ')).slice(-4),
        chips: [...document.querySelectorAll('[data-testid=war-banner]')].map((c) => c.innerText.replace(/\n/g, ' ')),
        date: document.querySelector('[data-testid=bottombar]')?.innerText.match(/\d+ \w+ \d{4}/)?.[0] ?? null,
        nations: window.__warsim.hud.stats.value?.nations?.length ?? null,
      };
    });
    s.year = y; s.wallS = wall; s.fps = +(s.frames / wall).toFixed(1);
    s.shot = await shot(page, `c21lw_${seed}_y${String(y).padStart(2, '0')}_world.png`);
    out.years.push(s);
    save(`c21_lw_${seed}.json`, { ...out, errors });
    console.log(y, wall, s.fps, s.maxGap, s.chips.length);
  }
  // Largest land fight: the engaged land formation stack with most engaged neighbours.
  const at = await page.evaluate(async () => {
    const v = window.__warsim.view; const st = await window.__warsim.sim.inspect(true);
    const eng = st.formations.filter((f) => !v.formationAfloat(f.id) && v.formationEngaged(f.id)).map((f) => v.formationPos(f.id)).filter(Boolean);
    let best = null, bn = -1;
    for (const p of eng) { const n = eng.filter((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < 3).length; if (n > bn) { bn = n; best = p; } }
    return { best, bn, engaged: eng.length };
  });
  out.fight = at;
  if (at.best) for (const m of [30000, 3500, 800, 250, 25]) {
    await lookAt(page, at.best[0], at.best[1], m);
    await page.waitForTimeout(600);
    await shot(page, `c21lw_${seed}_zoom_${String(m).padStart(5, '0')}.png`);
  }
} catch (e) { out.fatal = String(e?.stack ?? e); }
out.errors = errors;
save(`c21_lw_${seed}.json`, out);
await browser.close();
console.log(out.fatal ?? 'ok', errors.slice(0, 5));
