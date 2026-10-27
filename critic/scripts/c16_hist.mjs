// Critic run 16, session HI (new): a year-20 save: the History panel opened (time to first row, row count shown),
// filtered by kind, the charts panel, the nation panel of the leader; how long each takes and what it shows.
// Usage: node critic/scripts/c16_hist.mjs <seed> <save.bin>
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { launch, open1938, shot, save } from './c16_lib.mjs';
const [seedS, bin] = process.argv.slice(2);
const out = { seed: Number(seedS), bin };
const { browser, page, errors } = await launch();
try {
  const bytes = readFileSync(path.resolve(bin));
  await page.route('**/__critic_ck.bin', (r) => r.fulfill({ status: 200, body: bytes, contentType: 'application/octet-stream' }));
  await open1938(page, Number(seedS));
  await page.evaluate(async () => window.__warsim.sim.load(new Uint8Array(await (await fetch('/__critic_ck.bin')).arrayBuffer())));
  await page.waitForTimeout(2500);
  let t0 = Date.now();
  await page.getByRole('button', { name: 'History', exact: true }).click();
  await page.waitForSelector('[data-testid=history-row]', { timeout: 120_000 });
  out.historyOpenMs = Date.now() - t0;
  out.count = await page.evaluate(() => document.querySelector('[data-testid=history-count]')?.innerText);
  out.rowsInDom = await page.locator('[data-testid=history-row]').count();
  out.kinds = await page.evaluate(() => [...document.querySelectorAll('[data-testid=history-kind] option')].map((o) => o.textContent));
  out.firstRows = await page.evaluate(() => [...document.querySelectorAll('[data-testid=history-row]')].slice(0, 12).map((r) => r.innerText.replace(/\n/g, ' ')));
  await shot(page, `c16hi_${seedS}_history.png`);
  // filter by each kind: the count shown
  const opts = await page.evaluate(() => [...document.querySelectorAll('[data-testid=history-kind] option')].map((o) => [o.value, o.textContent]));
  out.byKind = [];
  for (const [v, label] of opts) {
    if (!v) continue;
    t0 = Date.now();
    await page.selectOption('[data-testid=history-kind]', v);
    await page.waitForTimeout(150);
    out.byKind.push({ label, count: await page.evaluate(() => document.querySelector('[data-testid=history-count]')?.innerText), ms: Date.now() - t0 });
  }
  await page.selectOption('[data-testid=history-kind]', '');
  await page.getByTestId('history-close').click();
  t0 = Date.now();
  await page.getByRole('button', { name: 'Charts', exact: true }).click();
  await page.waitForTimeout(1500);
  out.chartsMs = Date.now() - t0;
  await shot(page, `c16hi_${seedS}_charts.png`);
  out.chartsText = (await page.evaluate(() => document.body.innerText)).slice(0, 600);
} catch (e) { out.fatal = String(e?.stack ?? e); }
out.errors = errors;
save(`c16_hi_${seedS}.json`, out);
await browser.close();
console.log(JSON.stringify(out).slice(0, 4000));
