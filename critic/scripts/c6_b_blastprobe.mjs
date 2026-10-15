// Session B (run 6): what a God nuke on Berlin does to the men standing there, as the player sees it at T3.
import { launch, open1938, lookAt, shot, save, CELLS, screenOf, hours, inspect } from './c6_lib.mjs';
const seed = Number(process.argv[2] ?? 4127);
const tag = `c6b_${seed}`;
const out = { seed };
const { browser, page, errors } = await launch();
const near = async () => {
  const ins = await page.evaluate(() => window.__warsim.sim.inspect(true));
  const [bx, by] = CELLS.berlin;
  const f = ins.formations.filter((f) => Math.hypot((f.x ?? 0) - bx, (f.y ?? 0) - by) < 6);
  return { n: f.length, men: f.reduce((s, x) => s + (x.strength ?? x.men ?? 0), 0), list: f.slice(0, 12).map((x) => ({ id: x.id, nation: x.nation, s: x.strength ?? x.men, d: +Math.hypot(x.x - bx, x.y - by).toFixed(2) })) };
};
try {
  await open1938(page, seed);
  const ins0 = await page.evaluate(() => window.__warsim.sim.inspect(true));
  out.formationKeys = Object.keys(ins0.formations[0] ?? {});
  out.before = await near();
  await lookAt(page, CELLS.berlin[0], CELLS.berlin[1], 20);
  out.shots = [await shot(page, `${tag}_00_berlin_20m_before.png`)];
  await page.getByTestId('god-btn').click();
  await lookAt(page, CELLS.berlin[0], CELLS.berlin[1], 4000);
  let [sx, sy] = await screenOf(page, CELLS.berlin[0] - 6, CELLS.berlin[1] + 4);
  await page.mouse.click(sx, sy);
  await page.waitForTimeout(500);
  await page.getByTestId('tab-god').click();
  await page.getByTestId('god-tool-nuke').click();
  [sx, sy] = await screenOf(page, CELLS.berlin[0], CELLS.berlin[1]);
  await page.mouse.click(sx, sy);
  await page.waitForTimeout(1500);
  out.afterClick = await near();
  await hours(page, 1);
  out.after1h = await near();
  await page.getByTestId('nuke-close').click().catch(() => {});
  await page.getByTestId('nation-panel').locator('button', { hasText: '×' }).first().click().catch(() => {});
  await lookAt(page, CELLS.berlin[0], CELLS.berlin[1], 20);
  out.shots.push(await shot(page, `${tag}_01_berlin_20m_after1h.png`));
  await lookAt(page, CELLS.berlin[0], CELLS.berlin[1], 150);
  out.shots.push(await shot(page, `${tag}_02_berlin_150m_after1h.png`));
  await hours(page, 24 * 30);
  out.after30d = await near();
  await lookAt(page, CELLS.berlin[0], CELLS.berlin[1], 150);
  out.shots.push(await shot(page, `${tag}_03_berlin_150m_after30d.png`));
  await page.evaluate(() => window.__warsim.hud.setMapMode('fallout'));
  await lookAt(page, CELLS.berlin[0], CELLS.berlin[1], 1500);
  out.shots.push(await shot(page, `${tag}_04_fallout_1500m_30d.png`));
  const ins = await page.evaluate(() => window.__warsim.sim.inspect(true));
  const ger = ins.nations.find((n) => n.id === 1) ?? ins.nations[1];
  out.germany = ger;
} catch (e) {
  out.fatal = String(e?.stack ?? e);
}
out.errors = errors;
save(`c6_b_${seed}.json`, out);
await browser.close();
console.log(JSON.stringify({ fatal: out.fatal, errors: errors.length, keys: out.formationKeys, before: out.before?.men, click: out.afterClick?.men, h1: out.after1h?.men, d30: out.after30d?.men }));
