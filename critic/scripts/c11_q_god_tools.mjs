// Critic run 11, session Q: God Mode's map tools used by clicks (revolt, spawn nation, found and raze a
// city), each followed by a day of play: what the ticker says, what the map shows.
// Usage: node critic/scripts/c11_q_god_tools.mjs <seed>
import { launch, open1938, shot, save, lookAt, CELLS, hours, screenOf } from './c11_lib.mjs';

const seed = Number(process.argv[2] ?? 6653);
const out = { seed, steps: [] };
const { browser, page, errors } = await launch();
const ticker = () => page.evaluate(() => document.body.innerText.split('\n').filter((l) => /19\d\d /.test(l)).slice(-8));
const living = () => page.evaluate(() => window.__warsim.hud.stats.value.nations.length);
const use = async (tool, x, y, m, name) => {
  await lookAt(page, x, y, m);
  await page.locator(`[data-testid=god-tool-${tool}]`).click();
  await page.waitForTimeout(300);
  const hint = await page.evaluate(() => document.querySelector('[data-testid=god-tool-hint]')?.innerText ?? null);
  const n0 = await living();
  const [sx, sy] = await screenOf(page, x, y);
  await page.mouse.click(sx, sy);
  await page.waitForTimeout(1200);
  const after = await ticker();
  await shot(page, `c11q_${seed}_${name}_0.png`);
  await hours(page, 24);
  await shot(page, `c11q_${seed}_${name}_1day.png`);
  out.steps.push({ name, hint, nations0: n0, nations1: await living(), tickerAfterClick: after, tickerDay: await ticker() });
  save(`c11_q_${seed}.json`, { ...out, errors });
};
try {
  await open1938(page, seed);
  await page.getByRole('button', { name: 'God Mode' }).click();
  await page.waitForTimeout(500);
  const [bx, by] = CELLS.berlin;
  await use('revolt', bx - 6, by + 10, 2500, 'revolt_bavaria');
  await use('nation', bx + 22, by - 2, 2500, 'spawn_poland_east');
  await use('city', bx + 3, by + 4, 600, 'found_city');
  await use('raze', CELLS.prague[0], CELLS.prague[1], 600, 'raze_prague');
} catch (e) {
  out.fatal = String(e?.stack ?? e);
}
out.errors = errors;
save(`c11_q_${seed}.json`, out);
await browser.close();
console.log(JSON.stringify(out, null, 1).slice(0, 4000));
