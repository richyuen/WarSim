// Critic run 10, session R: the title's "Random world" by clicks, then a year at Max.
import { launch, BASE, shot, save } from './c10_lib.mjs';

const out = {};
const { browser, page, errors } = await launch();
try {
  await page.goto(`${BASE}/`);
  await page.waitForTimeout(3000);
  await page.getByText('Random world').first().click();
  await page.waitForTimeout(1500);
  await shot(page, 'c10r_00_title_random.png');
  out.titleText = (await page.evaluate(() => document.body.innerText)).slice(0, 1500);
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  const t0 = Date.now();
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim.hud.stats.value !== null, null, { timeout: 180_000 });
  out.bootS = (Date.now() - t0) / 1000;
  await page.waitForTimeout(2000);
  await shot(page, 'c10r_01_boot.png');
  out.nations0 = await page.evaluate(() => window.__warsim.hud.stats.value.nations.length);
  await page.evaluate(() => { try { window.__warsim.settings.nukePause.value = false; } catch {} window.__warsim.hud.setSpeedLevel(99); if (window.__warsim.hud.paused.value) window.__warsim.hud.togglePause(); });
  const tk = await page.evaluate(() => window.__warsim.hud.tick.value);
  const w0 = Date.now();
  await page.waitForFunction((t) => window.__warsim.hud.tick.value >= t + 8760, tk, { timeout: 900_000, polling: 500 });
  out.yearS = (Date.now() - w0) / 1000;
  await page.evaluate(() => { if (!window.__warsim.hud.paused.value) window.__warsim.hud.togglePause(); });
  await page.waitForTimeout(1500);
  await shot(page, 'c10r_02_year1.png');
  out.nations1 = await page.evaluate(() => window.__warsim.hud.stats.value.nations.length);
  out.ticker = (await page.evaluate(() => document.body.innerText)).split('\n').filter((l) => /\d{4} /.test(l)).slice(0, 12);
} catch (e) {
  out.fatal = String(e?.stack ?? e);
}
out.errors = errors;
save('c10_r_random.json', out);
await browser.close();
console.log(JSON.stringify(out).slice(0, 2500));
