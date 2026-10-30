// Critic run 17, session DET: browser vs headless with no input at all: open paused, step to the year's end, hash.
// Usage: node critic/scripts/c20_det.mjs <seed> <expectedHex> [hours=8760]
import { launch, open1938, save } from './c20_lib.mjs';
const [seedS, want, hoursS] = process.argv.slice(2);
const seed = Number(seedS); const H = Number(hoursS ?? 8760);
const { browser, page, errors } = await launch();
const out = { seed, want, H };
try {
  await open1938(page, seed);
  out.h0 = await page.evaluate(async () => { const r = await window.__warsim.sim.hash(); return { tick: r.tick, hash: (r.hash >>> 0).toString(16) }; });
  const r = await page.evaluate(async (H) => { const w = window.__warsim; await w.sim.step(H); const r = await w.sim.hash(); return { tick: r.tick, hash: (r.hash >>> 0).toString(16).padStart(8, '0') }; }, H);
  Object.assign(out, r, { same: r.hash === want });
} catch (e) { out.fatal = String(e?.stack ?? e); }
out.errors = errors; save(`c20_det_${seed}_${H}.json`, out); await browser.close();
console.log(JSON.stringify(out));
