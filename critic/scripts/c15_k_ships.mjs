// Critic run 12, session K: ships by class at T3 (15 and 30 m/px), seed 5591 hour 42 of Germany's war on Britain.
import { launch, open1938, lookAt, shot, save, hours, CELLS } from './c15_lib.mjs';
const T = CELLS.tags;
const out = { views: [] };
const { browser, page, errors } = await launch();
try {
  await open1938(page, 5591);
  await page.evaluate(({ a, d }) => window.__warsim.sim.command({ kind: 'declareWar', attacker: a, defender: d }), { a: T.GER, d: T.ENG });
  await hours(page, 42);
  for (const id of [1199, 1063, 1224, 1201]) {
    const p = await page.evaluate((f) => window.__warsim.view.formationPos(f), id);
    if (!p) continue;
    for (const m of [30, 15]) {
      await lookAt(page, p[0], p[1], m);
      await page.evaluate(() => { window.__warsim.hud.setSpeedLevel(0); if (window.__warsim.hud.paused.value) window.__warsim.hud.togglePause(); });
      await page.waitForTimeout(1500);
      await page.evaluate(() => { if (!window.__warsim.hud.paused.value) window.__warsim.hud.togglePause(); });
      out.views.push({ id, m, t: await page.evaluate((f) => window.__warsim.view.formationTitle(f), id) });
      await shot(page, `c15k_ship_${id}_${m}m.png`);
    }
  }
} catch (e) { out.fatal = String(e?.stack ?? e); }
out.errors = errors;
save('c15_k_ships.json', out);
await browser.close();
console.log(JSON.stringify(out));
