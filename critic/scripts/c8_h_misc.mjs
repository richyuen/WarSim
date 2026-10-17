// Critic run 8, session H: (1) browser vs headless hashes, 3 years; save/load twin and the save's
// size; (2) the tooltip after a wheel zoom with the mouse still; (3) the air mode's holder over
// Poland on day 10 of Germany's war.
// Usage: node critic/scripts/c8_h_misc.mjs <seed> <years>
import { readFileSync } from 'node:fs';
import { launch, open1938, save, shot, lookAt, CELLS, screenOf, hours } from './c8_lib.mjs';

const seed = Number(process.argv[2] ?? 5381);
const years = Number(process.argv[3] ?? 3);
const headless = JSON.parse(readFileSync(new URL(`../c8_headless_${seed}.json`, import.meta.url), 'utf8'));
const T = CELLS.tags;
const out = { seed, years: [], hovers: [] };
const { browser, page, errors } = await launch();
const S = (n) => shot(page, `c8h_${seed}_${n}.png`);
try {
  await open1938(page, seed);
  // (2) tooltip: hover London at 2,500 m/px, wheel out with the mouse still, then wheel in elsewhere
  const [lx, ly] = CELLS.london;
  await lookAt(page, lx, ly, 2500);
  const [sx, sy] = await screenOf(page, lx, ly);
  await page.mouse.move(sx, sy);
  await page.waitForTimeout(700);
  out.tip0 = await page.evaluate(() => document.querySelector('[class*=tooltip]')?.innerText ?? null);
  await S('00_tip_london');
  for (let i = 0; i < 6; i++) { await page.mouse.wheel(0, 400); await page.waitForTimeout(150); }
  await page.waitForTimeout(900);
  out.tip1 = await page.evaluate(() => document.querySelector('[class*=tooltip]')?.innerText ?? null);
  out.cam1 = await page.evaluate(() => window.__warsim.view.metresPerPx);
  await S('01_tip_after_wheel_out');
  // pan by keyboard/drag with no hover move: drag then release at the same spot
  await page.mouse.down();
  await page.mouse.move(sx - 300, sy - 100, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(900);
  out.tip2 = await page.evaluate(() => document.querySelector('[class*=tooltip]')?.innerText ?? null);
  await S('02_tip_after_drag');
  // (1) hashes
  await page.mouse.move(5, 5);
  for (let y = 1; y <= years; y++) {
    const t0 = Date.now();
    const st = await page.evaluate(async () => {
      const w = window.__warsim;
      const tick = (await w.sim.hash()).tick;
      const target = Math.ceil((tick + 1) / 8760) * 8760;
      await w.sim.step(target - tick);
      return w.sim.hash();
    });
    const h = (st.hash >>> 0).toString(16).padStart(8, '0');
    const want = headless.rows[y - 1]?.hash?.padStart(8, '0');
    out.years.push({ y, tick: st.tick, browser: h, headless: want, same: h === want, wallS: (Date.now() - t0) / 1000 });
    save(`c8_h_${seed}.json`, { ...out, errors });
  }
  const twin = await page.evaluate(async () => {
    const w = window.__warsim;
    const bytes = await w.sim.save();
    await w.sim.step(24 * 30);
    const a = await w.sim.hash();
    await w.sim.load(bytes);
    await w.sim.step(24 * 30);
    const b = await w.sim.hash();
    return { bytes: bytes.length, a: a.hash >>> 0, b: b.hash >>> 0, tickA: a.tick, tickB: b.tick };
  });
  out.twin = { ...twin, same: twin.a === twin.b };
  await S('10_after_twin');
} catch (e) {
  out.fatal = String(e?.stack ?? e);
}
// (3) air hover, a fresh game
try {
  await open1938(page, 8217);
  await page.evaluate(({ a, d }) => window.__warsim.sim.command({ kind: 'declareWar', attacker: a, defender: d }), { a: T.GER, d: T.POL });
  await hours(page, 24 * 10);
  await page.evaluate(() => window.__warsim.hud.setMapMode('airControl'));
  await lookAt(page, CELLS.polfront[0], CELLS.polfront[1], 3000);
  await page.waitForTimeout(800);
  out.airHolders = await page.evaluate(() => window.__warsim.hud.airHolders.value.map((h) => ({ ...h })));
  for (const [name, c] of Object.entries({ warsaw: CELLS.warsaw, kiev: CELLS.kiev, berlin: CELLS.berlin, prague: CELLS.prague })) {
    const [x, y] = await screenOf(page, c[0], c[1]);
    await page.mouse.move(x, y);
    await page.waitForTimeout(600);
    out.hovers.push({ name, text: await page.evaluate(() => [...document.querySelectorAll('[class*=legend]')].map((e) => e.innerText).join(' | ').slice(0, 300)) });
  }
  await shot(page, 'c8h_8217_air_hover.png');
} catch (e) {
  out.fatal2 = String(e?.stack ?? e);
}
out.errors = errors;
save(`c8_h_${seed}.json`, out);
await browser.close();
console.log(JSON.stringify(out));
