// Critic run 14, session V2 (new): the Large map (size=L) against the Medium one, same seed: Germany declares war on
// Poland, 5 days stepped; the first engaged German formation viewed at 3000, 250, 80, 25 m/px: what the view draws
// (elements, figures, contact lines) and where its elements are against the screen's centre.
// Usage: node critic/scripts/c14_v2_large.mjs <size M|L> <seed>
import { launch, BASE, shot, save, lookAt, CELLS, hours } from './c14_lib.mjs';
const size = process.argv[2] ?? 'L';
const seed = Number(process.argv[3] ?? 3001);
const T = CELLS.tags;
const out = { size, seed, views: [] };
const { browser, page, errors } = await launch();
try {
  await page.goto(`${BASE}/?scenario=1938&paused=1&seed=${seed}&size=${size}`);
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim.hud.stats.value !== null && window.__warsim.sim.mapLayers !== null, null, { timeout: 300_000 });
  out.map = await page.evaluate(() => ({ w: window.__warsim.sim.mapLayers.w, h: window.__warsim.sim.mapLayers.h }));
  await page.evaluate(({ a, d }) => window.__warsim.sim.command({ kind: 'declareWar', attacker: a, defender: d }), { a: T.GER, d: T.POL });
  await hours(page, 120);
  const fs = await page.evaluate(async (ger) => { const v = window.__warsim.view; const s = await window.__warsim.sim.inspect(true); return s.formations.filter((f) => f.nation === ger && v.formationEngaged(f.id) && !v.formationAfloat(f.id)).map((f) => ({ id: f.id, x: f.x, y: f.y })); }, T.GER);
  out.engagedGer = fs.length;
  const f = fs[0];
  out.f = f;
  if (f) {
    for (const m of [3000, 250, 80, 25]) {
      await lookAt(page, f.x, f.y, m);
      const p = await page.evaluate(() => { const v = window.__warsim.view; return { el: v.elementCount ?? null, ind: v.individualCount ?? null, contact: v.contactLinesShown?.length ?? null, mpp: v.metresPerPx, cam: { ...v.controller.cam } }; });
      out.views.push({ m, ...p });
      await shot(page, `c14v2_${size}_${seed}_${m}m.png`);
    }
  }
} catch (e) { out.fatal = String(e?.stack ?? e); }
out.errors = errors;
save(`c14_v2_${size}_${seed}.json`, out);
await browser.close();
console.log(JSON.stringify(out));
