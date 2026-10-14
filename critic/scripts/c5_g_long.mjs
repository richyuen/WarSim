// Session G (run 5): an AI world watched at Max for 12 simulated years (or 30 min): speed, map each year,
// the ticker, the history, the charts and ranking at the end, page errors.
import { launch, open1938, lookAt, shot, save } from './c5_lib.mjs';
const seed = Number(process.argv[2] ?? 5519);
const years = Number(process.argv[3] ?? 12);
const tag = `c5g_${seed}`;
const out = { seed, shots: [], samples: [], years: [] };
const { browser, page, errors } = await launch();
const T0 = Date.now();
try {
  await open1938(page, seed);
  await page.evaluate(() => {
    window.__warsim.hud.setSpeedLevel(8);
    window.__warsim.sim.setPaused(false);
    window.__warsim.hud.paused.value = false;
  });
  let nextYear = 1;
  while (nextYear <= years && Date.now() - T0 < 30 * 60_000) {
    await page.waitForTimeout(5000);
    const s = await page.evaluate(() => {
      const v = window.__warsim.view;
      return { tick: v.lastTick, wall: performance.now(), fps: window.__warsim.view.fps ?? null };
    });
    out.samples.push({ wallS: (Date.now() - T0) / 1000, tick: s.tick });
    if (s.tick >= nextYear * 8760) {
      const ins = await page.evaluate(() => window.__warsim.sim.inspect());
      const living = ins.nations.filter((n) => n.living);
      const free = living.filter((n) => /Free |=/.test(n.name ?? '')).length;
      out.years.push({ year: nextYear, tick: s.tick, wallS: (Date.now() - T0) / 1000, living: living.length, wars: ins.wars.length, free, top: [...living].sort((a, b) => (b.area ?? 0) - (a.area ?? 0)).slice(0, 8).map((n) => `${n.name} ${Math.round(n.area)}`) });
      await page.evaluate(() => window.__warsim.view.controller.set({ cx: 1024, cy: 470, scale: (window.__warsim.view.metresPerPx * window.__warsim.view.controller.cam.scale) / 16000 }));
      await page.waitForTimeout(700);
      out.shots.push(await shot(page, `${tag}_1${String(nextYear).padStart(2, '0')}_world_year${nextYear}.png`));
      nextYear++;
    }
  }
  await page.evaluate(() => {
    window.__warsim.sim.setPaused(true);
    window.__warsim.hud.paused.value = true;
  });
  await page.waitForTimeout(1500);
  await lookAt(page, 1080, 300, 4500);
  out.shots.push(await shot(page, `${tag}_50_europe_end.png`));
  await lookAt(page, 1500, 380, 7000);
  out.shots.push(await shot(page, `${tag}_51_asia_end.png`));
  await lookAt(page, 600, 380, 7000);
  out.shots.push(await shot(page, `${tag}_52_americas_end.png`));
  out.ticker = await page.locator('[data-testid=ticker-row]').allInnerTexts().catch(() => []);
  await page.getByTestId('history-btn').click();
  await page.waitForTimeout(1000);
  out.history = (await page.locator('[data-testid=history-row]').allInnerTexts().catch(() => [])).slice(0, 60);
  out.shots.push(await shot(page, `${tag}_60_history.png`));
  await page.getByTestId('history-btn').click();
  await page.locator('button', { hasText: 'Charts' }).click().catch(() => {});
  await page.waitForTimeout(1500);
  out.shots.push(await shot(page, `${tag}_61_charts.png`));
  out.chartText = await page.locator('[data-testid=stats-chart], .stats-chart').first().innerText().catch(() => null);
} catch (e) {
  out.fatal = String(e?.stack ?? e);
}
out.errors = errors;
out.wallS = (Date.now() - T0) / 1000;
save(`c5_g_${seed}.json`, out);
await browser.close();
console.log(JSON.stringify({ fatal: out.fatal, errors: errors.length, years: out.years.map((y) => [y.year, Math.round(y.wallS), y.living, y.free, y.wars]), wallS: out.wallS }));
