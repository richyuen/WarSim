// Critic run 16, session DL (new): the History panel's CSV and JSON downloads on a year-20 save: do they download,
// how many rows, what columns, and do the counts match the panel's.
// Usage: node critic/scripts/c16_dl_export.mjs <seed> <save.bin>
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { BASE, save, shot } from './c16_lib.mjs';
const [seedS, bin] = process.argv.slice(2);
const out = { seed: Number(seedS), bin };
const browser = await chromium.launch();
const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1600, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e.message)));
try {
  const bytes = readFileSync(path.resolve(bin));
  await page.route('**/__critic_ck.bin', (r) => r.fulfill({ status: 200, body: bytes, contentType: 'application/octet-stream' }));
  await page.goto(`${BASE}/?scenario=1938&paused=1&seed=${seedS}`);
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim.hud.stats.value !== null, null, { timeout: 120_000 });
  await page.evaluate(async () => window.__warsim.sim.load(new Uint8Array(await (await fetch('/__critic_ck.bin')).arrayBuffer())));
  await page.waitForTimeout(2500);
  await page.getByRole('button', { name: 'History', exact: true }).click();
  await page.waitForSelector('[data-testid=history-row]', { timeout: 120_000 });
  out.count = await page.evaluate(() => document.querySelector('[data-testid=history-count]')?.innerText);
  for (const kind of ['csv', 'json']) {
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 30_000 }), page.getByTestId(`history-${kind}`).click()]);
    const p = path.resolve(`critic/c16_dl_${seedS}.${kind}`);
    await dl.saveAs(p);
    const text = readFileSync(p, 'utf8');
    out[kind] = { name: dl.suggestedFilename(), bytes: text.length, lines: text.split('\n').length, head: text.slice(0, 600) };
  }
  await shot(page, `c16dl_${seedS}_history.png`);
} catch (e) { out.fatal = String(e?.stack ?? e); }
out.errors = errors;
save(`c16_dl_${seedS}.json`, out);
await browser.close();
console.log(JSON.stringify(out).slice(0, 2500));
