// Critic run 10, session D: (1) an armour fight watched 45 s at T3 at Speed x1 and x2, wrecks counted;
// (2) a sea battle found by the ticker, its row clicked, then watched; ships at T3.
// Usage: node critic/scripts/c10_d_naval_wrecks.mjs <seed>
import { launch, open1938, lookAt, shot, save, hours, CELLS, settle } from './c10_lib.mjs';

const seed = Number(process.argv[2] ?? 3929);
const tag = `c10d_${seed}`;
const T = CELLS.tags;
const out = { seed, wreckWatch: [], views: [] };
const { browser, page, errors } = await launch();
const live = async (ms, lvl = 0) => {
  await page.evaluate((l) => { window.__warsim.hud.setSpeedLevel(l); if (window.__warsim.hud.paused.value) window.__warsim.hud.togglePause(); }, lvl);
  await page.waitForTimeout(ms);
};
const stop = async () => page.evaluate(() => { if (!window.__warsim.hud.paused.value) window.__warsim.hud.togglePause(); });
const probe = () => page.evaluate(() => { const v = window.__warsim.view; return { el: v.elementCount, ind: v.individualCount, wrecks: v.wrecks?.count ?? null, contact: v.contactLinesShown?.length ?? null, mpp: v.metresPerPx, date: String(window.__warsim.hud.date?.() ?? '') }; });
try {
  await open1938(page, seed);
  await page.evaluate(({ a, d }) => { window.__warsim.sim.command({ kind: 'declareWar', attacker: a, defender: d }); }, { a: T.GER, d: T.POL });
  await page.evaluate(({ a, d }) => { window.__warsim.sim.command({ kind: 'declareWar', attacker: a, defender: d }); }, { a: T.GER, d: T.ENG });
  let arm = [];
  for (let d = 0; d < 12 && arm.length < 1; d++) {
    await hours(page, 24);
    arm = await page.evaluate((n) => {
      const v = window.__warsim.view;
      return v.formationsOf(n).map((f) => ({ f, t: v.formationTitle(f), pos: v.formationPos(f), e: v.formationEngaged(f) })).filter((x) => x.e && /Armoured/.test(JSON.stringify(x.t)));
    }, T.GER);
    out.armDay = d + 1;
  }
  out.arm = arm.slice(0, 2);
  if (arm[0]) {
    for (const [lvl, m] of [[0, 25], [1, 25], [2, 80]]) {
      for (let i = 0; i < 9; i++) {
        const pos = await page.evaluate((f) => window.__warsim.view.formationPos(f), arm[0].f);
        if (!pos) break;
        await lookAt(page, pos[0], pos[1], m, false);
        await live(5000, lvl);
        out.wreckWatch.push({ lvl, m, i, ...(await probe()) });
        if (i % 4 === 0) await shot(page, `${tag}_arm_lvl${lvl}_${m}m_${i}.png`);
      }
      await stop();
    }
  }
  // Sea battle
  let sb = [];
  for (let d = 0; d < 25 && sb.length === 0; d++) {
    await hours(page, 24);
    sb = await page.evaluate(() => window.__warsim.hud.seaBattles.value.map((b) => JSON.parse(JSON.stringify(b))));
    out.seaDay = d + 1;
  }
  out.seaBattles = sb.slice(0, 4);
  const row = page.getByText(/Sea battle:/).first();
  if (await row.count()) {
    await row.click();
    await page.waitForTimeout(2500);
    await settle(page);
    out.rowCam = await page.evaluate(() => { const v = window.__warsim.view; const c = v.controller.cam; return { cx: c.cx, cy: c.cy, mpp: v.metresPerPx }; });
    await shot(page, `${tag}_sea_00_row_clicked.png`);
    for (let i = 0; i < 3; i++) {
      await live(2500, 0);
      await shot(page, `${tag}_sea_01_row_live_${i}.png`);
    }
    await stop();
    const c = out.rowCam;
    for (const m of [150, 40, 15]) {
      await lookAt(page, c.cx, c.cy, m);
      await live(2500, 0);
      out.views.push({ m, ...(await probe()) });
      await shot(page, `${tag}_sea_1_${String(m).padStart(4, '0')}m.png`);
      await stop();
    }
  }
} catch (e) {
  out.fatal = String(e?.stack ?? e);
}
out.errors = errors;
save(`c10_d_${seed}.json`, out);
await browser.close();
console.log(JSON.stringify({ fatal: out.fatal, errors: errors.length, armDay: out.armDay, ww: out.wreckWatch, seaDay: out.seaDay, sb: out.seaBattles, rowCam: out.rowCam, views: out.views }));
