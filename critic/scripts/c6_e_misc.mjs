// Session E (run 6): a save/load twin with a warhead in flight and fallout on the ground; the language list;
// keys; the settings and editor inventories; phone width.
import { launch, open1938, shot, save, hours, lookAt, CELLS, BASE } from './c6_lib.mjs';
const seed = Number(process.argv[2] ?? 7043);
const tag = `c6e_${seed}`;
const T = CELLS.tags;
const out = { seed, shots: [] };
const { browser, page, errors } = await launch();
try {
  await page.goto(`${BASE}/`);
  await page.waitForTimeout(2500);
  out.shots.push(await shot(page, `${tag}_00_title.png`));
  out.titleText = await page.locator('body').innerText();
  await open1938(page, seed);
  out.languages = await page.evaluate(() => [...document.querySelectorAll('select')].map((s) => [...s.options].map((o) => o.textContent)).find((o) => o.includes('English')));
  // Keys.
  await page.evaluate((n) => window.__warsim.view.select?.(n), T.FRA);
  await page.waitForTimeout(400);
  const panel = () => page.getByTestId('nation-panel').count();
  out.panelBeforeEsc = await panel();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  out.panelAfterEsc = await panel();
  const mode = () => page.evaluate(() => window.__warsim.hud.mapMode.value);
  out.keys = {};
  for (const k of ['F2', 'F3', 'm', 'M', '2']) {
    await page.keyboard.press(k);
    await page.waitForTimeout(200);
    out.keys[k] = await mode();
  }
  await page.evaluate(() => window.__warsim.hud.setMapMode('political'));
  // Settings.
  await page.getByTestId('settings-btn').click();
  await page.waitForTimeout(400);
  out.settingsText = await page.locator('[data-testid=settings-panel], .settings-panel').first().innerText().catch(() => null);
  out.shots.push(await shot(page, `${tag}_10_settings.png`));
  await page.getByTestId('settings-btn').click();
  // Editor.
  await page.getByTestId('editor-btn').click();
  await page.waitForTimeout(500);
  out.editorText = await page.getByTestId('editor-panel').innerText().catch(() => null);
  out.shots.push(await shot(page, `${tag}_11_editor.png`));
  await page.getByTestId('editor-btn').click();
  await page.waitForTimeout(300);
  // Twin: France with warheads at war with Germany; a bomber warhead launched at Berlin; a God burst at Prague.
  await page.evaluate(({ f, g, b, p }) => {
    const s = window.__warsim.sim;
    s.command({ kind: 'setSetting', key: 'nukesEnabled', value: true });
    s.command({ kind: 'grantWarheads', nation: f, count: 3 });
    s.command({ kind: 'declareWar', attacker: g, defender: f });
    s.command({ kind: 'godNuke', x: p[0], y: p[1], thermonuclear: false });
  }, { f: T.FRA, g: T.GER, b: CELLS.berlin, p: CELLS.prague });
  await hours(page, 2);
  await page.evaluate(({ f, b }) => window.__warsim.sim.command({ kind: 'launchNuke', nation: f, x: b[0], y: b[1], missile: false }), { f: T.FRA, b: CELLS.berlin });
  await hours(page, 1);
  out.launchHistory = await page.evaluate(async () => (await window.__warsim.sim.history()).slice(-6));
  const saved = await page.evaluate(async () => {
    const b = await window.__warsim.sim.saveWithStatus();
    window.__critSave = b.bytes;
    return { bytes: b.bytes.length, hash: b.status.hash, tick: b.status.tick };
  });
  out.saved = saved;
  await hours(page, 96);
  const a = await page.evaluate(async () => await window.__warsim.sim.hash());
  out.historyStraight = await page.evaluate(async () => (await window.__warsim.sim.history()).slice(-8));
  await page.evaluate(async () => window.__warsim.sim.load(window.__critSave));
  await page.waitForTimeout(1000);
  await hours(page, 96);
  const b = await page.evaluate(async () => await window.__warsim.sim.hash());
  out.historyLoaded = await page.evaluate(async () => (await window.__warsim.sim.history()).slice(-8));
  out.twin = { straight: a, loaded: b, same: a.hash === b.hash && a.tick === b.tick };
  await page.evaluate(() => window.__warsim.hud.setMapMode('fallout'));
  await lookAt(page, CELLS.prague[0], CELLS.prague[1], 2500, false);
  await page.waitForTimeout(800);
  out.shots.push(await shot(page, `${tag}_20_fallout_after_load.png`));
  // Phone width.
  await page.evaluate(() => window.__warsim.hud.setMapMode('political'));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(1200);
  out.shots.push(await shot(page, `${tag}_30_phone.png`));
  out.nukeAlertPhone = await page.getByTestId('nuke-alert').boundingBox().catch(() => null);
} catch (e) {
  out.fatal = String(e?.stack ?? e);
}
out.errors = errors;
save(`c6_e_${seed}.json`, out);
await browser.close();
console.log(JSON.stringify({ fatal: out.fatal, errors: errors.length, langs: out.languages, esc: [out.panelBeforeEsc, out.panelAfterEsc], keys: out.keys, saved: out.saved, twin: out.twin }));
