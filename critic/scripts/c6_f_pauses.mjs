// Session F (run 6): from seed 6619's year-12 checkpoint (headless --save), at Max: every auto-pause, with what
// the screen says at that moment (banner text or none, the ticker), against the strikes the sim records.
import { readFileSync } from 'node:fs';
import { launch, open1938, shot, save, run, ROOT } from './c6_lib.mjs';
import path from 'node:path';
const out = { pauses: [] };
const { browser, page, errors } = await launch();
try {
  await open1938(page, 6619);
  const bin = readFileSync(path.join(ROOT, 'critic/c6_seed6619_y12.bin'));
  await page.evaluate(async (b64) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    await window.__warsim.sim.load(bytes);
  }, bin.toString('base64'));
  await page.waitForTimeout(3000);
  out.loadedTick = await page.evaluate(() => window.__warsim.view.lastTick);
  await page.evaluate(() => {
    window.__warsim.hud.setSpeedLevel(8);
  });
  await run(page);
  const T0 = Date.now();
  let n = 0;
  while (Date.now() - T0 < 8 * 60_000) {
    await page.waitForTimeout(250);
    const s = await page.evaluate(() => ({ tick: window.__warsim.view.lastTick, paused: window.__warsim.hud.paused.value, alert: document.querySelector('[data-testid=nuke-alert-text]')?.textContent ?? null, ticker: [...document.querySelectorAll('[data-testid=ticker-row]')].map((e) => e.textContent) }));
    if (s.tick > 122000) break;
    if (s.paused) {
      n++;
      const p = { n, ...s, wallS: (Date.now() - T0) / 1000 };
      if (n <= 12) p.shot = await shot(page, `c6f_6619_pause_${String(n).padStart(2, '0')}.png`);
      out.pauses.push(p);
      await page.getByTestId('nuke-close').click().catch(() => {});
      await run(page);
    }
  }
  out.history = await page.evaluate(async () => (await window.__warsim.sim.history()).filter((r) => r.kind === 56).map((r) => ({ tick: r.tick, a: r.an, b: r.b })));
} catch (e) {
  out.fatal = String(e?.stack ?? e);
}
out.errors = errors;
save('c6_f_6619.json', out);
await browser.close();
console.log(JSON.stringify({ fatal: out.fatal, errors: errors.length, loaded: out.loadedTick, pauses: out.pauses.map((p) => [p.tick, p.alert]), strikes: out.history?.map((h) => h.tick) }));
