// Critic run 12, session T: the nation panel's nuclear restraint line (PLAN 7.37f) for every nation
// that shows one, from a headless save; then 30 days on, again. Screenshots of the first few panels.
// Usage: node critic/scripts/c16_t_restraint.mjs <seed> <save.bin>
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { launch, open1938, shot, save, hours, lookAt } from './c16_lib.mjs';

const seed = Number(process.argv[2]);
const bin = process.argv[3];
const out = { seed, bin, rounds: [] };
const { browser, page, errors } = await launch();
try {
  const bytes = readFileSync(path.resolve(bin));
  await page.route('**/__critic_ck.bin', (r) => r.fulfill({ status: 200, body: bytes, contentType: 'application/octet-stream' }));
  await open1938(page, seed);
  await page.evaluate(async () => {
    const b = new Uint8Array(await (await fetch('/__critic_ck.bin')).arrayBuffer());
    return window.__warsim.sim.load(b);
  });
  await page.waitForTimeout(3000);
  await lookAt(page, 1100, 330, 9000);
  for (let round = 0; round < 3; round++) {
    if (round) await hours(page, 24 * 30);
    const rows = [];
    let shots = 0;
    for (let id = 1; id < 200; id++) {
      await page.evaluate((id) => window.__warsim.hud.onSelectNation(id), id);
      await page.waitForTimeout(60);
      const r = await page.evaluate(() => {
        const el = document.querySelector('[data-testid=nation-restraint]');
        const panel = el?.closest('[class*=panel]');
        return el ? { reason: el.getAttribute('data-reason'), text: el.innerText, head: (panel?.innerText ?? '').split('\n').slice(0, 3).join(' | ') } : null;
      });
      if (r) {
        rows.push({ id, ...r });
        if (shots < 3 && round === 0) { shots++; await shot(page, `c16t_${seed}_r${round}_n${id}.png`); }
      }
    }
    await page.evaluate(() => window.__warsim.hud.onSelectNation(0));
    const date = await page.evaluate(() => document.querySelector('[data-testid=bottombar]')?.innerText.match(/\d+ \w+ \d{4}/)?.[0] ?? null);
    out.rounds.push({ round, date, rows });
    save(`c16_t_${seed}.json`, { ...out, errors });
  }
} catch (e) {
  out.fatal = String(e?.stack ?? e);
}
out.errors = errors;
save(`c16_t_${seed}.json`, out);
await browser.close();
console.log(JSON.stringify(out.rounds.map((r) => [r.date, r.rows.map((x) => `${x.id}:${x.reason}`)])));
