// Session F (run 5): God Mode inventory, editor inventory, and a save/load twin during an air war.
import { readFileSync } from 'node:fs';
import { launch, open1938, shot, save, hours, lookAt } from './c5_lib.mjs';
const seed = Number(process.argv[2] ?? 4471);
const tag = `c5f_${seed}`;
const tags = JSON.parse(readFileSync(new URL('../c5_tags.json', import.meta.url), 'utf8'));
const out = { seed, shots: [] };
const { browser, page, errors } = await launch();
try {
  await open1938(page, seed);
  // God Mode on France
  await page.evaluate((n) => window.__warsim.view.select(n), tags.FRA);
  await page.waitForTimeout(400);
  await page.getByTestId('god-btn').click().catch(() => page.locator('button', { hasText: 'God Mode' }).click());
  await page.waitForTimeout(400);
  const godTab = page.getByTestId('tab-god');
  if (await godTab.count()) await godTab.click();
  await page.waitForTimeout(400);
  out.godText = await page.getByTestId('panel-god').innerText().catch(() => null);
  out.godButtons = await page.locator('[data-testid=panel-god] button').allInnerTexts().catch(() => []);
  out.shots.push(await shot(page, `${tag}_00_god_tab.png`));
  await page.locator('button', { hasText: 'God Mode' }).click().catch(() => {});
  // editor
  await page.getByTestId('editor-btn').click();
  await page.waitForTimeout(500);
  out.editorText = await page.getByTestId('editor-panel').innerText().catch(() => null);
  out.shots.push(await shot(page, `${tag}_10_editor.png`));
  await page.getByTestId('editor-btn').click();
  // save/load twin in an air war: Italy on France
  await page.evaluate(({ a, d }) => window.__warsim.sim.command({ kind: 'declareWar', attacker: a, defender: d }), { a: tags.ITA, d: tags.FRA });
  await hours(page, 30);
  const aloft0 = await page.evaluate(() => window.__warsim.view.sorties.length / 11);
  const saved = await page.evaluate(async () => {
    const b = await window.__warsim.sim.saveWithStatus();
    window.__critSave = b.bytes;
    return { bytes: b.bytes.length, hash: b.status.hash, tick: b.status.tick };
  });
  out.saved = { ...saved, aloft: aloft0 };
  await hours(page, 72);
  const a = await page.evaluate(async () => (await window.__warsim.sim.hash()));
  await page.evaluate(async () => window.__warsim.sim.load(window.__critSave));
  await page.waitForTimeout(800);
  const atLoad = await page.evaluate(async () => (await window.__warsim.sim.hash()));
  await hours(page, 72);
  const b = await page.evaluate(async () => (await window.__warsim.sim.hash()));
  out.twin = { straight: a, atLoad, loaded: b, same: a.hash === b.hash && a.tick === b.tick };
  await lookAt(page, 1050, 320, 1200);
  out.shots.push(await shot(page, `${tag}_20_after_load.png`));
} catch (e) {
  out.fatal = String(e?.stack ?? e);
}
out.errors = errors;
save(`c5_f_${seed}.json`, out);
await browser.close();
console.log(JSON.stringify({ fatal: out.fatal, errors: errors.length, godButtons: out.godButtons, saved: out.saved, twin: out.twin }));
