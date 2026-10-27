// Critic run 16, session FP2 (new, ADR-714): a fleet in a sea battle: press its panel's fight button and judge what
// the view frames: zoom, both sides' fleets on screen, screenshot. Germany declares on Poland and Britain at the
// start to make sea battles in the North Sea and Baltic. Usage: node critic/scripts/c16_fp2_fight.mjs <seed>
import { launch, open1938, shot, save, lookAt, hours, CELLS } from './c16_lib.mjs';
const seed = Number(process.argv[2] ?? 5381);
const T = CELLS.tags;
const out = { seed, found: [] };
const { browser, page, errors } = await launch();
try {
  await open1938(page, seed);
  await page.evaluate(({ a, d }) => window.__warsim.sim.command({ kind: 'declareWar', attacker: a, defender: d }), { a: T.GER, d: T.POL });
  await page.evaluate(({ a, d }) => window.__warsim.sim.command({ kind: 'declareWar', attacker: a, defender: d }), { a: T.GER, d: T.ENG });
  for (let h = 0; h < 24 * 30 && out.found.length < 4; h += 3) {
    await hours(page, 3);
    const f = await page.evaluate(async (seen) => {
      const v = window.__warsim.view; const st = await window.__warsim.sim.inspect(true);
      const fl = st.formations.find((x) => !seen.includes(x.id) && v.formationAfloat(x.id) && v.formationEngaged(x.id));
      return fl ? { id: fl.id, x: fl.x, y: fl.y, nation: fl.nation, t: v.formationTitle(fl.id), tick: v.lastTick } : null;
    }, out.found.map((g) => g.id));
    if (!f) continue;
    await page.evaluate((id) => window.__warsim.hud.selectFormation(id), f.id);
    await page.waitForTimeout(700);
    f.panel = await page.evaluate(() => document.querySelector('[data-testid=formation-panel]')?.innerText ?? null);
    f.fightButton = await page.locator('[data-testid=formation-fight]').count();
    if (f.fightButton) {
      await page.locator('[data-testid=formation-fight]').first().click();
      await page.waitForTimeout(2500);
      f.after = await page.evaluate(async (me) => {
        const v = window.__warsim.view; const c = v.controller.cam; const st = await window.__warsim.sim.inspect(true);
        const W = window.innerWidth, H = window.innerHeight;
        const scr = (x, y) => [(x - c.cx) * c.scale + W / 2, (y - c.cy) * c.scale + H / 2];
        const afloat = st.formations.filter((x) => v.formationAfloat(x.id)).map((x) => { const [sx, sy] = scr(x.x, x.y); return { id: x.id, nation: x.nation, sx: Math.round(sx), sy: Math.round(sy), on: sx >= 0 && sx <= W && sy >= 0 && sy <= H, engaged: v.formationEngaged(x.id) }; });
        return { mpp: v.metresPerPx, me: afloat.find((a) => a.id === me), onScreen: afloat.filter((a) => a.on) };
      }, f.id);
      f.shot = await shot(page, `c16fp2_${seed}_fleet_${f.id}_fight.png`);
    } else f.shot = await shot(page, `c16fp2_${seed}_fleet_${f.id}_nobutton.png`);
    out.found.push(f);
    await page.evaluate(() => window.__warsim.hud.selectFormation?.(0));
  }
} catch (e) { out.fatal = String(e?.stack ?? e); }
out.errors = errors;
save(`c16_fp2_${seed}.json`, out);
await browser.close();
console.log(JSON.stringify({ found: out.found.map((f) => ({ id: f.id, n: f.nation, b: f.fightButton, mpp: f.after?.mpp, me: f.after?.me?.on, other: f.after?.onScreen?.filter((o) => o.nation !== f.nation).length })), fatal: out.fatal }));
