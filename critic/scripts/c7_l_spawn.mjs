// Critic run 7, session L: God Mode's Spawn nation by clicks (does a nation appear?) and Kill.
import { launch, open1938, shot, save, lookAt, CELLS, screenOf, hours } from './c7_lib.mjs';

const seed = Number(process.argv[2] ?? 5150);
const tag = `c7l_${seed}`;
const out = { seed };
const { browser, page, errors } = await launch();
const living = () => page.evaluate(async () => (await window.__warsim.sim.inspect()).nations.filter((n) => n.living).length);
try {
  await open1938(page, seed);
  const [px, py] = CELLS.paris;
  await lookAt(page, px, py, 2500);
  await page.getByRole('button', { name: 'God Mode' }).click();
  const [sx, sy] = await screenOf(page, px + 3, py + 2);
  await page.mouse.click(sx, sy);
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: 'God', exact: true }).click();
  out.before = await living();
  await page.getByRole('button', { name: 'Spawn nation' }).click();
  await page.waitForTimeout(300);
  await page.mouse.click(sx, sy);
  await hours(page, 2);
  await page.waitForTimeout(800);
  out.after = await living();
  const ins = await page.evaluate(async () => (await window.__warsim.sim.inspect()).nations.filter((n) => n.living).slice(-3).map((n) => ({ id: n.id, name: n.name ?? n.nameKey, area: n.area })));
  out.newest = ins;
  await shot(page, `${tag}_00_spawned.png`);
  const hist = await page.evaluate(() => window.__warsim.sim.history());
  out.histTail = hist.slice(-3);
} catch (e) {
  out.fatal = String(e?.stack ?? e);
}
out.errors = errors;
save(`c7_l_${seed}.json`, out);
await browser.close();
console.log(JSON.stringify(out).slice(0, 2000));
