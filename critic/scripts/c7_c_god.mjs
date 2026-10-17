// Critic run 7, session C: God Mode by clicks. Select Germany, God Mode, read the tab, use its tools.
import { launch, BASE, shot, save, lookAt, CELLS, maxSpeed, run, pause, buttons, hours, screenOf } from './c7_lib.mjs';

const seed = Number(process.argv[2] ?? 4419);
const out = { seed, steps: [] };
const { browser, page, errors } = await launch();
const S = async (n) => shot(page, `c7c_${seed}_${n}.png`);
const txt = () => page.evaluate(() => document.body.innerText);
const step = async (name, fn) => {
  try {
    const r = await fn();
    out.steps.push({ name, ok: true, r });
  } catch (e) {
    out.steps.push({ name, ok: false, err: String(e).slice(0, 400) });
  }
  save(`c7_c_${seed}.json`, { ...out, errors });
};
await page.goto(`${BASE}/?scenario=1938&paused=1&seed=${seed}`);
await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0, null, { timeout: 180_000 });
await page.waitForTimeout(2500);
const [bx, by] = CELLS.berlin;
await lookAt(page, bx, by, 2500);
await page.getByRole('button', { name: 'God Mode' }).click();
await page.waitForTimeout(600);
await S('00_godmode_on');
out.godOnText = (await txt()).slice(0, 3000);
out.godOnButtons = await buttons(page);
// select Germany by clicking land west of Berlin
const [gx, gy] = await screenOf(page, bx - 8, by + 6);
await page.mouse.click(gx, gy);
await page.waitForTimeout(1200);
await S('01_germany_selected');
out.panelText = (await txt()).slice(0, 5000);
out.panelButtons = await buttons(page);
save(`c7_c_${seed}.json`, { ...out, errors });
// Click a "God" tab inside the panel if any
await step('godTab', async () => {
  const tab = page.getByRole('button', { name: /^God/ }).last();
  await tab.click({ timeout: 3000 });
  await page.waitForTimeout(800);
  await S('02_god_tab');
  return { text: (await txt()).slice(0, 6000), buttons: await buttons(page) };
});
await browser.close();
