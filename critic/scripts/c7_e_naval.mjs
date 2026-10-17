// Critic run 7, session E: a sea battle found by the ticker, framed by its row, then at T2 and T3.
// Germany against the United Kingdom, declared by the God command.
import { launch, open1938, lookAt, shot, save, hours, CELLS, settle } from './c7_lib.mjs';

const seed = Number(process.argv[2] ?? 9043);
const tag = `c7e_${seed}`;
const T = CELLS.tags;
const out = { seed, views: [] };
const { browser, page, errors } = await launch();
const live = async (ms, lvl = 0) => {
  await page.evaluate((l) => { window.__warsim.hud.setSpeedLevel(l); if (window.__warsim.hud.paused.value) window.__warsim.hud.togglePause(); }, lvl);
  await page.waitForTimeout(ms);
};
const stop = async () => page.evaluate(() => { if (!window.__warsim.hud.paused.value) window.__warsim.hud.togglePause(); });
try {
  await open1938(page, seed);
  await page.evaluate(({ a, d }) => window.__warsim.sim.command({ kind: 'declareWar', attacker: a, defender: d }), { a: T.GER, d: T.ENG });
  let sb = [];
  for (let d = 0; d < 20 && sb.length === 0; d++) {
    await hours(page, 24);
    sb = await page.evaluate(() => window.__warsim.hud.seaBattles.value.map((b) => JSON.parse(JSON.stringify(b))));
    out.day = d + 1;
  }
  out.seaBattles = sb.slice(0, 4);
  // the ticker row
  const row = page.getByText(/Sea battle:/).first();
  if (await row.count()) {
    await row.click();
    await page.waitForTimeout(2500);
    await settle(page);
    out.rowCam = await page.evaluate(() => { const v = window.__warsim.view; const c = v.controller.cam; return { cx: c.cx, cy: c.cy, mpp: v.metresPerPx }; });
    await shot(page, `${tag}_00_row_clicked.png`);
    await live(2500, 0);
    await shot(page, `${tag}_01_row_live.png`);
    await stop();
  }
  const b = sb[0];
  if (b) {
    const x = b.x ?? b.at?.[0];
    const y = b.y ?? b.at?.[1];
    out.at = [x, y];
    for (const m of [2500, 600, 150, 40, 15]) {
      await lookAt(page, x, y, m);
      await live(2000, 0);
      const s = await page.evaluate(() => { const v = window.__warsim.view; return { el: v.elementCount ?? null, ind: v.individualCount ?? null, sorties: v.sortieMarks.length }; });
      out.views.push({ m, ...s });
      await shot(page, `${tag}_1_${String(m).padStart(4, '0')}m.png`);
      await stop();
    }
  }
  // sea control mode
  await page.keyboard.press('9');
  await lookAt(page, CELLS.northsea[0], CELLS.northsea[1], 3000);
  await page.waitForTimeout(800);
  await shot(page, `${tag}_2_seacontrol.png`);
  out.legend = await page.evaluate(() => document.querySelector('.map-legend, [class*=legend]')?.innerText ?? null);
  await page.keyboard.press('1');
  // history rows of the sea
  const hist = await page.evaluate(() => window.__warsim.sim.history());
  out.seaHistory = hist.filter((r) => JSON.stringify(r).match(/sea|ship|fleet|sunk/i)).slice(0, 12);
  out.histCount = hist.length;
} catch (e) {
  out.fatal = String(e?.stack ?? e);
}
out.errors = errors;
save(`c7_e_${seed}.json`, out);
await browser.close();
console.log(JSON.stringify({ fatal: out.fatal, errors: errors.length, day: out.day, sb: out.seaBattles, views: out.views, rowCam: out.rowCam }));
