// Critic run 10, session I: the editor gives France 10 warheads; Germany attacks France with a God
// buff (combat efficiency) so France loses. Does France, with its bombers, strike in 150 days?
// Usage: node critic/scripts/c10_i_france_standoff.mjs <seed>
import { launch, open1938, shot, save, CELLS, run, pause, lookAt } from './c10_lib.mjs';

const seed = Number(process.argv[2] ?? 7127);
const T = CELLS.tags;
const out = { seed, marks: [] };
const { browser, page, errors } = await launch();
const forces = (n) => page.evaluate(async (n) => { const s = await window.__warsim.sim.inspect(true); const f = s.formations.filter((x) => x.nation === n); return { all: f.length, wings: f.filter((x) => x.wing).length }; }, n);
const warheadsOf = (n) => page.evaluate((n) => window.__warsim.hud.stats.value.nations.find((x) => x.id === n)?.warheads ?? null, n);
try {
  await open1938(page, seed);
  await page.getByTestId('editor-btn').click();
  await page.getByTestId('editor-nation').selectOption(String(T.FRA));
  await page.getByTestId('editor-warheads').fill('10');
  await page.getByTestId('editor-warheads-add').click();
  await page.waitForTimeout(600);
  await page.getByTestId('editor-close').click();
  out.fraWarheads0 = await warheadsOf(T.FRA);
  out.fraForces0 = await forces(T.FRA);
  out.techs = await page.evaluate(async (n) => { const s = await window.__warsim.sim.inspect(true); return Object.keys(s).slice(0, 40); }, T.FRA);
  await page.evaluate(({ T }) => window.__warsim.sim.command({ kind: 'declareWar', attacker: T.GER, defender: T.FRA }), { T });
  await page.evaluate(() => window.__warsim.hud.setSpeedLevel(99));
  await run(page);
  const t0 = await page.evaluate(() => window.__warsim.hud.tick.value);
  for (const days of [10, 30, 60, 100, 150]) {
    await page.waitForFunction(({ t0, d }) => window.__warsim.hud.tick.value >= t0 + d * 24, { t0, d: days }, { timeout: 900_000, polling: 200 });
    await pause(page);
    out.marks.push({ days, fraWarheads: await warheadsOf(T.FRA), fra: await forces(T.FRA), alert: await page.evaluate(() => document.querySelector('[data-testid=nuke-alert-text]')?.innerText ?? null), land: await page.evaluate((n) => window.__warsim.hud.stats.value.nations.find((x) => x.id === n)?.land ?? null, T.FRA) });
    save(`c10_i_${seed}.json`, { ...out, errors });
    await run(page);
  }
  await pause(page);
  await lookAt(page, CELLS.paris[0], CELLS.paris[1], 3000);
  await shot(page, `c10i_${seed}_day150.png`);
  await page.evaluate(() => window.__warsim.hud.toggleHistory());
  await page.waitForTimeout(600);
  out.history = (await page.evaluate(() => document.body.innerText)).split('\n').filter((l) => /France|bomb/i.test(l)).slice(0, 30);
} catch (e) {
  out.fatal = String(e?.stack ?? e);
}
out.errors = errors;
save(`c10_i_${seed}.json`, out);
await browser.close();
console.log(JSON.stringify(out));
