// Critic run 17, session DET2: which page input changes the world? Open paused, do one thing, step a year, hash;
// compare with the headless hash. Usage: node critic/scripts/c17_det2.mjs <seed> <expectedHex> <variant>
import { launch, open1938, save, lookAt, CELLS, screenOf } from './c17_lib.mjs';
const [seedS, want, variant] = process.argv.slice(2);
const seed = Number(seedS);
const { browser, page, errors } = await launch();
const out = { seed, want, variant };
try {
  await open1938(page, seed);
  const [lx, ly] = CELLS.london;
  if (variant !== 'none') { await lookAt(page, lx, ly, 2500); }
  const [sx, sy] = await screenOf(page, lx, ly);
  if (variant === 'hover' || variant === 'all') { await page.mouse.move(sx, sy); await page.waitForTimeout(700); }
  if (variant === 'wheel' || variant === 'all') { for (let i = 0; i < 6; i++) { await page.mouse.wheel(0, 400); await page.waitForTimeout(150); } await page.waitForTimeout(900); }
  if (variant === 'drag' || variant === 'all') { await page.mouse.move(sx, sy); await page.mouse.down(); await page.mouse.move(sx - 300, sy - 100, { steps: 8 }); await page.mouse.up(); await page.waitForTimeout(900); }
  if (variant === 'click') { await page.mouse.click(sx, sy); await page.waitForTimeout(900); }
  if (variant === 'inspect') { await page.evaluate(() => window.__warsim.sim.inspect(true)); }
  out.panel = await page.evaluate(() => document.querySelector('[data-testid=nation-panel], [data-testid=formation-panel]')?.innerText?.slice(0, 120) ?? null);
  await page.mouse.move(5, 5);
  const r = await page.evaluate(async () => { const w = window.__warsim; await w.sim.step(8760); const r = await w.sim.hash(); return { tick: r.tick, hash: (r.hash >>> 0).toString(16).padStart(8, '0') }; });
  Object.assign(out, r, { same: r.hash === want });
} catch (e) { out.fatal = String(e?.stack ?? e); }
out.errors = errors; save(`c17_det2_${seed}_${variant}.json`, out); await browser.close();
console.log(JSON.stringify(out));
