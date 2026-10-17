// Critic run 7, session I2: start the exported scenario from the title screen in a fresh browser.
import { launch, BASE, shot, save, lookAt, buttons } from './c7_lib.mjs';
import path from 'node:path';

const file = path.join(path.resolve(import.meta.dirname, '..'), 'c7_critic.warsim-scenario');
const out = {};
const { browser, page, errors } = await launch();
const tid = (id) => page.getByTestId(id);
try {
  await page.goto(`${BASE}/`);
  await tid('title-screen').waitFor({ timeout: 30000 });
  await tid('title-scenario-file').setInputFiles(file);
  await page.waitForTimeout(2500);
  out.detail = await tid('title-detail').innerText().catch(() => null);
  out.err = await tid('title-file-error').innerText().catch(() => null);
  out.buttons = await buttons(page);
  await shot(page, 'c7i2_00_title_with_file.png');
  if (await page.getByRole('button', { name: /^Start/ }).count()) await page.getByRole('button', { name: /^Start/ }).first().click();
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0, null, { timeout: 180_000 });
  await page.waitForTimeout(3000);
  const cities = await page.evaluate(async () => (await window.__warsim.sim.inspect(true)).cities);
  out.critique = cities.find((c) => c.name === 'Critiqueville') ?? null;
  out.rasters = await page.evaluate(async () => (await window.__warsim.sim.inspect()).rasters);
  if (out.critique) await lookAt(page, out.critique.x, out.critique.y, 4000);
  await shot(page, 'c7i2_01_started.png');
} catch (e) {
  out.fatal = String(e?.stack ?? e).slice(0, 800);
}
out.errors = errors;
save('c7_i2.json', out);
await browser.close();
console.log(JSON.stringify(out));
