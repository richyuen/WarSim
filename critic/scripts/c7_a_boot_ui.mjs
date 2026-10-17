// Critic run 7, session A: title, new game form, boot, HUD, God tab, rankings, keys, tiers, then
// a few years at Max with wall time per year. Usage: node critic/scripts/c7_a_boot_ui.mjs <seed>
import { launch, BASE, shot, save, lookAt, CELLS, settle, maxSpeed, buttons, run, pause, inspect } from './c7_lib.mjs';

const seed = Number(process.argv[2] ?? 5527);
const years = Number(process.argv[3] ?? 4);
const out = { seed, shots: [], notes: {} };
const { browser, page, errors } = await launch();
const S = async (n) => out.shots.push(await shot(page, `c7a_${seed}_${n}.png`));

// Title screen
await page.goto(`${BASE}/`);
await page.waitForTimeout(4000);
await S('00_title');
out.notes.titleButtons = await buttons(page);
out.notes.titleText = (await page.evaluate(() => document.body.innerText)).slice(0, 1500);
// Try to open the new-game options by clicking the first 1938-ish card / "New game"
const newGame = page.getByText(/new game|1938/i).first();
try {
  await newGame.click({ timeout: 3000 });
  await page.waitForTimeout(1500);
  await S('01_after_click');
  out.notes.afterClickButtons = await buttons(page);
  out.notes.afterClickText = (await page.evaluate(() => document.body.innerText)).slice(0, 2000);
} catch (e) {
  out.notes.newGameErr = String(e).slice(0, 300);
}

// The game itself
const t0 = Date.now();
await page.goto(`${BASE}/?scenario=1938&paused=1&seed=${seed}`);
await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0, null, { timeout: 180_000 });
await page.waitForFunction(() => window.__warsim.hud.stats.value !== null && window.__warsim.sim.mapLayers !== null, null, { timeout: 180_000 });
out.notes.bootMs = Date.now() - t0;
await page.waitForTimeout(2000);
await S('02_boot');
out.notes.hudButtons = await buttons(page);
out.notes.hudText = (await page.evaluate(() => document.body.innerText)).slice(0, 2500);

// Europe at tiers
const [bx, by] = CELLS.berlin;
for (const m of [6000, 2500, 900, 300, 80, 20]) {
  await lookAt(page, bx, by, m);
  await page.waitForTimeout(500);
  await S(`10_berlin_${m}m`);
}
// Click a nation (Germany) via selection
await lookAt(page, bx, by, 2500);
await page.mouse.move(800, 450);
await page.waitForTimeout(800);
await S('11_hover_tooltip');
out.notes.tooltip = await page.evaluate(() => document.body.innerText.slice(0, 3000));
await page.mouse.click(800, 450);
await page.waitForTimeout(1200);
await S('12_click_nation');
out.notes.nationPanelText = await page.evaluate(() => document.body.innerText.slice(0, 4000));
out.notes.nationButtons = await buttons(page);
// Escape
await page.keyboard.press('Escape');
await page.waitForTimeout(600);
await S('13_after_escape');
out.notes.afterEscapeSelected = await page.evaluate(() => window.__warsim.hud.selected.value);
// number keys -> map modes
out.notes.modes = {};
for (const k of ['1', '2', '3', '4', '5', '6', '7', '8', '9']) {
  await page.keyboard.press(k);
  await page.waitForTimeout(500);
  out.notes.modes[k] = await page.evaluate(() => window.__warsim.hud.mapMode.value);
  await S(`14_key_${k}`);
}
await page.keyboard.press('1');

// God tab
await page.evaluate(() => window.__warsim.hud.toggleGod());
await page.waitForTimeout(800);
await S('20_god');
out.notes.godText = await page.evaluate(() => document.body.innerText.slice(0, 4000));
out.notes.godButtons = await buttons(page);
await page.evaluate(() => window.__warsim.hud.toggleGod());

// Rankings (stats) and charts, history
for (const m of ['land', 'army', 'gold', 'population']) {
  try {
    await page.evaluate((m) => window.__warsim.hud.setRankMetric(m), m);
  } catch {}
}
await page.waitForTimeout(500);
await S('21_rank');
out.notes.rankOptions = await page.evaluate(() => [...document.querySelectorAll('select option')].map((o) => o.textContent));

// Run at Max for N years
await page.evaluate(() => window.__warsim.hud.setMapMode('political'));
await lookAt(page, bx, by, 2500);
await maxSpeed(page);
await run(page);
out.years = [];
for (let y = 1; y <= years; y++) {
  const w0 = Date.now();
  const startTick = await page.evaluate(() => window.__warsim.hud.tick.value);
  await page.waitForFunction((t) => window.__warsim.hud.tick.value >= t + 8760, startTick, { timeout: 900_000, polling: 1000 });
  const wall = (Date.now() - w0) / 1000;
  const fps = await page.evaluate(() => window.__warsim.view.fps?.value ?? window.__warsim.view.fps ?? null).catch(() => null);
  out.years.push({ y, wallS: wall, fps, date: await page.evaluate(() => String(window.__warsim.hud.date())) });
  await S(`30_year${y}_europe`);
  save(`c7_a_${seed}.json`, { ...out, errors });
}
await pause(page);
await lookAt(page, 1024, 400, 12000);
await S('31_world_end');
await lookAt(page, bx, by, 2500);
await S('32_europe_end');
// history
await page.evaluate(() => window.__warsim.hud.toggleHistory());
await page.waitForTimeout(800);
await S('33_history');
out.notes.history = await page.evaluate(() => document.body.innerText.slice(0, 5000));
await page.evaluate(() => window.__warsim.hud.toggleHistory());
await page.evaluate(() => window.__warsim.hud.toggleCharts());
await page.waitForTimeout(800);
await S('34_charts');
out.errors = errors;
save(`c7_a_${seed}.json`, out);
await browser.close();
