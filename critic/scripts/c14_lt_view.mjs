// Critic run 14, session LT (new): a late armour fight seen in the page: a save, n days stepped, the formation by id
// viewed at 250, 80 and 25 m/px, 3 s live at x1 at 25 m/px.
// Usage: node critic/scripts/c14_lt_view.mjs <seed> <save.bin> <days> <formationId>
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { launch, open1938, shot, save, lookAt, hours } from './c14_lib.mjs';
const [seedS, bin, daysS, idS] = process.argv.slice(2);
const out = { seed: Number(seedS), bin, days: Number(daysS), id: Number(idS), views: [] };
const { browser, page, errors } = await launch();
try {
  const bytes = readFileSync(path.resolve(bin));
  await page.route('**/__critic_ck.bin', (r) => r.fulfill({ status: 200, body: bytes, contentType: 'application/octet-stream' }));
  await open1938(page, Number(seedS));
  await page.evaluate(async () => window.__warsim.sim.load(new Uint8Array(await (await fetch('/__critic_ck.bin')).arrayBuffer())));
  await page.evaluate(() => { try { window.__warsim.settings.nukePause.value = false; } catch {} });
  await hours(page, 24 * Number(daysS));
  const f = await page.evaluate(async (id) => { const s = await window.__warsim.sim.inspect(true); return s.formations.find((x) => x.id === id) ?? null; }, Number(idS));
  out.f = f;
  if (f) {
    for (const m of [250, 80, 25]) {
      await lookAt(page, f.x, f.y, m);
      out.views.push({ m, ...(await page.evaluate(() => { const v = window.__warsim.view; return { el: v.elementCount ?? null, ind: v.individualCount ?? null, contact: v.contactLinesShown?.length ?? null }; })) });
      await shot(page, `c14lt_${seedS}_${idS}_${m}m.png`);
    }
    await page.evaluate(() => { window.__warsim.hud.setSpeedLevel(0); if (window.__warsim.hud.paused.value) window.__warsim.hud.togglePause(); });
    await page.waitForTimeout(3000);
    await page.evaluate(() => { if (!window.__warsim.hud.paused.value) window.__warsim.hud.togglePause(); });
    out.views.push({ m: 'live25', ...(await page.evaluate(() => { const v = window.__warsim.view; return { el: v.elementCount ?? null, ind: v.individualCount ?? null, contact: v.contactLinesShown?.length ?? null }; })) });
    await shot(page, `c14lt_${seedS}_${idS}_25m_live.png`);
  }
} catch (e) { out.fatal = String(e?.stack ?? e); }
out.errors = errors;
save(`c14_lt_${seedS}_${idS}.json`, out);
await browser.close();
console.log(JSON.stringify(out));
