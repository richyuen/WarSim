// Critic run 19, session P2: the map-mode menu on the phone (390 x 844): is it seen, and can a mode be chosen by a tap?
import { launch, BASE, shot, save } from './c21_lib.mjs';
const out = {};
const { browser, page, errors } = await launch(390, 844);
try {
  await page.goto(`${BASE}/?scenario=1938&paused=1&seed=3301`);
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim.hud.stats.value !== null, null, { timeout: 120_000 });
  await page.waitForTimeout(2000);
  out.btn = await page.evaluate(() => { const b = document.querySelector('[data-testid=mapmode-btn]'); const r = b.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; });
  await page.getByTestId('mapmode-btn').click();
  await page.waitForTimeout(500);
  out.menu = await page.evaluate(() => {
    const m = document.querySelector('[data-testid=mapmode-menu]');
    if (!m) return null;
    const r = m.getBoundingClientRect();
    const cs = getComputedStyle(m);
    const opts = [...m.querySelectorAll('[data-testid^=mapmode-opt-]')].map((o) => { const q = o.getBoundingClientRect(); const cx = (q.left + q.right) / 2, cy = (q.top + q.bottom) / 2; const hit = document.elementFromPoint(Math.min(cx, innerWidth - 1), cy); return { id: o.dataset.testid, r: [q.left, q.top, q.right, q.bottom].map(Math.round), hitIsIt: !!hit && (hit === o || o.contains(hit)), hit: hit ? (hit.className || hit.tagName) : null }; });
    const anc = []; let e = m.parentElement; while (e && anc.length < 4) { const s = getComputedStyle(e); anc.push({ cls: e.className, overflowX: s.overflowX, overflowY: s.overflowY }); e = e.parentElement; }
    return { r: [r.left, r.top, r.right, r.bottom].map(Math.round), display: cs.display, visibility: cs.visibility, z: cs.zIndex, opts, anc };
  });
  await shot(page, 'c21p2_phone_mapmenu_open.png');
  // Try to tap 'Terrain'.
  const terr = page.getByTestId('mapmode-opt-terrain');
  out.tapTerrain = await terr.click({ timeout: 3000 }).then(() => 'clicked').catch((e) => String(e).slice(0, 300));
  await page.waitForTimeout(500);
  out.modeAfter = await page.evaluate(() => document.querySelector('[data-testid=mapmode-btn]')?.dataset.mode);
  await shot(page, 'c21p2_phone_after_tap.png');
} catch (e) { out.fatal = String(e?.stack ?? e); }
out.errors = errors;
save('c21_p2_phone_menu.json', out);
await browser.close();
console.log(JSON.stringify(out, null, 1));
