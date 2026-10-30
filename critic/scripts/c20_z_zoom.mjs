// Critic run 12, session Z: one continuous wheel zoom on a live front, from about 6,000 m/px to the
// closest, a screenshot per step, with what the view draws (counters, elements, figures) per step.
// Usage: node critic/scripts/c20_z_zoom.mjs <seed>
import { launch, open1938, lookAt, shot, save, hours, CELLS, screenOf } from './c20_lib.mjs';

const seed = Number(process.argv[2] ?? 6113);
const T = CELLS.tags;
const out = { seed, steps: [] };
const { browser, page, errors } = await launch();
try {
  await open1938(page, seed);
  await page.evaluate(({ a, d }) => window.__warsim.sim.command({ kind: 'declareWar', attacker: a, defender: d }), { a: T.GER, d: T.POL });
  await hours(page, 24 * 4);
  const f = await page.evaluate((n) => {
    const v = window.__warsim.view;
    return v.formationsOf(n).map((f) => ({ f, t: v.formationTitle(f), pos: v.formationPos(f), e: v.formationEngaged(f) })).filter((x) => x.e && /Infantry/.test(JSON.stringify(x.t)))[0];
  }, T.GER);
  out.f = f;
  await lookAt(page, f.pos[0], f.pos[1], 6000);
  await page.evaluate(() => { window.__warsim.hud.setSpeedLevel(0); if (window.__warsim.hud.paused.value) window.__warsim.hud.togglePause(); });
  const [sx, sy] = await screenOf(page, f.pos[0], f.pos[1]);
  await page.mouse.move(sx, sy);
  for (let i = 0; i < 40; i++) {
    const s = await page.evaluate(() => { const v = window.__warsim.view; return { mpp: Math.round(v.metresPerPx * 10) / 10, el: v.elementCount, ind: v.individualCount, frames: v.frames }; });
    out.steps.push({ i, ...s });
    await shot(page, `c20z_${seed}_${String(i).padStart(2, '0')}.png`);
    if (s.mpp < 4) break;
    await page.mouse.wheel(0, -200);
    await page.waitForTimeout(450);
  }
} catch (e) {
  out.fatal = String(e?.stack ?? e);
}
out.errors = errors;
save(`c20_z_${seed}.json`, out);
await browser.close();
console.log(JSON.stringify(out));
