// Critic run 16, session COL (new, ADR-722's "Left"): fleets under way at T2 (120, 60, 47 m/px) after the 13-px hull
// floor: do ships of a column read as separate hulls or one bar? Germany declares on Britain; hours stepped; the
// first moving warship fleets of each side viewed. Usage: node critic/scripts/c16_col_ships.mjs <seed>
import { launch, open1938, shot, save, lookAt, hours, CELLS } from './c16_lib.mjs';
const seed = Number(process.argv[2] ?? 5381);
const T = CELLS.tags;
const out = { seed, views: [] };
const { browser, page, errors } = await launch();
try {
  await open1938(page, seed);
  await page.evaluate(({ a, d }) => window.__warsim.sim.command({ kind: 'declareWar', attacker: a, defender: d }), { a: T.GER, d: T.ENG });
  await hours(page, 30);
  const prev = await page.evaluate(async () => { const st = await window.__warsim.sim.inspect(true); return Object.fromEntries(st.formations.map((f) => [f.id, [f.x, f.y]])); });
  await hours(page, 2);
  const moving = await page.evaluate(async (prev) => {
    const v = window.__warsim.view; const st = await window.__warsim.sim.inspect(true);
    return st.formations.filter((f) => v.formationAfloat(f.id) && prev[f.id] && Math.hypot(f.x - prev[f.id][0], f.y - prev[f.id][1]) > 0.01 && f.elements >= 4)
      .map((f) => ({ id: f.id, nation: f.nation, x: f.x, y: f.y, t: v.formationTitle(f.id).name, el: f.elements }));
  }, prev);
  out.moving = moving.length;
  for (const f of moving.filter((m) => !/Transport|Submarine/.test(m.t)).slice(0, 3)) {
    for (const m of [120, 60, 47]) {
      await lookAt(page, f.x, f.y, m);
      out.views.push({ id: f.id, t: f.t, m, shot: await shot(page, `c16col_${seed}_${f.id}_${m}m.png`) });
    }
  }
} catch (e) { out.fatal = String(e?.stack ?? e); }
out.errors = errors;
save(`c16_col_${seed}.json`, out);
await browser.close();
console.log(JSON.stringify(out).slice(0, 1500));
