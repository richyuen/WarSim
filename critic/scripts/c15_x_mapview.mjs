// Critic run 12, session X: a checkpoint's political map in the page: the world at 12,000 m/px and Europe-Russia
// at 6,000 m/px. Usage: node critic/scripts/c15_x_mapview.mjs <seed> <save.bin> <tag>
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { launch, open1938, shot, save, lookAt, hours } from './c15_lib.mjs';
const [seedS, bin, tag] = process.argv.slice(2);
const { browser, page, errors } = await launch();
const out = { seed: Number(seedS), bin, shots: [] };
try {
  const bytes = readFileSync(path.resolve(bin));
  await page.route('**/__critic_ck.bin', (r) => r.fulfill({ status: 200, body: bytes, contentType: 'application/octet-stream' }));
  await open1938(page, Number(seedS));
  await page.evaluate(async () => window.__warsim.sim.load(new Uint8Array(await (await fetch('/__critic_ck.bin')).arrayBuffer())));
  await hours(page, 1);
  await lookAt(page, 1024, 420, 12000);
  out.shots.push(await shot(page, `c15x_${seedS}_${tag}_world.png`));
  await lookAt(page, 1200, 280, 6000);
  out.shots.push(await shot(page, `c15x_${seedS}_${tag}_eurasia.png`));
} catch (e) { out.fatal = String(e?.stack ?? e); }
out.errors = errors; save(`c15_x_${seedS}_${tag}.json`, out); await browser.close(); console.log(JSON.stringify(out));
