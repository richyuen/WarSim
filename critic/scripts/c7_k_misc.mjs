// Critic run 7, session K: God nuke aftermath at T2/T3 ten days on, the air mode and its legend, settings, the
// order arrows at T1 with and without a selection, phone width.
import { launch, BASE, open1938, shot, save, lookAt, hours, CELLS, screenOf, run, pause } from './c7_lib.mjs';

const seed = Number(process.argv[2] ?? 8217);
const tag = `c7k_${seed}`;
const T = CELLS.tags;
const out = { seed };
const { browser, page, errors } = await launch();
try {
  await open1938(page, seed);
  const [bx, by] = CELLS.berlin;
  await lookAt(page, bx, by, 150);
  await shot(page, `${tag}_00_berlin_150_before.png`);
  await lookAt(page, bx, by, 20);
  await shot(page, `${tag}_01_berlin_20_before.png`);
  // war so there is air activity; God nuke on Berlin by command (the God tool sends this)
  await page.evaluate(({ a, d }) => window.__warsim.sim.command({ kind: 'declareWar', attacker: a, defender: d }), { a: T.GER, d: T.POL });
  await page.evaluate(({ x, y }) => window.__warsim.sim.command({ kind: 'godNuke', x: x, y: y, thermonuclear: false }), { x: bx, y: by });
  await hours(page, 2);
  await lookAt(page, bx, by, 1500, false);
  await page.waitForTimeout(1200);
  await shot(page, `${tag}_02_burst_1500.png`);
  out.alert = await page.evaluate(() => JSON.parse(JSON.stringify(window.__warsim.hud.nukeAlert.value)));
  await hours(page, 24 * 10);
  await lookAt(page, bx, by, 150);
  await shot(page, `${tag}_03_berlin_150_day10.png`);
  await lookAt(page, bx, by, 20);
  await shot(page, `${tag}_04_berlin_20_day10.png`);
  // air mode
  await page.evaluate(() => window.__warsim.hud.setMapMode('airControl'));
  await lookAt(page, CELLS.polfront[0], CELLS.polfront[1], 3000);
  await page.waitForTimeout(800);
  await shot(page, `${tag}_05_air_mode.png`);
  out.airLegend = await page.evaluate(() => [...document.querySelectorAll('[class*=legend]')].map((e) => e.innerText).join(' | '));
  await page.evaluate(() => window.__warsim.hud.setMapMode('fallout'));
  await lookAt(page, bx, by, 1500);
  await shot(page, `${tag}_06_fallout.png`);
  await page.evaluate(() => window.__warsim.hud.setMapMode('political'));
  // T1 order arrows: none selected vs a formation selected
  await lookAt(page, CELLS.polfront[0], CELLS.polfront[1], 900);
  await shot(page, `${tag}_07_t1_noselect.png`);
  // panel for Germany: nuclear lines?
  const [gx, gy] = await screenOf(page, bx - 8, by + 6);
  await lookAt(page, bx, by, 2500);
  const [gx2, gy2] = await screenOf(page, bx - 8, by + 6);
  await page.mouse.click(gx2, gy2);
  await page.waitForTimeout(800);
  out.germanyPanel = await page.evaluate(() => document.querySelector('.nation-panel')?.innerText ?? null);
  await shot(page, `${tag}_08_germany_panel.png`);
  // charts options
  await page.getByRole('button', { name: 'Charts' }).click();
  await page.waitForTimeout(800);
  out.chartOptions = await page.evaluate(() => [...document.querySelectorAll('select option')].map((o) => o.textContent).slice(0, 80));
  await shot(page, `${tag}_09_charts.png`);
  await page.keyboard.press('Escape');
  // settings
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.waitForTimeout(600);
  out.settings = await page.evaluate(() => document.body.innerText.slice(0, 3000));
  await shot(page, `${tag}_10_settings.png`);
  await page.keyboard.press('Escape');
  // history
  await page.getByRole('button', { name: 'History' }).click();
  await page.waitForTimeout(600);
  await shot(page, `${tag}_11_history.png`);
  await page.keyboard.press('Escape');
  // phone
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(1500);
  await shot(page, `${tag}_12_phone.png`);
  out.phoneOverflow = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, w: innerWidth }));
} catch (e) {
  out.fatal = String(e?.stack ?? e);
}
out.errors = errors;
save(`c7_k_${seed}.json`, out);
await browser.close();
console.log(JSON.stringify({ ...out, settings: out.settings?.slice(0, 400), chartOptions: out.chartOptions }));
