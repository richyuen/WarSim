// Critic run 16, session Y2: a late world watched 60 days from a headless save: every 10 days the engaged land
// formations the page shows (with where they are), the war chips, and a shot at 3,000 m/px on the engaged
// formations (or Europe if none), and at 250 m/px on the first engaged one.
// Usage: node critic/scripts/c16_y2_latewar.mjs <seed> <save.bin> <tag>
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { launch, open1938, shot, save, lookAt, hours, CELLS } from './c16_lib.mjs';
const [seedS, bin, tagS] = process.argv.slice(2);
const seed = Number(seedS);
const tag = `c16y2_${seed}_${tagS ?? 'x'}`;
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
      const eng = land.filter((f) => v.formationEngaged(f.id)).map((f) => ({ id: f.id, n: f.nation, x: Math.round(f.x), y: Math.round(f.y) }));
      return { land: land.length, engaged: eng.length, eng, date: document.querySelector('[data-testid=bottombar]')?.innerText.match(/\d+ \w+ \d{4}/)?.[0] ?? null, chips: [...document.querySelectorAll('[data-testid=war-chip]')].map((c) => c.innerText.replace(/\n/g, ' ')) };
    });
    let cx = CELLS.berlin[0], cy = CELLS.berlin[1];
    if (s.eng.length) { cx = s.eng[0].x; cy = s.eng[0].y; }
    await lookAt(page, cx, cy, 3000);
    await shot(page, `${tag}_d${String(d).padStart(2, '0')}_3000m.png`);
    if (s.eng.length && (d === 0 || d === 30 || d === 60)) { await lookAt(page, cx, cy, 250); await shot(page, `${tag}_d${String(d).padStart(2, '0')}_250m.png`); }
    out.samples.push({ d, ...s, eng: s.eng.slice(0, 40) });
    save(`c16_y2_${seed}_${tagS}.json`, { ...out, errors });
  }
} catch (e) { out.fatal = String(e?.stack ?? e); }
out.errors = errors;
save(`c16_y2_${seed}_${tagS}.json`, out);
await browser.close();
console.log(JSON.stringify(out.samples.map((s) => [s.d, s.date, s.engaged, s.land, s.chips.length])));
