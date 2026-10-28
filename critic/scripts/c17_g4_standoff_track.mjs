// Critic run 12, session G4: the editor's North Sea standoff (exported by c17_g_editor.mjs) loaded from the
// title; every German and British fleet within 25 cells of the North Sea point tracked hour by hour for 4 days
// after Germany declares war on the UK; sea battles and the history's sea rows.
import path from 'node:path';
import { launch, BASE, shot, save, lookAt, CELLS } from './c17_lib.mjs';

const T = CELLS.tags;
const [nx, ny] = CELLS.northsea;
const out = { samples: [] };
const { browser, page, errors } = await launch();
const fleets = () => page.evaluate(async ({ T, nx, ny }) => {
  const v = window.__warsim.view;
  const s = await window.__warsim.sim.inspect(true);
  const r = {};
  for (const [k, n] of [['GER', T.GER], ['ENG', T.ENG]]) {
    r[k] = s.formations.filter((x) => x.nation === n && v.formationAfloat(x.id) && Math.hypot(x.x - nx, x.y - ny) < 25).map((x) => [x.id, +(x.x - nx).toFixed(1), +(x.y - ny).toFixed(1), x.strength ?? null]);
  }
  return r;
}, { T, nx, ny });
try {
  const file = path.resolve('critic/c17_critic_standoff.warsim-scenario');
  await page.goto(`${BASE}/`);
  await page.waitForTimeout(2500);
  await page.getByTestId('title-scenario-file').setInputFiles(file);
  await page.waitForTimeout(600);
  await Promise.all([page.waitForURL(/load=scenario/, { timeout: 30_000 }), page.getByTestId('title-file-start').click()]);
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim.hud.stats.value !== null && window.__warsim.sim.mapLayers !== null, null, { timeout: 120_000 });
  await page.waitForTimeout(2000);
  if (!(await page.evaluate(() => window.__warsim.hud.paused.value))) await page.evaluate(() => window.__warsim.hud.togglePause());
  out.t0 = await fleets();
  await lookAt(page, nx + 3, ny, 1500);
  await shot(page, 'c17g4_00_loaded_1500m.png');
  await page.evaluate(({ T }) => window.__warsim.sim.command({ kind: 'declareWar', attacker: T.GER, defender: T.ENG }), { T });
  for (let h = 1; h <= 96; h++) {
    await page.evaluate(async () => { const { sim, view } = window.__warsim; const t = (await sim.step(1)).tick; await new Promise((d) => { const w = () => (view.lastTick >= t ? d() : setTimeout(w, 5)); w(); }); });
    if (h <= 12 || h % 6 === 0) {
      const f = await fleets();
      const sea = await page.evaluate(() => window.__warsim.hud.seaBattles.value.length);
      const rows = await page.evaluate(() => document.querySelectorAll('[data-testid=sea-battle-row]').length);
      out.samples.push({ h, sea, rows, GER: f.GER, ENGn: f.ENG.length });
    }
    if (h === 6 || h === 24 || h === 48) { await lookAt(page, nx + 3, ny, 1500); await shot(page, `c17g4_01_h${h}_1500m.png`); }
  }
  await page.evaluate(() => window.__warsim.hud.toggleHistory());
  await page.waitForTimeout(1200);
  out.history = await page.evaluate(() => document.body.innerText.split('\n').filter((l) => /fought at sea|Sea battle|sunk/.test(l)).slice(0, 12));
} catch (e) {
  out.fatal = String(e?.stack ?? e);
}
out.errors = errors;
save('c17_g4_standoff.json', out);
await browser.close();
console.log(JSON.stringify(out).slice(0, 4000));
