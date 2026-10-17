// Critic run 7, session I: the editor (brush, city, flag editor present), export a scenario, start it from the title.
import { launch, BASE, open1938, shot, save, lookAt, CELLS, screenOf } from './c7_lib.mjs';
import path from 'node:path';

const seed = Number(process.argv[2] ?? 6203);
const tag = `c7i_${seed}`;
const T = CELLS.tags;
const out = { seed };
const { browser, page, errors } = await launch();
const tid = (id) => page.getByTestId(id);
try {
  await open1938(page, seed);
  await tid('editor-btn').click().catch(async () => page.getByRole('button', { name: 'Editor' }).click());
  await page.waitForTimeout(800);
  out.editorText = (await tid('editor-panel').innerText()).slice(0, 2000);
  await shot(page, `${tag}_00_editor.png`);
  // brush Germany over the Sahara (lon 15, lat 22 → cells by the Berlin offset is not linear; use the inspect's cities)
  const cities = (await page.evaluate(async () => (await window.__warsim.sim.inspect(true)).cities));
  const tripoli = cities.find((c) => c.name === 'Tripoli') ?? cities.find((c) => c.name === 'Cairo');
  await lookAt(page, tripoli.x, tripoli.y + 25, 5000);
  await page.locator('[data-testid="editor-tool-brush"]').click().catch(() => {});
  await tid('editor-layer').selectOption('nation');
  await tid('editor-nation').selectOption(String(T.GER));
  await tid('editor-radius').fill('8');
  await page.mouse.move(600, 450);
  await page.mouse.down();
  await page.mouse.move(1000, 520, { steps: 40 });
  await page.mouse.up();
  await page.waitForTimeout(1200);
  await shot(page, `${tag}_01_brush_sahara.png`);
  const sx = await screenOf(page, tripoli.x, tripoli.y + 25);
  out.ownerAfterBrush = await page.evaluate(async () => (await window.__warsim.sim.inspect()).rasters);
  // city
  const ct = page.locator('[data-testid="editor-tool-city"]');
  out.hasCity = await ct.count();
  if (out.hasCity) {
    await ct.click();
    await tid('editor-city-name').fill('Critiqueville');
    await page.mouse.click(800, 480);
    await page.waitForTimeout(1000);
    const c2 = (await page.evaluate(async () => (await window.__warsim.sim.inspect(true)).cities));
    out.cityAdded = c2.length - cities.length;
    out.critique = c2.find((c) => c.name === 'Critiqueville') ?? null;
    await shot(page, `${tag}_02_city.png`);
  }
  // export
  await tid('scenario-name').fill('Critic seven').catch(() => {});
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), tid('scenario-export').click()]);
  const file = path.join(path.resolve(import.meta.dirname, '..'), 'c7_critic.warsim-scenario');
  await dl.saveAs(file);
  out.exported = file;
  // title, load the file, start
  await page.goto(`${BASE}/`);
  await page.waitForTimeout(3000);
  await tid('title-scenario-file').setInputFiles(file);
  await page.waitForTimeout(2500);
  out.titleDetail = await tid('title-detail').innerText().catch(() => null);
  out.fileError = await tid('title-file-error').innerText().catch(() => null);
  await shot(page, `${tag}_03_title_loaded.png`);
  await page.getByRole('button', { name: 'Start' }).click();
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0, null, { timeout: 180_000 });
  await page.waitForTimeout(3000);
  const c3 = (await page.evaluate(async () => (await window.__warsim.sim.inspect(true)).cities));
  out.critiqueAfterLoad = c3.find((c) => c.name === 'Critiqueville') ?? null;
  out.rastersAfterLoad = await page.evaluate(async () => (await window.__warsim.sim.inspect()).rasters);
  await lookAt(page, tripoli.x, tripoli.y + 25, 5000);
  await shot(page, `${tag}_04_started_from_file.png`);
} catch (e) {
  out.fatal = String(e?.stack ?? e);
}
out.errors = errors;
save(`c7_i_${seed}.json`, out);
await browser.close();
console.log(JSON.stringify({ ...out, editorText: out.editorText?.slice(0, 600) }));
