// Critic run 12, session B: the God Mode bomb's two sizes on the same point, each in a fresh game.
// Usage: node critic/scripts/c13_b_yield_ab.mjs <seed>
import { launch, BASE, save, CELLS, lookAt, shot } from './c13_lib.mjs';

const seed = Number(process.argv[2] ?? 4711);
const out = { seed, runs: [] };
const { browser, page, errors } = await launch();
for (const city of ['paris', 'london', 'berlin', 'moscow']) {
  for (const thermo of [false, true]) {
    await page.goto(`${BASE}/?scenario=1938&paused=1&seed=${seed}`);
    await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0, null, { timeout: 180_000 });
    await page.waitForFunction(() => window.__warsim.hud.stats.value !== null, null, { timeout: 180_000 });
    const [x, y] = CELLS[city];
    await page.evaluate(({ x, y, thermo }) => window.__warsim.hud.command({ kind: 'godNuke', x, y, thermonuclear: thermo }), { x, y, thermo });
    await page.waitForTimeout(2500);
    const line = await page.evaluate(() => document.body.innerText.split('\n').find((l) => /bomb fell/.test(l)) ?? null);
    await lookAt(page, x, y, 300);
    const p = await shot(page, `c13b_${city}_${thermo ? 'H' : 'A'}_300m.png`);
    out.runs.push({ city, thermo, line, shot: p });
    console.log(city, thermo, line);
  }
}
out.errors = errors;
save(`c13_b_${seed}.json`, out);
await browser.close();
