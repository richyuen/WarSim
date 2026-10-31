// Critic run 21, session OS: a scenario file written by c689c2e4 (magic WARSIM-SCENARIO, .warsim-scenario) chosen
// on the title screen of HEAD (ADR-761 says old files still load); and the file the suite exported on HEAD: its magic.
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import path from 'node:path';
import { launch, BASE, shot, save } from './c21_lib.mjs';
const FILE = process.argv[2] ?? 'critic/c10_critic_standoff.warsim-scenario';
const TAG = process.argv[3] ?? 'c10';
const out = { file: FILE };
const head = (f) => { try { const b = readFileSync(f); let raw = b; try { raw = gunzipSync(b); } catch {} return raw.subarray(0, 16).toString('latin1'); } catch (e) { return String(e).slice(0, 80); } };
out.oldMagic = head(FILE);
out.newMagic = head('critic/c21_critic_standoff.warsim-scenario');
const { browser, page, errors } = await launch(1600, 900);
try {
  await page.goto(`${BASE}/`);
  await page.waitForTimeout(2500);
  await shot(page, `c21os2_${TAG}_title.png`);
  out.titleAccept = await page.getByTestId('title-scenario-file').getAttribute('accept');
  await page.getByTestId('title-scenario-file').setInputFiles(path.resolve(FILE));
  await page.waitForTimeout(800);
  out.pending = await page.getByTestId('title-file-pending').innerText().catch(() => null);
  const t0 = Date.now();
  await Promise.all([page.waitForURL(/load=scenario/, { timeout: 30_000 }), page.getByTestId('title-file-start').click()]);
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim.hud.stats.value !== null, null, { timeout: 300_000 }).catch(async (e) => { out.stuck = { url: page.url(), text: (await page.evaluate(() => document.body.innerText)).slice(0, 800), frames: await page.evaluate(() => window.__warsim?.view?.frames ?? null), stats: await page.evaluate(() => window.__warsim?.hud?.stats?.value !== null && window.__warsim?.hud?.stats?.value !== undefined) }; await shot(page, `c21os2_${TAG}_stuck.png`); throw e; });
  out.loadS = (Date.now() - t0) / 1000;
  await page.waitForTimeout(2000);
  out.loaded = await page.evaluate(() => ({ tick: window.__warsim.hud.tick.value, date: document.querySelector('[data-testid=date-label]')?.innerText }));
  await shot(page, `c21os2_${TAG}_loaded.png`);
} catch (e) { out.fatal = String(e?.stack ?? e).slice(0, 600); }
out.errors = errors;
save(`c21_os2_${TAG}.json`, out);
await browser.close();
console.log(JSON.stringify(out, null, 1));
