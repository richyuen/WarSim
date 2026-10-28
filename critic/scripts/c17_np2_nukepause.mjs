// Critic run 17, session NP: the pause on a nuclear strike (the setting's default), from a save before two AI
// strikes a day apart (1129, 25 and 26 October 1952): in-page every 10 ms, the tick when each alert text first
// shows, when the game pauses, and the history's strike rows.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { launch, open1938, shot, save, run } from './c17_lib.mjs';
const [seedS, bin] = process.argv.slice(2);
const out = { seed: Number(seedS), bin };
const { browser, page, errors } = await launch();
try {
  const bytes = readFileSync(path.resolve(bin));
  await page.route('**/__critic_ck.bin', (r) => r.fulfill({ status: 200, body: bytes, contentType: 'application/octet-stream' }));
  await open1938(page, Number(seedS));
  await page.evaluate(async () => window.__warsim.sim.load(new Uint8Array(await (await fetch('/__critic_ck.bin')).arrayBuffer())));
  out.nukePause = await page.evaluate(() => window.__warsim.settings.nukePause.value);
  await page.evaluate(() => {
    const w = window.__warsim; w.__np = [];
    let last = null; let wasPaused = w.hud.paused.value;
    setInterval(() => {
      const a = document.querySelector('[data-testid=nuke-alert-text]')?.innerText ?? null;
      if (a !== last) { w.__np.push({ k: 'alert', tick: w.hud.tick.value, text: a }); last = a; }
      if (w.hud.paused.value !== wasPaused) { w.__np.push({ k: w.hud.paused.value ? 'paused' : 'running', tick: w.hud.tick.value }); wasPaused = w.hud.paused.value; }
    }, 10);
  });
  await page.evaluate(() => window.__warsim.hud.setSpeedLevel(99));
  await run(page);
  out.pauses = [];
  for (let k = 1; k <= 3; k++) {
    await page.waitForFunction((k) => window.__warsim.__np.filter((e) => e.k === 'paused').length >= k, k, { timeout: 900_000, polling: 100 });
    await page.waitForTimeout(1500);
    const date = await page.evaluate(() => document.querySelector('[data-testid=bottombar]')?.innerText.match(/\d+ \w+ \d{4}/)?.[0] ?? null);
    const alerts = await page.evaluate(() => [...document.querySelectorAll('[data-testid=nuke-alert-text]')].map((a) => a.innerText));
    out.pauses.push({ k, date, tick: await page.evaluate(() => window.__warsim.hud.tick.value), alerts });
    await shot(page, `c17np_${seedS}_paused_${k}.png`);
    if (k < 3) await run(page);
  }
  out.events = await page.evaluate(() => window.__warsim.__np);
} catch (e) { out.fatal = String(e?.stack ?? e); }
out.errors = errors; save(`c17_np2_${seedS}.json`, out); await browser.close(); console.log(JSON.stringify(out));
