// Critic run 12, session Y: a late war watched for 60 days from a headless save: every 10 days, the engaged land
// formations the page shows, the wars, and a shot of a fixed place at 3,000 m/px.
// Usage: node critic/scripts/c13_y_latewar.mjs <seed> <save.bin> <cx> <cy> <tag>
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { launch, open1938, shot, save, lookAt, hours } from './c13_lib.mjs';

const [seedS, bin, cxS, cyS, tagS] = process.argv.slice(2);
const seed = Number(seedS);
const tag = `c13y_${seed}_${tagS ?? 'x'}`;
const out = { seed, bin, samples: [] };
const { browser, page, errors } = await launch();
try {
  const bytes = readFileSync(path.resolve(bin));
  await page.route('**/__critic_ck.bin', (r) => r.fulfill({ status: 200, body: bytes, contentType: 'application/octet-stream' }));
  await open1938(page, seed);
  await page.evaluate(async () => window.__warsim.sim.load(new Uint8Array(await (await fetch('/__critic_ck.bin')).arrayBuffer())));
  await page.evaluate(() => { try { window.__warsim.settings.nukePause.value = false; } catch {} });
  await hours(page, 1);
  for (let d = 0; d <= 60; d += 10) {
    if (d) await hours(page, 240);
    const s = await page.evaluate(async () => {
      const v = window.__warsim.view;
      const st = await window.__warsim.sim.inspect(true);
      const land = st.formations.filter((f) => !v.formationAfloat(f.id));
      return { land: land.length, engaged: land.filter((f) => v.formationEngaged(f.id)).length, date: document.querySelector('[data-testid=bottombar]')?.innerText.match(/\d+ \w+ \d{4}/)?.[0] ?? null, chips: document.querySelectorAll('[data-testid=war-chip]').length };
    });
    await lookAt(page, Number(cxS), Number(cyS), 3000);
    await shot(page, `${tag}_d${String(d).padStart(2, '0')}.png`);
    out.samples.push({ d, ...s });
    save(`c13_y_${seed}_${tagS}.json`, { ...out, errors });
  }
} catch (e) {
  out.fatal = String(e?.stack ?? e);
}
out.errors = errors;
save(`c13_y_${seed}_${tagS}.json`, out);
await browser.close();
console.log(JSON.stringify(out).slice(0, 3000));
