// Session D: a watcher's long run. Seed 3889, Max speed, unpaused, the world view; a picture every
// two simulated years; the ticker and sound cues as they come; charts and history at the end.
import { launch, open1938, lookAt, shot, save, settle, inspect } from './c4_lib.mjs';
const seed = Number(process.argv[2] ?? 3889);
const wallMin = Number(process.argv[3] ?? 40);
const out = { seed, shots: [], years: [], ticker: [] };
const { browser, page, errors } = await launch(1600, 900);
const T0 = Date.now();
try {
  await open1938(page, seed);
  await lookAt(page, 1024, 420, 9000);
  // speed to max through the UI
  for (let i = 0; i < 6; i++) await page.getByTestId('speed-up').click().catch(() => {});
  out.speedLabel = await page.getByTestId('speed-label').innerText();
  await page.getByTestId('pause-btn').click();
  const startTick = await page.evaluate(() => window.__warsim.view.lastTick);
  let lastYear = 0;
  const seenTicker = new Set();
  while ((Date.now() - T0) / 60000 < wallMin) {
    await page.waitForTimeout(5000);
    const tick = await page.evaluate(() => window.__warsim.view.lastTick);
    const rows = await page.locator('[data-testid=ticker-row]').allInnerTexts().catch(() => []);
    for (const r of rows) if (!seenTicker.has(r)) { seenTicker.add(r); out.ticker.push({ wallS: (Date.now() - T0) / 1000, r }); }
    const year = Math.floor((tick - startTick) / 8760);
    if (year > lastYear) {
      lastYear = year;
      const ins = await inspect(page);
      const living = ins.nations.filter((n) => n.living);
      const founded = living.filter((n) => n.name.startsWith('='));
      const top = [...living].sort((a, b) => b.landShare - a.landShare).slice(0, 10).map((n) => `${n.name} ${(100 * n.landShare).toFixed(1)}%`);
      const sound = await page.evaluate(() => ({ asked: window.__warsim.sound.asked?.length ?? null, sounded: window.__warsim.sound.sounded, cues: window.__warsim.sound.asked.slice(-5) }));
      out.years.push({ year, tick, wallS: (Date.now() - T0) / 1000, living: living.length, founded: founded.length, foundedNames: founded.slice(0, 12).map((n) => n.name), top, wars: ins.wars.length, sound, date: await page.getByTestId('date-label').innerText() });
      console.log(JSON.stringify(out.years.at(-1)));
      if (year % 2 === 0) out.shots.push(await shot(page, `c4d_1${String(year).padStart(2, '0')}_world_year${year}.png`));
      save(`c4_d_${seed}.json`, { ...out, errors });
    }
  }
  await page.getByTestId('pause-btn').click();
  await page.waitForTimeout(1500);
  out.endTick = await page.evaluate(() => window.__warsim.view.lastTick);
  await lookAt(page, 1060, 290, 4000);
  out.shots.push(await shot(page, 'c4d_50_europe_end.png'));
  await lookAt(page, 1600, 330, 4000);
  out.shots.push(await shot(page, 'c4d_51_asia_end.png'));
  await lookAt(page, 560, 330, 5000);
  out.shots.push(await shot(page, 'c4d_52_americas_end.png'));
  await lookAt(page, 1024, 430, 9000);
  await page.getByTestId('stats-btn').click().catch(() => {});
  await page.waitForTimeout(800);
  out.shots.push(await shot(page, 'c4d_60_stats.png'));
  await page.getByTestId('ranking-charts').click().catch(() => {});
  await page.waitForTimeout(1200);
  out.shots.push(await shot(page, 'c4d_61_charts.png'));
  await page.getByTestId('chart-close').click().catch(() => {});
  await page.getByTestId('history-btn').click().catch(() => {});
  await page.waitForTimeout(1000);
  out.historyCount = await page.getByTestId('history-count').innerText().catch(() => null);
  out.historyHead = (await page.locator('[data-testid=history-row]').allInnerTexts()).slice(0, 60);
  out.shots.push(await shot(page, 'c4d_62_history.png'));
} catch (e) {
  out.fatal = String(e?.stack ?? e);
}
out.wallS = (Date.now() - T0) / 1000;
out.errors = errors;
save(`c4_d_${seed}.json`, out);
await browser.close();
console.log(JSON.stringify({ fatal: out.fatal, years: out.years.length, wallS: out.wallS }));
