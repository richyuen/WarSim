// Session A (run 6): God Mode's nuke, as a player uses it, at every tier, live (no hold, no injected burst).
// The alert, the auto-pause, the history row, the fallout mode days later, the nation panel.
import { launch, open1938, lookAt, shot, save, CELLS, screenOf, run, pause, hours, inspect } from './c6_lib.mjs';
const seed = Number(process.argv[2] ?? 4127);
const tag = `c6a_${seed}`;
const out = { seed, strikes: [] };
const { browser, page, errors } = await launch();
try {
  await open1938(page, seed);
  out.shots = [await shot(page, `${tag}_00_boot.png`)];
  await page.getByTestId('god-btn').click();
  // Select Germany by clicking it, open the God tab.
  await lookAt(page, CELLS.berlin[0], CELLS.berlin[1], 4000);
  let [sx, sy] = await screenOf(page, CELLS.berlin[0] - 6, CELLS.berlin[1] + 4);
  await page.mouse.click(sx, sy);
  await page.waitForTimeout(500);
  await page.getByTestId('tab-god').click();
  await page.waitForTimeout(300);
  out.godTabText = await page.getByTestId('panel-god').innerText().catch(() => null);
  out.shots.push(await shot(page, `${tag}_01_godtab.png`));
  const plan = [
    ['berlin', 4000],
    ['warsaw', 1000],
    ['paris', 150],
    ['london', 20],
  ];
  for (const [city, m] of plan) {
    const [cx, cy] = CELLS[city];
    await lookAt(page, cx, cy, m);
    await page.evaluate(() => window.__warsim.hud.setSpeedLevel?.(1));
    await run(page);
    await page.waitForTimeout(300);
    await page.getByTestId('god-tool-nuke').click();
    await page.waitForTimeout(200);
    const hint = await page.getByTestId('god-tool-hint').innerText().catch(() => null);
    [sx, sy] = await screenOf(page, cx, cy);
    const t0 = Date.now();
    await page.mouse.click(sx, sy);
    const rec = { city, m, hint, at: [sx, sy], frames: [] };
    for (const ms of [150, 500, 1000, 2000, 3500, 6000]) {
      const wait = ms - (Date.now() - t0);
      if (wait > 0) await page.waitForTimeout(wait);
      const f = await page.evaluate(() => {
        const v = window.__warsim.view;
        return { bursts: v.nukeFx?.bursts?.length ?? null, paused: window.__warsim.hud.paused.value, mpp: v.metresPerPx };
      });
      rec.frames.push({ ms: Date.now() - t0, ...f, shot: await shot(page, `${tag}_1_${city}_${m}m_${ms}.png`) });
    }
    rec.alert = await page.getByTestId('nuke-alert-text').innerText().catch(() => null);
    rec.pausedAfter = await page.evaluate(() => window.__warsim.hud.paused.value);
    await page.getByTestId('nuke-close').click().catch(() => {});
    out.strikes.push(rec);
  }
  // The history.
  await pause(page);
  await page.getByTestId('history-btn').click();
  await page.waitForTimeout(800);
  out.history = (await page.locator('[data-testid=history-row]').allInnerTexts().catch(() => [])).slice(0, 20);
  out.shots.push(await shot(page, `${tag}_20_history.png`));
  await page.getByTestId('history-btn').click();
  out.ticker = await page.locator('[data-testid=ticker-row]').allInnerTexts().catch(() => []);
  // Ten days on: the fallout mode and the map in Europe.
  await hours(page, 240);
  await lookAt(page, CELLS.prague[0], CELLS.prague[1], 3000);
  out.shots.push(await shot(page, `${tag}_30_political_day10.png`));
  await page.evaluate(() => window.__warsim.hud.setMapMode('fallout'));
  await page.waitForTimeout(1500);
  out.shots.push(await shot(page, `${tag}_31_fallout_day10.png`));
  out.legend = await page.locator('[data-testid=map-legend], .map-legend, .legend').first().innerText().catch(() => null);
  await lookAt(page, CELLS.berlin[0], CELLS.berlin[1], 800);
  out.shots.push(await shot(page, `${tag}_32_fallout_berlin_800m.png`));
  await page.evaluate(() => window.__warsim.hud.setMapMode('political'));
  await lookAt(page, CELLS.berlin[0], CELLS.berlin[1], 150);
  out.shots.push(await shot(page, `${tag}_33_berlin_150m_day10.png`));
  await lookAt(page, CELLS.berlin[0], CELLS.berlin[1], 20);
  out.shots.push(await shot(page, `${tag}_34_berlin_20m_day10.png`));
  // Germany's panel: does it say what happened to it?
  await lookAt(page, CELLS.berlin[0], CELLS.berlin[1], 4000);
  [sx, sy] = await screenOf(page, CELLS.berlin[0] - 6, CELLS.berlin[1] + 4);
  await page.mouse.click(sx, sy);
  await page.waitForTimeout(600);
  await page.getByTestId('tab-overview').click().catch(() => {});
  out.germanyPanel = await page.getByTestId('nation-panel').innerText().catch(() => null);
  out.shots.push(await shot(page, `${tag}_40_germany_panel.png`));
  const ins = await inspect(page);
  out.fallout = ins.fallout ? Object.keys(ins.fallout).length : null;
  out.inspectKeys = Object.keys(ins);
} catch (e) {
  out.fatal = String(e?.stack ?? e);
}
out.errors = errors;
save(`c6_a_${seed}.json`, out);
await browser.close();
console.log(JSON.stringify({ fatal: out.fatal, errors: errors.length, strikes: out.strikes.map((s) => [s.city, s.alert, s.frames.map((f) => f.bursts).join(',')]) }));
