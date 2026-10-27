// Critic run 16, session FP (new): a fleet in a sea battle: its panel, and whether it has a way to the fight (PLAN 7.126
// filed by the builder). Steps hour by hour from the 1938 start until a fleet is engaged; opens its panel by
// hud.selectFormation, then the same for an engaged land formation. Usage: node critic/scripts/c16_fp_fleetpanel.mjs <seed>
import { launch, open1938, shot, save, lookAt, hours } from './c16_lib.mjs';
const seed = Number(process.argv[2] ?? 4877);
const out = { seed, found: [] };
const { browser, page, errors } = await launch();
try {
  await open1938(page, seed);
  for (let h = 0; h < 24 * 20 && out.found.length < 2; h += 2) {
    await hours(page, 2);
    const f = await page.evaluate(async () => {
      const v = window.__warsim.view; const st = await window.__warsim.sim.inspect(true);
      const fl = st.formations.find((x) => v.formationAfloat(x.id) && v.formationEngaged(x.id));
      return fl ? { id: fl.id, x: fl.x, y: fl.y, nation: fl.nation, tick: window.__warsim.view.lastTick } : null;
    });
    if (!f || out.found.some((g) => g.id === f.id)) continue;
    await page.evaluate((id) => window.__warsim.hud.selectFormation(id), f.id);
    await lookAt(page, f.x, f.y, 200);
    await page.waitForTimeout(600);
    f.panel = await page.evaluate(() => document.querySelector('[data-testid=formation-panel]')?.innerText ?? null);
    f.fightButton = await page.locator('[data-testid=formation-fight]').count();
    f.shot = await shot(page, `c16fp_${seed}_fleet_${f.id}.png`);
    f.ticker = await page.evaluate(() => [...document.querySelectorAll('[data-testid=ticker] *')].map((e) => e.innerText).slice(-4));
    out.found.push(f);
  }
  const land = await page.evaluate(async () => {
    const v = window.__warsim.view; const st = await window.__warsim.sim.inspect(true);
    const l = st.formations.find((x) => !v.formationAfloat(x.id) && v.formationEngaged(x.id));
    return l ? { id: l.id, x: l.x, y: l.y } : null;
  });
  if (land) {
    await page.evaluate((id) => window.__warsim.hud.selectFormation(id), land.id);
    await lookAt(page, land.x, land.y, 200);
    land.panel = await page.evaluate(() => document.querySelector('[data-testid=formation-panel]')?.innerText ?? null);
    land.fightButton = await page.locator('[data-testid=formation-fight]').count();
    land.shot = await shot(page, `c16fp_${seed}_land_${land.id}.png`);
    out.land = land;
  }
} catch (e) { out.fatal = String(e?.stack ?? e); }
out.errors = errors;
save(`c16_fp_${seed}.json`, out);
await browser.close();
console.log(JSON.stringify({ fleets: out.found.map((f) => [f.id, f.fightButton, (f.panel ?? '').slice(0, 200)]), land: out.land && [out.land.id, out.land.fightButton], fatal: out.fatal }));
