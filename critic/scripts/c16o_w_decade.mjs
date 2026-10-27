// Critic run 12, session W: a fresh 1938 world watched for 10 years in the page at Max, as a player:
// per year the wall time, frame rate, longest gaps, the engaged land formations the page itself shows,
// Europe at 3,000 m/px and the world at 12,000 m/px; in years 3, 6 and 10 the busiest front at 250 and
// 25 m/px for 3 s live.
// Usage: node critic/scripts/c16_w_decade.mjs <seed> <years>
import { launch, open1938, shot, save, lookAt, run, pause, CELLS } from './c16o_lib.mjs';

const seed = Number(process.argv[2] ?? 3301);
const years = Number(process.argv[3] ?? 10);
const tag = `c16ow_${seed}`;
const out = { seed, years: [] };
const { browser, page, errors } = await launch();
const engaged = () => page.evaluate(async () => {
  const v = window.__warsim.view;
  const s = await window.__warsim.sim.inspect(true);
  const land = s.formations.filter((f) => !v.formationAfloat(f.id));
  return { land: land.length, eng: land.filter((f) => v.formationEngaged(f.id)).map((f) => ({ id: f.id, n: f.nation, x: f.x, y: f.y })) };
});
const probe = () => page.evaluate(() => {
  const v = window.__warsim.view;
  return { el: v.elementCount ?? null, ind: v.individualCount ?? null, sorties: v.sortieMarks?.length ?? null, contact: v.contactLinesShown?.length ?? null, mpp: Math.round(v.metresPerPx) };
});
try {
  await open1938(page, seed);
  await page.evaluate(() => { try { window.__warsim.settings.nukePause.value = false; } catch {} });
  await page.evaluate(() => {
    const w = window.__warsim;
    w.__gaps = [];
    let lastTick = w.hud.tick.value;
    let lastT = performance.now();
    w.__autoResumes = 0;
    setInterval(() => {
      if (w.hud.paused.value && w.__running) { w.__autoResumes++; w.hud.togglePause(); }
      const t = w.hud.tick.value;
      const now = performance.now();
      if (t !== lastTick) { w.__gaps.push(now - lastT); lastTick = t; lastT = now; }
    }, 20);
  });
  await lookAt(page, CELLS.berlin[0], CELLS.berlin[1], 3000);
  for (let y = 1; y <= years; y++) {
    await page.evaluate(() => window.__warsim.hud.setSpeedLevel(99));
    await run(page);
    await page.evaluate(() => { window.__warsim.__running = true; });
    const w0 = Date.now();
    const f0 = await page.evaluate(() => window.__warsim.view.frames);
    const startTick = await page.evaluate(() => window.__warsim.hud.tick.value);
    const target = Math.ceil((startTick + 1) / 8760) * 8760;
    await page.waitForFunction((t) => window.__warsim.hud.tick.value >= t, target, { timeout: 1_200_000, polling: 500 });
    const f1 = await page.evaluate(() => window.__warsim.view.frames);
    await page.evaluate(() => { window.__warsim.__running = false; });
    await pause(page);
    const wallS = (Date.now() - w0) / 1000;
    const gaps = await page.evaluate(() => { const g = window.__warsim.__gaps.splice(0); g.sort((a, b) => b - a); return { n: g.length, top: g.slice(0, 5).map((x) => Math.round(x)), over500: g.filter((x) => x > 500).length }; });
    const e = await engaged();
    const chips = await page.evaluate(() => [...document.querySelectorAll('[class*=chip]')].map((c) => c.innerText.replace(/\s+/g, ' ')).slice(0, 12));
    const row = { y, wallS, fps: +((f1 - f0) / wallS).toFixed(1), gaps, land: e.land, engaged: e.eng.length, chips, autoResumes: await page.evaluate(() => window.__warsim.__autoResumes) };
    await lookAt(page, CELLS.berlin[0], CELLS.berlin[1], 3000);
    await shot(page, `${tag}_y${String(y).padStart(2, '0')}_europe.png`);
    if (y === 1 || y === 5 || y === years) { await lookAt(page, 1024, 420, 12000); await shot(page, `${tag}_y${String(y).padStart(2, '0')}_world.png`); }
    if ([3, 6, years].includes(y) && e.eng.length) {
      // the busiest place: the engaged formation with most engaged within 20 cells
      let best = e.eng[0], bn = 0;
      for (const a of e.eng) { const n = e.eng.filter((b) => Math.hypot(a.x - b.x, a.y - b.y) < 20).length; if (n > bn) { bn = n; best = a; } }
      row.front = { ...best, near: bn, views: [] };
      for (const m of [250, 25]) {
        const pos = await page.evaluate((id) => window.__warsim.view.formationPos(id), best.id);
        const [cx, cy] = pos ?? [best.x, best.y];
        await lookAt(page, cx, cy, m);
        await page.evaluate(() => { window.__warsim.hud.setSpeedLevel(0); if (window.__warsim.hud.paused.value) window.__warsim.hud.togglePause(); });
        await page.waitForTimeout(3000);
        await pause(page);
        row.front.views.push(await probe());
        await shot(page, `${tag}_y${String(y).padStart(2, '0')}_front_${String(m).padStart(4, '0')}m.png`);
      }
      await lookAt(page, CELLS.berlin[0], CELLS.berlin[1], 3000);
    }
    out.years.push(row);
    save(`c16o_w_${seed}.json`, { ...out, errors });
    console.log(JSON.stringify(row).slice(0, 400));
  }
  out.hash = await page.evaluate(async () => { const h = await window.__warsim.sim.hash(); return { tick: h.tick, hash: (h.hash >>> 0).toString(16) }; });
  await page.evaluate(() => window.__warsim.hud.toggleHistory());
  await page.waitForTimeout(1500);
  out.historyCount = await page.evaluate(() => (document.body.innerText.match(/(\d[\d,]*) of (\d[\d,]*) events/) ?? [null])[0]);
  await shot(page, `${tag}_z_history.png`);
  await page.evaluate(() => window.__warsim.hud.toggleHistory());
  await page.evaluate(() => window.__warsim.hud.toggleCharts());
  await page.waitForTimeout(1500);
  await shot(page, `${tag}_z_charts.png`);
} catch (e) {
  out.fatal = String(e?.stack ?? e);
}
out.errors = errors;
save(`c16o_w_${seed}.json`, out);
await browser.close();
console.log('done', out.fatal ?? '');
