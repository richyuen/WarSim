// Critic run 9, session O: the daily zero-loss sea battle of seed 2609 year 21 (Norway and Sweden
// against the United Kingdom at one point, 288 of 294 battles that year with no ship lost) seen
// from the player's seat: the ticker row, the view it frames, the fire in 5 s at Speed x1.
// Usage: node critic/scripts/c9_o_phantom_sea.mjs <seed> <save.bin> <tick>
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { launch, open1938, shot, save, lookAt } from './c9_lib.mjs';

const seed = Number(process.argv[2] ?? 2609);
const bin = process.argv[3] ?? 'critic/c9_seed2609_y20.bin';
const target = Number(process.argv[4] ?? 179100);
const tag = `c9o_${seed}`;
const out = { seed, bin, target };
const { browser, page, errors } = await launch();
try {
  const bytes = readFileSync(path.resolve(bin));
  await page.route('**/__critic_ck.bin', (r) => r.fulfill({ status: 200, body: bytes, contentType: 'application/octet-stream' }));
  await open1938(page, seed);
  out.loaded = await page.evaluate(async () => window.__warsim.sim.load(new Uint8Array(await (await fetch('/__critic_ck.bin')).arrayBuffer())));
  await page.evaluate(() => { try { window.__warsim.settings.nukePause.value = false; } catch {} });
  const now = out.loaded.tick;
  await page.evaluate(async (n) => {
    const { sim, view } = window.__warsim;
    const t = (await sim.step(n)).tick;
    await new Promise((d) => { const w = () => (view.lastTick >= t ? d() : setTimeout(w, 10)); w(); });
  }, target - now);
  // step an hour at a time until a battle with a row is live
  for (let h = 0; h < 130; h++) {
    const n = await page.evaluate(() => window.__warsim.view.seaBattles().length);
    if (n > 0) break;
    await page.evaluate(async () => { const { sim, view } = window.__warsim; const t = (await sim.step(1)).tick; await new Promise((d) => { const w = () => (view.lastTick >= t ? d() : setTimeout(w, 10)); w(); }); });
  }
  out.battles = await page.evaluate(() => JSON.parse(JSON.stringify(window.__warsim.view.seaBattles())));
  out.rows = await page.getByTestId('sea-battle-row').allInnerTexts().catch(() => []);
  out.ticker = (await page.evaluate(() => document.body.innerText)).split('\n').filter((l) => /Sea battle|fought at sea/.test(l)).slice(0, 10);
  await shot(page, `${tag}_00_before.png`);
  if (out.battles[0]) {
    const b = out.battles[0];
    await lookAt(page, b.cx, b.cy, 1500);
    await shot(page, `${tag}_00b_battle_area_1500m.png`);
    out.area = await page.evaluate(async (b) => {
      const v = window.__warsim.view;
      const s = await window.__warsim.sim.inspect(true);
      return s.formations.filter((f) => v.formationAfloat(f.id) && Math.hypot(f.x - b.x, f.y - b.y) < b.r + 3 && (f.nation === b.a || f.nation === b.b)).map((f) => ({ id: f.id, nation: f.nation, t: v.formationTitle(f.id)?.name, x: +f.x.toFixed(1), y: +f.y.toFixed(1), strength: f.strength }));
    }, b);
    const hist = [];
    for (let d = 0; d < 6; d++) {
      await page.evaluate(async () => { const { sim, view } = window.__warsim; const t = (await sim.step(24)).tick; await new Promise((r) => { const w = () => (view.lastTick >= t ? r() : setTimeout(w, 10)); w(); }); });
      hist.push(await page.evaluate(() => JSON.parse(JSON.stringify(window.__warsim.view.seaBattles()))));
    }
    out.next6days = hist;
    out.tickerAfter = (await page.evaluate(() => document.body.innerText)).split('\n').filter((l) => /fought at sea|Sea battle/.test(l)).slice(0, 10);
    await shot(page, `${tag}_00c_after6days.png`);
  }
  if (out.rows.length) {
    await page.getByTestId('sea-battle-row').first().click();
    await page.waitForTimeout(300);
    await page.waitForFunction(() => !window.__warsim.view.controller.animating, null, { timeout: 60_000 });
    await page.waitForTimeout(600);
    out.cam = await page.evaluate(() => { const v = window.__warsim.view; return { cx: v.controller.cam.cx, cy: v.controller.cam.cy, mpp: v.metresPerPx }; });
    await shot(page, `${tag}_01_row.png`);
    await page.evaluate(() => { window.__warsim.hud.setSpeedLevel(0); if (window.__warsim.hud.paused.value) window.__warsim.hud.togglePause(); });
    const seq = [];
    for (let i = 0; i < 10; i++) { await page.waitForTimeout(500); seq.push(await page.evaluate(() => window.__warsim.view.fire?.shots?.length ?? null)); if (i === 4) await shot(page, `${tag}_02_live.png`); }
    out.shots = seq;
    await page.evaluate(() => { if (!window.__warsim.hud.paused.value) window.__warsim.hud.togglePause(); });
    await lookAt(page, out.cam.cx, out.cam.cy, 25);
    await shot(page, `${tag}_03_25m.png`);
    out.fleets = await page.evaluate(async () => {
      const v = window.__warsim.view; const c = v.controller.cam;
      const s = await window.__warsim.sim.inspect(true);
      return s.formations.filter((f) => v.formationAfloat(f.id) && Math.hypot(f.x - c.cx, f.y - c.cy) < 6).map((f) => ({ id: f.id, nation: f.nation, t: v.formationTitle(f.id)?.name, x: f.x, y: f.y }));
    });
  }
} catch (e) {
  out.fatal = String(e?.stack ?? e);
}
out.errors = errors;
save(`c9_o_${seed}.json`, out);
await browser.close();
console.log(JSON.stringify(out).slice(0, 3000));
