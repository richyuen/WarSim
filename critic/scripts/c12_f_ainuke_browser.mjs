// Critic run 12, session F: an AI nuclear exchange seen from the player's seat. Loads a headless save
// taken before the strikes, runs at Max, stops at each new nuclear alert: the alert, Go to, the ruin
// at T2, the fallout mode, then runs on. At the end: the nuclear charts and the history rows.
// Usage: node critic/scripts/c12_f_ainuke_browser.mjs <seed> <save.bin> <maxDays>
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { launch, open1938, shot, save, lookAt, run, pause, settle } from './c12_lib.mjs';

const seed = Number(process.argv[2] ?? 1);
const bin = process.argv[3];
const maxDays = Number(process.argv[4] ?? 365);
const tag = `c12f_${seed}`;
const out = { seed, bin, alerts: [], wall: {} };
const { browser, page, errors } = await launch();
const S = (n) => shot(page, `${tag}_${n}.png`);
try {
  const bytes = readFileSync(path.resolve(bin));
  await page.route('**/__critic_ck.bin', (r) => r.fulfill({ status: 200, body: bytes, contentType: 'application/octet-stream' }));
  await open1938(page, seed);
  out.loaded = await page.evaluate(async () => {
    const b = new Uint8Array(await (await fetch('/__critic_ck.bin')).arrayBuffer());
    return window.__warsim.sim.load(b);
  });
  await page.waitForTimeout(3000);
  await lookAt(page, 1100, 330, 9000);
  await S('00_loaded');
  const tick0 = await page.evaluate(() => window.__warsim.hud.tick.value);
  out.tick0 = tick0;
  await page.evaluate(() => window.__warsim.hud.setSpeedLevel(99));
  const seen = new Set();
  const w0 = Date.now();
  let n = 0;
  await run(page);
  for (;;) {
    const r = await page.waitForFunction(({ t, maxDays }) => {
      const a = document.querySelector('[data-testid=nuke-alert-text]');
      if (window.__warsim.hud.tick.value >= t + maxDays * 24) return 'end';
      return a ? a.innerText : false;
    }, { t: tick0, maxDays }, { timeout: 1_800_000, polling: 250 });
    const v = await r.jsonValue();
    if (v === 'end') break;
    if (seen.has(v)) {
      // same alert still up: close it and go on
      await page.locator('[data-testid=nuke-close]').click().catch(() => {});
      await page.waitForTimeout(200);
      continue;
    }
    seen.add(v);
    await pause(page);
    n++;
    const date = await page.evaluate(() => document.querySelector('[data-testid=bottombar]')?.innerText.match(/\d+ \w+ \d{4}/)?.[0] ?? null);
    const a = { n, text: v, date, wallS: (Date.now() - w0) / 1000 };
    await S(`1${n}_alert`);
    await page.locator('[data-testid=nuke-goto]').click();
    await page.waitForTimeout(1500);
    await settle(page);
    a.cam = await page.evaluate(() => { const vv = window.__warsim.view; const c = vv.controller.cam; return { cx: c.cx, cy: c.cy, mpp: vv.metresPerPx }; });
    await S(`1${n}_goto`);
    if (n <= 3) {
      await lookAt(page, a.cam.cx, a.cam.cy, 200);
      a.ruins = await page.evaluate(() => window.__warsim.view.ruinsShown);
      await S(`1${n}_ruin_200m`);
      await lookAt(page, a.cam.cx, a.cam.cy, a.cam.mpp);
    }
    out.alerts.push(a);
    save(`c12_f_${seed}.json`, { ...out, errors });
    await page.locator('[data-testid=nuke-close]').click().catch(() => {});
    await run(page);
  }
  await pause(page);
  out.wall.totalS = (Date.now() - w0) / 1000;
  await lookAt(page, 1100, 330, 9000);
  await S('80_end_world');
  // fallout map mode by cycling until the legend says fallout
  for (let i = 0; i < 14; i++) {
    const legend = await page.evaluate(() => document.querySelector('[class*=legend]')?.innerText ?? '');
    if (/fallout/i.test(legend)) break;
    await page.locator('[data-testid=mapmode-btn]').click();
    await page.waitForTimeout(300);
  }
  out.falloutLegend = await page.evaluate(() => document.querySelector('[class*=legend]')?.innerText ?? '');
  await S('81_fallout_mode');
  await page.evaluate(() => window.__warsim.hud.setMapMode('political'));
  await page.evaluate(() => window.__warsim.hud.toggleCharts?.());
  await page.waitForTimeout(800);
  const opt = 'Nuclear dead (on its land)';
  try {
    await page.locator('select').filter({ hasText: opt }).first().selectOption({ label: opt });
    await page.waitForTimeout(800);
  } catch (e) { out.chartErr = String(e).slice(0, 200); }
  await S('82_chart_nukedead');
  await page.evaluate(() => window.__warsim.hud.toggleCharts?.());
  await page.evaluate(() => window.__warsim.hud.toggleHistory());
  await page.waitForTimeout(800);
  await S('83_history');
  out.history = (await page.evaluate(() => document.body.innerText)).split('\n').filter((l) => /bomb|nuclear|warhead|struck|missile/i.test(l)).slice(0, 40);
} catch (e) {
  out.fatal = String(e?.stack ?? e);
}
out.errors = errors;
save(`c12_f_${seed}.json`, out);
await browser.close();
console.log(JSON.stringify({ fatal: out.fatal, errors: errors.length, alerts: out.alerts.map((a) => [a.date, a.text, a.ruins]), wall: out.wall }));
