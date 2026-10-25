// Critic run 14, session V (new): (A) the Large map (size=L): boot, 60 s at Max, frame rate, views;
// (B) the random world with 200 nations: boot, one year; (C) autosave and Continue: play at Max, Main menu,
// Continue from the title: same tick and same hash?
// Usage: node critic/scripts/c14_v_explore.mjs <A|B|C>
import { launch, BASE, shot, save, lookAt, CELLS, settle } from './c14_lib.mjs';
const part = process.argv[2] ?? 'A';
const out = { part };
const { browser, page, errors } = await launch();
const ready = () => page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim.hud.stats.value !== null, null, { timeout: 300_000 });
const status = () => page.evaluate(async () => { const w = window.__warsim; const h = await w.sim.hash(); return { tick: h.tick, hash: (h.hash >>> 0).toString(16), frames: w.view.frames, nations: w.hud.stats.value?.nations?.length ?? null, date: document.querySelector('[data-testid=bottombar]')?.innerText.match(/\d+ \w+ \d{4}/)?.[0] ?? null }; });
const maxFor = async (ms) => {
  const a = await status();
  const t0 = Date.now();
  await page.evaluate(() => { const w = window.__warsim; w.hud.setSpeedLevel(99); if (w.hud.paused.value) w.hud.togglePause(); });
  await page.waitForTimeout(ms);
  await page.evaluate(() => { const w = window.__warsim; if (!w.hud.paused.value) w.hud.togglePause(); });
  const b = await status();
  return { from: a, to: b, wallS: (Date.now() - t0) / 1000, gameDays: +((b.tick - a.tick) / 24).toFixed(1), fps: +((b.frames - a.frames) / ((Date.now() - t0) / 1000)).toFixed(1) };
};
try {
  if (part === 'A') {
    const t0 = Date.now();
    await page.goto(`${BASE}/?scenario=1938&paused=1&seed=3001&size=L`);
    await ready();
    out.bootS = (Date.now() - t0) / 1000;
    out.start = await status();
    await shot(page, 'c14v_A_large_boot.png');
    out.max60 = await maxFor(60_000);
    await page.evaluate(() => { try { window.__warsim.settings.nukePause.value = false; } catch {} });
    await page.evaluate(() => window.__warsim.view.controller.set({ cx: window.__warsim.sim.mapLayers.w * 0.55, cy: window.__warsim.sim.mapLayers.h * 0.22, scale: 1 }));
    await page.waitForTimeout(800);
    out.cam = await page.evaluate(() => ({ m: window.__warsim.view.metresPerPx, w: window.__warsim.sim.mapLayers.w, h: window.__warsim.sim.mapLayers.h }));
    await shot(page, 'c14v_A_large_after60s.png');
    // Europe at 3,000 and 250 m/px on the first engaged formation
    const eng = await page.evaluate(async () => { const v = window.__warsim.view; const s = await window.__warsim.sim.inspect(true); return s.formations.filter((f) => v.formationEngaged(f.id) && !v.formationAfloat(f.id)).map((f) => ({ x: f.x, y: f.y, n: f.nation })); });
    out.engaged = eng.length;
    if (eng.length) { await lookAt(page, eng[0].x, eng[0].y, 3000); await shot(page, 'c14v_A_large_eng_3000m.png'); await lookAt(page, eng[0].x, eng[0].y, 25); await shot(page, 'c14v_A_large_eng_25m.png'); }
  } else if (part === 'B') {
    const t0 = Date.now();
    await page.goto(`${BASE}/?scenario=random&paused=1&seed=4003&nations=200`);
    await ready();
    out.bootS = (Date.now() - t0) / 1000;
    out.start = await status();
    await shot(page, 'c14v_B_random200_boot.png');
    out.max60 = await maxFor(60_000);
    await shot(page, 'c14v_B_random200_after60s.png');
    out.ticker = await page.evaluate(() => document.body.innerText.split('\n').filter((l) => /19\d\d /.test(l)).slice(-8));
  } else {
    await page.goto(`${BASE}/?scenario=1938&paused=1&seed=5007`);
    await ready();
    await page.evaluate(() => { try { window.__warsim.settings.nukePause.value = false; } catch {} });
    out.max = await maxFor(70_000);
    out.before = await status();
    await shot(page, 'c14v_C_before_menu.png');
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.waitForTimeout(400);
    await page.getByRole('button', { name: 'Main menu', exact: true }).click();
    await page.waitForSelector('[data-testid=title-screen][data-save=found]', { timeout: 60_000 }).catch(() => {});
    await page.waitForTimeout(1500);
    out.title = await page.evaluate(() => ({ save: document.querySelector('[data-testid=title-screen]')?.dataset.save, date: document.querySelector('[data-testid=title-save-date]')?.innerText ?? null }));
    await shot(page, 'c14v_C_title.png');
    const t0 = Date.now();
    await page.getByTestId('title-continue').click();
    await ready();
    await page.waitForTimeout(2000);
    out.continueS = (Date.now() - t0) / 1000;
    out.after = await status();
    out.url = page.url();
    await shot(page, 'c14v_C_after_continue.png');
    // Is it the same world? step both to the same tick is impossible here; compare tick and hash directly.
    out.same = out.after.tick === out.before.tick && out.after.hash === out.before.hash;
  }
} catch (e) { out.fatal = String(e?.stack ?? e); }
out.errors = errors;
save(`c14_v_${part}.json`, out);
await browser.close();
console.log(JSON.stringify(out));
