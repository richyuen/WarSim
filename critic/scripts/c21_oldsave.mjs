// Critic run 18, R17-B1 re-run: an autosave from an older build (cfedb50a, run 17's 7019 y20) in the page's
// IndexedDB slot; record with no format (as on Pages before ADR-747) and, second case, with format=FMT (a record that
// claims the current format with bytes that do not fit). Continue pressed if offered.
// Usage: OUT=c21_os_x.json TAG=x node critic/scripts/c21_oldsave.mjs <save.bin> <seed> [format]
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { launch, BASE, shot, save } from './c21_lib.mjs';
const [bin, seedS, fmtS] = process.argv.slice(2);
const TAG = process.env.TAG ?? 'a';
const out = { bin, seed: Number(seedS), format: fmtS === undefined ? null : Number(fmtS), steps: [] };
const { browser, page, errors } = await launch();
try {
  const bytes = readFileSync(path.resolve(bin));
  await page.route('**/__critic_old.bin', (r) => r.fulfill({ status: 200, body: bytes, contentType: 'application/octet-stream' }));
  await page.goto(`${BASE}/`);
  await page.waitForTimeout(3000);
  await page.evaluate(async ({ seed, fmt }) => {
    const b = new Uint8Array(await (await fetch('/__critic_old.bin')).arrayBuffer());
    const rec = { slot: 'autosave', scenario: '1938', tick: 20 * 8760, savedAt: Date.now() - 86400000, bytes: b, seed, options: {} };
    if (fmt !== null) rec.format = fmt;
    await new Promise((res, rej) => { const r = indexedDB.open('warsim', 1); r.onupgradeneeded = () => r.result.createObjectStore('saves', { keyPath: 'slot' }); r.onsuccess = () => { const db = r.result; const t = db.transaction('saves', 'readwrite'); t.objectStore('saves').put(rec); t.oncomplete = () => { db.close(); res(); }; t.onerror = () => rej(t.error); }; r.onerror = () => rej(r.error); });
  }, { seed: out.seed, fmt: out.format });
  await page.reload();
  await page.waitForTimeout(3000);
  out.steps.push({ s: 'title', text: (await page.evaluate(() => document.body.innerText)).slice(0, 900), hasContinue: await page.getByTestId('title-continue').count(), shot: await shot(page, `c21os_${TAG}_00_title.png`) });
  if (await page.getByTestId('title-continue').count()) {
    await page.getByTestId('title-continue').click();
    await page.waitForTimeout(20000);
    out.steps.push({ s: 'after continue 20s', url: page.url(), text: (await page.evaluate(() => document.body.innerText)).slice(0, 900), tick: await page.evaluate(() => window.__warsim?.view?.lastTick ?? null), shot: await shot(page, `c21os_${TAG}_01_after_continue.png`) });
    out.hasContinueAfter = await page.getByTestId('title-continue').count();
    // new game still possible from here?
    const start = page.locator('button.start-btn');
    out.startButtons = await start.allInnerTexts();
  }
  await page.goto(`${BASE}/`); await page.waitForTimeout(3000);
  out.steps.push({ s: 'title again', text: (await page.evaluate(() => document.body.innerText)).slice(0, 500), shot: await shot(page, `c21os_${TAG}_02_title_again.png`) });
} catch (e) { out.fatal = String(e?.stack ?? e); }
out.errors = errors;
save(process.env.OUT ?? `c21_os_${TAG}.json`, out);
await browser.close();
console.log(JSON.stringify(out, null, 1).slice(0, 4000));
