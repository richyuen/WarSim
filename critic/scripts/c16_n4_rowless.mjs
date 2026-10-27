// Critic run 12, session N4: seed 8693, Japan at war with the USA (as c16_n_seabattles): at hour 330 a sea
// battle with no pair (span ~10 cells): its ticker row's text, a click on it, what the camera shows, 4 s live.
import { launch, open1938, shot, save, CELLS } from './c16_lib.mjs';

const T = CELLS.tags;
const out = {};
const { browser, page, errors } = await launch();
try {
  await open1938(page, 8693);
  await page.evaluate(({ a, d }) => window.__warsim.sim.command({ kind: 'declareWar', attacker: a, defender: d }), { a: T.JAP, d: T.USA });
  for (let h = 6; h <= 330; h += 6) {
    await page.evaluate(async () => { const { sim, view } = window.__warsim; const t = (await sim.step(6)).tick; await new Promise((d) => { const w = () => (view.lastTick >= t ? d() : setTimeout(w, 5)); w(); }); });
  }
  out.battles = await page.evaluate(() => JSON.parse(JSON.stringify(window.__warsim.view.seaBattles())));
  out.rowTexts = await page.evaluate(() => [...document.querySelectorAll('[data-testid=sea-battle-row]')].map((r) => r.innerText));
  await page.getByTestId('sea-battle-row').first().click();
  await page.waitForTimeout(1500);
  out.cam = await page.evaluate(() => { const v = window.__warsim.view; const c = v.controller.cam; return { cx: c.cx, cy: c.cy, mpp: v.metresPerPx }; });
  await shot(page, 'c16n4_8693_rowless_clicked.png');
  await page.evaluate(() => { window.__warsim.hud.setSpeedLevel(0); if (window.__warsim.hud.paused.value) window.__warsim.hud.togglePause(); });
  await page.waitForTimeout(4000);
  await page.evaluate(() => { if (!window.__warsim.hud.paused.value) window.__warsim.hud.togglePause(); });
  await shot(page, 'c16n4_8693_rowless_live4s.png');
  out.sorties = await page.evaluate(() => window.__warsim.view.sortieMarks?.length ?? null);
} catch (e) {
  out.fatal = String(e?.stack ?? e);
}
out.errors = errors;
save('c16_n4_8693.json', out);
await browser.close();
console.log(JSON.stringify(out).slice(0, 3000));
