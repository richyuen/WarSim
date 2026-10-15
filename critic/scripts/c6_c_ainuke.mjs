// Session C (run 6): an AI world at Max until the AI's own nuclear strikes, as a player watching meets them.
// Polls the alert; on each one: the screen as it lands, "Go to", the burst over the next seconds, the fallout
// mode, the history. Runs on (resuming after each auto-pause) until `years` or the wall limit.
import { launch, open1938, lookAt, shot, save, run, inspect } from './c6_lib.mjs';
const seed = Number(process.argv[2] ?? 6619);
const years = Number(process.argv[3] ?? 16);
const wallMin = Number(process.argv[4] ?? 40);
const tag = `c6c_${seed}`;
const out = { seed, shots: [], years: [], alerts: [] };
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
  let seen = 0;
  while (nextYear <= years && Date.now() - T0 < wallMin * 60_000) {
    await page.waitForTimeout(1000);
    const s = await page.evaluate(() => ({ tick: window.__warsim.view.lastTick, paused: window.__warsim.hud.paused.value, alert: document.querySelector('[data-testid=nuke-alert-text]')?.textContent ?? null }));
    if (s.alert && s.alert !== out.alerts.at(-1)?.text) {
      seen++;
      const a = { n: seen, text: s.alert, tick: s.tick, wallS: (Date.now() - T0) / 1000, pausedOnAlert: s.paused, shots: [] };
      a.cam0 = await page.evaluate(() => ({ ...window.__warsim.view.controller.cam, mpp: window.__warsim.view.metresPerPx }));
      a.shots.push(await shot(page, `${tag}_a${seen}_0_as_it_lands.png`));
      if (seen <= 4) {
        await page.getByTestId('nuke-goto').click().catch(() => {});
        for (const ms of [300, 1200, 2500, 5000]) {
          await page.waitForTimeout(ms === 300 ? 300 : ms - [0, 300, 1200, 2500][[300, 1200, 2500, 5000].indexOf(ms)]);
          a.shots.push(await shot(page, `${tag}_a${seen}_1_goto_${ms}.png`));
        }
        a.cam1 = await page.evaluate(() => ({ ...window.__warsim.view.controller.cam, mpp: window.__warsim.view.metresPerPx, bursts: window.__warsim.view.nukeFx?.bursts?.length }));
        a.ticker = await page.locator('[data-testid=ticker-row]').allInnerTexts().catch(() => []);
        await page.getByTestId('history-btn').click();
        await page.waitForTimeout(700);
        a.history = (await page.locator('[data-testid=history-row]').allInnerTexts().catch(() => [])).slice(0, 15);
        a.shots.push(await shot(page, `${tag}_a${seen}_2_history.png`));
        await page.getByTestId('history-btn').click();
        await page.evaluate(() => window.__warsim.hud.setMapMode('fallout'));
        await page.waitForTimeout(800);
        const c = a.cam1;
        await lookAt(page, c.cx, c.cy, 2500, false);
        a.shots.push(await shot(page, `${tag}_a${seen}_3_fallout.png`));
        await page.evaluate(() => window.__warsim.hud.setMapMode('political'));
        await lookAt(page, c.cx, c.cy, 2500, false);
        a.shots.push(await shot(page, `${tag}_a${seen}_4_political.png`));
      }
      out.alerts.push(a);
      await page.getByTestId('nuke-close').click().catch(() => {});
      await page.evaluate(() => window.__warsim.view.controller.set({ cx: 1024, cy: 470, scale: (window.__warsim.view.metresPerPx * window.__warsim.view.controller.cam.scale) / 16000 }));
      await run(page);
      save(`c6_c_${seed}.json`, { ...out, errors });
    } else if (s.paused) {
      await run(page);
    }
    if (s.tick >= nextYear * 8760) {
      const ins = await inspect(page);
      const living = ins.nations.filter((n) => n.living);
      out.years.push({ year: nextYear, tick: s.tick, wallS: (Date.now() - T0) / 1000, living: living.length, wars: ins.wars.length, warheads: living.filter((n) => n.warheads > 0).map((n) => `${n.name}:${n.warheads}`) });
      nextYear++;
      save(`c6_c_${seed}.json`, { ...out, errors });
    }
  }
  await page.evaluate(() => {
    window.__warsim.sim.setPaused(true);
    window.__warsim.hud.paused.value = true;
  });
  await page.waitForTimeout(1000);
  await page.evaluate(() => window.__warsim.view.controller.set({ cx: 1024, cy: 470, scale: (window.__warsim.view.metresPerPx * window.__warsim.view.controller.cam.scale) / 16000 }));
  await page.waitForTimeout(800);
  out.shots.push(await shot(page, `${tag}_90_world_end.png`));
  await page.evaluate(() => window.__warsim.hud.setMapMode('fallout'));
  await page.waitForTimeout(1000);
  out.shots.push(await shot(page, `${tag}_91_fallout_world_end.png`));
  await page.evaluate(() => window.__warsim.hud.setMapMode('political'));
  await lookAt(page, 1080, 300, 4500, false);
  out.shots.push(await shot(page, `${tag}_92_europe_end.png`));
  await page.getByTestId('history-btn').click();
  await page.waitForTimeout(800);
  out.historyEnd = (await page.locator('[data-testid=history-row]').allInnerTexts().catch(() => [])).slice(0, 80);
  out.shots.push(await shot(page, `${tag}_93_history_end.png`));
  await page.getByTestId('history-btn').click();
  await page.locator('button', { hasText: 'Charts' }).click().catch(() => {});
  await page.waitForTimeout(1500);
  out.shots.push(await shot(page, `${tag}_94_charts_end.png`));
} catch (e) {
  out.fatal = String(e?.stack ?? e);
}
out.errors = errors;
out.wallS = (Date.now() - T0) / 1000;
save(`c6_c_${seed}.json`, out);
await browser.close();
console.log(JSON.stringify({ fatal: out.fatal, errors: errors.length, alerts: out.alerts.map((a) => [a.tick, a.text]), years: out.years.map((y) => [y.year, Math.round(y.wallS), y.living, y.wars]) }));
