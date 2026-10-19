// Critic run 9, session J: a sea battle's ticker row clicked (PLAN 7.10b), then the ships at T3 (7.10a).
// Germany against Britain by God command; hour steps until the ticker shows a sea battle.
// Usage: node critic/scripts/c9_j_seabattle.mjs <seed>
import { launch, open1938, lookAt, shot, save, hours, CELLS, settle } from './c9_lib.mjs';

const seed = Number(process.argv[2] ?? 5591);
const tag = `c9j_${seed}`;
const T = CELLS.tags;
const out = { seed, views: [] };
const { browser, page, errors } = await launch();
const live = async (ms, lvl = 0) => {
  await page.evaluate((l) => { window.__warsim.hud.setSpeedLevel(l); if (window.__warsim.hud.paused.value) window.__warsim.hud.togglePause(); }, lvl);
  await page.waitForTimeout(ms);
};
const stop = async () => page.evaluate(() => { if (!window.__warsim.hud.paused.value) window.__warsim.hud.togglePause(); });
const near = () => page.evaluate(async () => {
  const v = window.__warsim.view;
  const c = v.controller.cam;
  const s = await window.__warsim.sim.inspect(true);
  const halfW = window.innerWidth / 2 / c.scale;
  const halfH = window.innerHeight / 2 / c.scale;
  const ships = s.formations.filter((f) => !f.wing && Math.abs(f.x - c.cx) < halfW && Math.abs(f.y - c.cy) < halfH && /fleet|squadron|flotilla|group|convoy/i.test(JSON.stringify(v.formationTitle(f.id))));
  return { mpp: v.metresPerPx, fires: v.fire?.count ?? null, ships: ships.map((f) => ({ id: f.id, nation: f.nation, t: v.formationTitle(f.id)?.name })) };
});
try {
  await open1938(page, seed);
  await page.evaluate(({ a, d }) => window.__warsim.sim.command({ kind: 'declareWar', attacker: a, defender: d }), { a: T.GER, d: T.ENG });
  let found = false;
  for (let h = 0; h < 24 * 20 && !found; h += 6) {
    await hours(page, 6);
    found = await page.evaluate(() => /Sea battle:/.test(document.body.innerText));
    out.hour = h + 6;
  }
  if (found) {
    await page.getByText(/Sea battle:/).first().click();
    await page.waitForTimeout(2500);
    await settle(page);
    out.row = await near();
    await shot(page, `${tag}_00_row.png`);
    for (let i = 0; i < 3; i++) {
      await live(2000, 0);
      await shot(page, `${tag}_01_row_live_${i}.png`);
    }
    await stop();
    out.rowAfter = await near();
    const c = await page.evaluate(() => { const cc = window.__warsim.view.controller.cam; return [cc.cx, cc.cy]; });
    for (const m of [150, 40, 15]) {
      await lookAt(page, c[0], c[1], m);
      await live(2000, 0);
      out.views.push({ m, ...(await near()) });
      await shot(page, `${tag}_1_${String(m).padStart(4, '0')}m.png`);
      await stop();
    }
  }
} catch (e) {
  out.fatal = String(e?.stack ?? e);
}
out.errors = errors;
save(`c9_j_${seed}.json`, out);
await browser.close();
console.log(JSON.stringify(out));
