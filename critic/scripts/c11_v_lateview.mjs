// Critic run 11, session V: a late war's border seen in the page (seed 6421, year 21): the
// Germany–Soviet and Brazil–Argentina wars at 6,000 and 1,500 m/px after 5 days at Max.
import { readFileSync } from 'node:fs';
import { launch, open1938, shot, save, lookAt, hours } from './c11_lib.mjs';
const { browser, page, errors } = await launch();
const out = { views: [] };
try {
  const bytes = readFileSync('critic/c11_seed6421_y20.bin');
  await page.route('**/__critic_ck.bin', (r) => r.fulfill({ status: 200, body: bytes, contentType: 'application/octet-stream' }));
  await open1938(page, 6421);
  await page.evaluate(async () => window.__warsim.sim.load(new Uint8Array(await (await fetch('/__critic_ck.bin')).arrayBuffer())));
  await hours(page, 24 * 5);
  for (const [name, x, y] of [['ger_sov', 1355, 282], ['bra_arg', 655, 732]]) {
    for (const m of [6000, 1500]) {
      await lookAt(page, x, y, m);
      await page.waitForTimeout(800);
      const p = await page.evaluate(() => ({ el: window.__warsim.view.elementCount ?? null, sorties: window.__warsim.view.sortieMarks?.length ?? null }));
      out.views.push({ name, m, ...p, file: await shot(page, `c11v_6421_${name}_${m}m.png`) });
    }
  }
} catch (e) { out.fatal = String(e?.stack ?? e); }
out.errors = errors; save('c11_v_6421.json', out); await browser.close(); console.log(JSON.stringify(out));
