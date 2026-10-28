// Critic run 17, session OS (new): a player's autosave from the build before (run 16's 7b883084 save of 3847,
// year 26) in the page's IndexedDB slot, as after a deploy to Pages; the title's Continue pressed. What does the
// player see? Usage: node critic/scripts/c17_oldsave.mjs <save.bin> <seed>
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { launch, BASE, shot, save } from './c17o_lib.mjs';
const [bin, seedS] = process.argv.slice(2);
const out = { bin, seed: Number(seedS), steps: [] };
const { browser, page, errors } = await launch();
try {
  const bytes = readFileSync(path.resolve(bin));
  await page.route('**/__critic_old.bin', (r) => r.fulfill({ status: 200, body: bytes, contentType: 'application/octet-stream' }));
  await page.goto(`${BASE}/`);
  await page.waitForTimeout(3000);
  await page.evaluate(async (seed) => {
    const b = new Uint8Array(await (await fetch('/__critic_old.bin')).arrayBuffer());
    await new Promise((res, rej) => { const r = indexedDB.open('warsim', 1); r.onupgradeneeded = () => r.result.createObjectStore('saves', { keyPath: 'slot' }); r.onsuccess = () => { const db = r.result; const t = db.transaction('saves', 'readwrite'); t.objectStore('saves').put({ slot: 'autosave', scenario: '1938', tick: 25 * 8760, savedAt: Date.now() - 86400000, bytes: b, seed, options: {} }); t.oncomplete = () => { db.close(); res(); }; t.onerror = () => rej(t.error); }; r.onerror = () => rej(r.error); });
  }, out.seed);
  await page.reload();
  await page.waitForTimeout(3000);
  out.steps.push({ s: 'title', text: (await page.evaluate(() => document.body.innerText)).slice(0, 600), shot: await shot(page, 'c17oos_00_title.png') });
  await page.getByTestId('title-continue').click();
  await page.waitForTimeout(20000);
  out.steps.push({ s: 'after continue 20s', url: page.url(), text: (await page.evaluate(() => document.body.innerText)).slice(0, 800), tick: await page.evaluate(() => window.__warsim?.view?.lastTick ?? null), shot: await shot(page, 'c17oos_01_after_continue.png') });
  out.inspect = await page.evaluate(async () => { const st = await window.__warsim.sim.inspect(true); const v = window.__warsim.view; return { tick: v.lastTick, formations: st.formations.length, sample: st.formations.slice(0, 5).map((f) => ({ id: f.id, nation: f.nation, x: Math.round(f.x), y: Math.round(f.y), t: v.formationTitle(f.id) })), wars: (st.wars ?? []).length }; });
  await page.evaluate(() => window.__warsim.hud.togglePause());
  await page.waitForTimeout(30000);
  out.steps.push({ s: 'resumed 30s', text: (await page.evaluate(() => document.body.innerText)).slice(0, 400), tick: await page.evaluate(() => window.__warsim?.view?.lastTick ?? null), shot: await shot(page, 'c17oos_02_resumed30s.png') });
  await page.goto(`${BASE}/`); await page.waitForTimeout(3000);
  out.steps.push({ s: 'title again', text: (await page.evaluate(() => document.body.innerText)).slice(0, 200) });
} catch (e) { out.fatal = String(e?.stack ?? e); }
out.errors = errors;
save('c17o_os.json', out);
await browser.close();
console.log(JSON.stringify(out, null, 1).slice(0, 3000));
