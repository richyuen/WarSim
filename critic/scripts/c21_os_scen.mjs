// Critic run 21, session OS: a scenario file written by c689c2e4 (magic WARSIM-SCENARIO, .warsim-scenario) chosen
// on the title screen of HEAD (ADR-761 says old files still load); and the file the suite exported on HEAD: its magic.
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import path from 'node:path';
import { launch, BASE, shot, save } from './c21_lib.mjs';
const out = {};
const head = (f) => { try { const b = readFileSync(f); let raw = b; try { raw = gunzipSync(b); } catch {} return raw.subarray(0, 16).toString('latin1'); } catch (e) { return String(e).slice(0, 80); } };
out.oldMagic = head('critic/c10_critic_standoff.warsim-scenario');
out.newMagic = head('critic/c21_critic_standoff.warsim-scenario');
const { browser, page, errors } = await launch(1600, 900);
try {
  await page.goto(`${BASE}/`);
  await page.waitForTimeout(2500);
  await shot(page, 'c21os_title.png');
  out.titleAccept = await page.getByTestId('title-scenario-file').getAttribute('accept');
  await page.getByTestId('title-scenario-file').setInputFiles(path.resolve('critic/c10_critic_standoff.warsim-scenario'));
  await page.waitForTimeout(800);
  out.pending = await page.getByTestId('title-file-pending').innerText().catch(() => null);
  await Promise.all([page.waitForURL(/load=scenario/, { timeout: 30_000 }), page.getByTestId('title-file-start').click()]);
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim.hud.stats.value !== null, null, { timeout: 120_000 });
  await page.waitForTimeout(2000);
  out.loaded = await page.evaluate(() => ({ tick: window.__warsim.hud.tick.value, date: document.querySelector('[data-testid=date-label]')?.innerText }));
  await shot(page, 'c21os_old_scenario_loaded.png');
} catch (e) { out.fatal = String(e?.stack ?? e).slice(0, 600); }
out.errors = errors;
save('c21_os_scen.json', out);
await browser.close();
console.log(JSON.stringify(out, null, 1));
