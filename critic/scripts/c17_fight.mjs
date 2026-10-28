// Critic run 17, session FT (new, ADR-743's camera past T3): land formations in contact, their panel's "To its fight"
// pressed; the zoom the camera picks, both blocks on the screen, a shot. Usage: node critic/scripts/c17_fight.mjs <seed> <day>
import { launch, open1938, shot, save, hours } from './c17_lib.mjs';
const seed = Number(process.argv[2] ?? 5381); const day = Number(process.argv[3] ?? 21); const only = (process.argv[4] ?? '').split(',').filter(Boolean).map(Number);
const out = { seed, day, found: [] };
const { browser, page, errors } = await launch();
try {
  await open1938(page, seed);
  await page.evaluate(() => { try { window.__warsim.settings.nukePause.value = false; } catch {} });
  if (process.env.DECLARE) { const [a, d] = process.env.DECLARE.split(',').map(Number); await page.evaluate(({ a, d }) => window.__warsim.sim.command({ kind: 'declareWar', attacker: a, defender: d }), { a, d }); }
  await hours(page, day * 24);
  const cands = await page.evaluate(async () => { const v = window.__warsim.view; const st = await window.__warsim.sim.inspect(true); return st.formations.filter((f) => !v.formationAfloat(f.id) && v.formationEngaged(f.id)).map((f) => ({ id: f.id, nation: f.nation, x: f.x, y: f.y })); });
  out.engaged = cands.length;
  const pick = only.length ? cands.filter((c) => only.includes(c.id)) : cands.filter((_, i) => i % Math.max(1, Math.floor(cands.length / 8)) === 0).slice(0, 8);
  for (const f of pick) {
    await page.evaluate((id) => window.__warsim.hud.selectFormation(id), f.id);
    await page.waitForTimeout(600);
    f.button = await page.locator('[data-testid=formation-fight]').count();
    if (!f.button) { out.found.push(f); continue; }
    await page.locator('[data-testid=formation-fight]').first().click();
    await page.waitForTimeout(2500);
    f.after = await page.evaluate(async (me) => { const v = window.__warsim.view; const c = v.controller.cam; const st = await window.__warsim.sim.inspect(true); const W = innerWidth, H = innerHeight; const self = st.formations.find((x) => x.id === me); const sx = (self.x - c.cx) * c.scale + W / 2, sy = (self.y - c.cy) * c.scale + H / 2; const enemies = st.formations.filter((x) => x.nation !== self.nation && !v.formationAfloat(x.id) && v.formationEngaged(x.id)).map((x) => [(x.x - c.cx) * c.scale + W / 2, (x.y - c.cy) * c.scale + H / 2]).filter(([a, b]) => a >= 0 && a <= W && b >= 0 && b <= H).length; return { mpp: +v.metresPerPx.toFixed(1), selfOn: sx >= 0 && sx <= W && sy >= 0 && sy <= H, enemiesOn: enemies }; }, f.id);
    f.shot = await shot(page, `c17ft_${seed}_d${day}_${f.id}.png`);
    out.found.push(f);
    await page.evaluate(() => window.__warsim.hud.selectFormation?.(0));
  }
} catch (e) { out.fatal = String(e?.stack ?? e); }
out.errors = errors; save(`c17_ft_${seed}_d${day}${only.length ? '_' + only.join('-') : ''}.json`, out); await browser.close();
console.log(JSON.stringify({ engaged: out.engaged, f: out.found.map((f) => [f.id, f.nation, f.button, f.after?.mpp, f.after?.selfOn, f.after?.enemiesOn]), fatal: out.fatal }));
