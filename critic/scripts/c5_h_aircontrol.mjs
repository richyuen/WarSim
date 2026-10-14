// Session H (run 5): the air superiority mode's data against its picture, day 1 and day 20 of Germany on Poland.
import { readFileSync } from 'node:fs';
import { launch, open1938, lookAt, shot, save, hours } from './c5_lib.mjs';
const seed = Number(process.argv[2] ?? 8317);
const tag = `c5h_${seed}`;
const tags = JSON.parse(readFileSync(new URL('../c5_tags.json', import.meta.url), 'utf8'));
const out = { seed, shots: [], samples: [] };
const { browser, page, errors } = await launch();
try {
  await open1938(page, seed);
  await page.evaluate(() => {
    window.__air = { n: 0 };
    window.__warsim.sim.onAirControl((holder, zones) => {
      window.__air.n++;
      window.__air.holder = Array.from(holder);
      if (zones) window.__air.zonesLen = zones.length;
    });
    window.__warsim.hud.setMapMode('airControl');
  });
  await page.evaluate(({ a, d }) => window.__warsim.sim.command({ kind: 'declareWar', attacker: a, defender: d }), { a: tags.GER, d: tags.POL });
  for (const [h, label] of [[24, 'day1'], [24 * 6, 'day7'], [24 * 13, 'day20'], [24 * 40, 'day60']]) {
    await hours(page, h);
    await lookAt(page, 1110, 270, 2500);
    await page.waitForTimeout(800);
    const s = await page.evaluate(() => {
      const a = window.__air;
      const c = {};
      for (const v of a.holder ?? []) c[v] = (c[v] ?? 0) + 1;
      return { updates: a.n, zones: (a.holder ?? []).length, byHolder: c, sorties: window.__warsim.view.sortieMarks.length, tick: window.__warsim.view.lastTick };
    });
    out.samples.push({ label, ...s });
    out.shots.push(await shot(page, `${tag}_${label}_aircontrol.png`));
  }
} catch (e) {
  out.fatal = String(e?.stack ?? e);
}
out.errors = errors;
save(`c5_h_${seed}.json`, out);
await browser.close();
console.log(JSON.stringify({ fatal: out.fatal, errors: errors.length, samples: out.samples }));
