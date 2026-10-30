// Critic run 19, session P3: the map-mode menu at several window widths: can an option be hit (elementFromPoint)?
import { launch, BASE, shot, save } from './c20_lib.mjs';
const out = [];
for (const [w, h] of [[1600, 900], [1366, 768], [1280, 720], [1180, 820], [1024, 768], [820, 1180], [768, 1024], [390, 844]]) {
  const { browser, page, errors } = await launch(w, h);
  const r = { w, h };
  try {
    await page.goto(`${BASE}/?scenario=1938&paused=1&seed=3301`);
    await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim.hud.stats.value !== null, null, { timeout: 120_000 });
    await page.waitForTimeout(1500);
    r.barOverflows = await page.evaluate(() => { const b = document.querySelector('[data-testid=bottombar]'); return [b.scrollWidth, b.clientWidth, b.scrollHeight, b.clientHeight]; });
    await page.getByTestId('mapmode-btn').click();
    await page.waitForTimeout(400);
    r.hits = await page.evaluate(() => [...document.querySelectorAll('[data-testid^=mapmode-opt-]')].filter((o) => { const q = o.getBoundingClientRect(); const hit = document.elementFromPoint(Math.min((q.left + q.right) / 2, innerWidth - 1), (q.top + q.bottom) / 2); return hit && (hit === o || o.contains(hit)); }).length);
    r.opts = await page.locator('[data-testid^=mapmode-opt-]').count();
    await shot(page, `c20p3_mapmenu_${w}x${h}.png`);
  } catch (e) { r.fatal = String(e).slice(0, 300); }
  r.errors = errors;
  out.push(r);
  await browser.close();
}
save('c20_p3_widths.json', out);
console.log(JSON.stringify(out));
