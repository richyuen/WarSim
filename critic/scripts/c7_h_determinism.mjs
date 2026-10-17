// Critic run 7, session H: the browser's game against the headless runner, the same seed: the state hash at
// each year's end (pause on the year boundary by stepping), then a save and load twin.
import { readFileSync } from 'node:fs';
import { launch, open1938, save, shot } from './c7_lib.mjs';

const seed = Number(process.argv[2] ?? 1207);
const years = Number(process.argv[3] ?? 3);
const headless = JSON.parse(readFileSync(new URL(`../c7_headless_${seed}.json`, import.meta.url), 'utf8'));
const out = { seed, years: [] };
const { browser, page, errors } = await launch();
try {
  await open1938(page, seed);
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
    save(`c7_h_${seed}.json`, { ...out, errors });
  }
  // save, load, and step both 30 days: the twin must match the straight run
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
  await shot(page, `c7h_${seed}_end.png`);
} catch (e) {
  out.fatal = String(e?.stack ?? e);
}
out.errors = errors;
save(`c7_h_${seed}.json`, out);
await browser.close();
console.log(JSON.stringify(out));
