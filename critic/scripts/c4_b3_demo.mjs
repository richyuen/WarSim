// Session B3: the builder's own naval demo set-up (UK declares on Italy), on its seed 4604 and on the critic's seed 6131,
// with its method: hour by hour until a sea battle, then T2/T3 by turns, the busiest of 15 frames each hour.
import { launch, open1938, lookAt, shot, save, hours } from './c4_lib.mjs';
const seed = Number(process.argv[2] ?? 4604);
const out = { seed, hoursSeen: [] };
const { browser, page, errors } = await launch(1400, 800);
try {
  await open1938(page, seed);
  const ids = await page.evaluate(() => { const ns = window.__warsim.hud.stats.value.nations; const f = (n) => ns.find((x) => x.name === n)?.id; return { ENG: f('nation.ENG'), ITA: f('nation.ITA') }; });
  await page.evaluate(({ a, d }) => window.__warsim.sim.command({ kind: 'declareWar', attacker: a, defender: d }), { a: ids.ENG, d: ids.ITA });
  let fleet = -1, h = 0;
  for (; h < 40 * 24 && fleet < 0; h++) {
    await hours(page, 1);
    fleet = await page.evaluate(() => { const v = window.__warsim.view; for (const f of v.formationIds()) if (v.formationAfloat(f) && v.formationEngaged(f)) return f; return -1; });
  }
  out.firstHour = h; out.fleet = fleet;
  let best = { 40: 0, 15: 0 };
  for (let k = 0; k < 16; k++) {
    const pos = await page.evaluate((f) => window.__warsim.view.formationPos(f), fleet);
    if (!pos) break;
    const m = k % 2 ? 15 : 40;
    await lookAt(page, pos[0], pos[1], m);
    await hours(page, 1);
    let most = 0, shotsMax = 0;
    for (let s = 0; s < 15; s++) {
      const n = await page.evaluate(() => { const v = window.__warsim.view; return [v.fire.tracers.length + v.fire.flashes + v.fire.impacts, v.fire.shots.length, v.elementCount, v.wrecks.shown.length, v.formationEngaged]; });
      if (n[0] > most) { most = n[0]; if (n[0] > best[m]) { best[m] = n[0]; await shot(page, `c4b3_s${seed}_${m}m_best.png`); } }
      shotsMax = Math.max(shotsMax, n[1]);
      await page.waitForTimeout(50);
    }
    const eng = await page.evaluate((f) => window.__warsim.view.formationEngaged(f), fleet);
    out.hoursSeen.push({ k, m, most, shotsMax, engaged: eng });
  }
  out.best = best;
} catch (e) { out.fatal = String(e?.stack ?? e); }
out.errors = errors.filter((e) => !e.includes('GPU stall'));
save(`c4_b3_${seed}.json`, out);
await browser.close();
console.log(JSON.stringify(out));
