// Critic run 12, session M: the toy world; the settings panel; keys (space pauses, 1-9 map modes, Escape closes);
// a nation clicked on the map opens its panel; F2 screenshot key.
import { launch, BASE, open1938, shot, save, lookAt, CELLS, screenOf } from './c16_lib.mjs';

const out = { steps: [] };
const { browser, page, errors } = await launch();
try {
  await page.goto(`${BASE}/?scenario=toy&paused=1&seed=5`);
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0, null, { timeout: 120_000 });
  await page.waitForTimeout(2500);
  await shot(page, 'c16m_00_toy.png');
  out.toyText = (await page.evaluate(() => document.body.innerText)).slice(0, 400);
  await open1938(page, 4441);
  await lookAt(page, CELLS.berlin[0], CELLS.berlin[1], 3000);
  // space
  const p0 = await page.evaluate(() => window.__warsim.hud.paused.value);
  await page.mouse.move(800, 450);
  await page.keyboard.press('Space');
  await page.waitForTimeout(400);
  const p1 = await page.evaluate(() => window.__warsim.hud.paused.value);
  await page.keyboard.press('Space');
  out.steps.push({ s: 'space', p0, p1 });
  // number keys: map mode legend
  const modes = [];
  for (const k of ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']) {
    await page.keyboard.press(k);
    await page.waitForTimeout(500);
    modes.push({ k, legend: await page.evaluate(() => document.querySelector('[class*=legend]')?.innerText.split('\n')[0] ?? null) });
    if (['3', '6', '9'].includes(k)) await shot(page, `c16m_01_mode_${k}.png`);
  }
  out.steps.push({ s: 'modes', modes });
  await page.keyboard.press('1');
  // click a nation on the map
  const [px, py] = await screenOf(page, CELLS.prague[0] + 1, CELLS.prague[1] + 1);
  await page.mouse.click(px, py);
  await page.waitForTimeout(800);
  out.steps.push({ s: 'click nation', panel: (await page.evaluate(() => document.body.innerText)).match(/Czechoslovakia[\s\S]{0,200}/)?.[0] ?? null });
  await shot(page, 'c16m_02_nation_panel.png');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  // settings
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.waitForTimeout(800);
  out.settingsText = (await page.evaluate(() => document.body.innerText)).match(/Settings[\s\S]{0,1500}/)?.[0] ?? null;
  await shot(page, 'c16m_03_settings.png');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  out.afterEscape = await page.evaluate(() => /Settings\n×/.test(document.body.innerText));
  // F2
  const dl = page.waitForEvent('download', { timeout: 5000 }).catch(() => null);
  await page.keyboard.press('F2');
  const d = await dl;
  out.f2 = d ? d.suggestedFilename() : null;
} catch (e) {
  out.fatal = String(e?.stack ?? e);
}
out.errors = errors;
save('c16_m.json', out);
await browser.close();
console.log(JSON.stringify(out).slice(0, 4000));
