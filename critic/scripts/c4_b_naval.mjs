// Session B: a naval war the critic picked (Germany vs the United Kingdom, Japan vs the United States, seed 6131).
// Finds the first sea battles, looks at them at T1/T2/T3, counts ships, shots and sinkings; reads history and ticker.
import { launch, open1938, lookAt, shot, save, settle, hours, inspect } from './c4_lib.mjs';
const seed = Number(process.argv[2] ?? 6131);
const out = { seed, shots: [], log: [], battles: [] };
const { browser, page, errors } = await launch(1600, 900);
const T0 = Date.now();
try {
  await open1938(page, seed);
  const ids = await page.evaluate(() => {
    const ns = window.__warsim.hud.stats.value.nations;
    const f = (n) => ns.find((x) => x.name === n)?.id;
    return { GER: f('nation.GER'), ENG: f('nation.ENG'), JAP: f('nation.JAP'), USA: f('nation.USA'), ITA: f('nation.ITA'), FRA: f('nation.FRA') };
  });
  out.ids = ids;
  await page.evaluate(({ a, d }) => window.__warsim.sim.command({ kind: 'declareWar', attacker: a, defender: d }), { a: ids.GER, d: ids.ENG });
  await page.evaluate(({ a, d }) => window.__warsim.sim.command({ kind: 'declareWar', attacker: a, defender: d }), { a: ids.JAP, d: ids.USA });
  await hours(page, 1);
  const ins0 = await inspect(page);
  out.warsAfterDeclare = ins0.wars.map((w) => ({ a: w.attackers.map((i) => ins0.nations.find((n) => n.id === i)?.name), d: w.defenders.map((i) => ins0.nations.find((n) => n.id === i)?.name) }));
  // Step 6 h at a time up to 45 days; on each step note fleets engaged.
  let found = [];
  let h = 0;
  for (; h < 45 * 24; h += 6) {
    await hours(page, 6);
    found = await page.evaluate(() => {
      const v = window.__warsim.view;
      return v.formationIds().filter((f) => v.formationAfloat(f) && v.formationEngaged(f)).map((f) => ({ f, pos: v.formationPos(f), t: v.formationTitle(f) }));
    });
    if (found.length >= 2) break;
  }
  out.firstBattleHour = h;
  out.firstBattleWallS = (Date.now() - T0) / 1000;
  out.firstEngaged = found;
  if (found.length >= 2) {
    const at = found[0].pos;
    // T0 then T1
    await lookAt(page, at[0], at[1], 4000);
    out.shots.push(await shot(page, 'c4b_10_battle_T0_4000m.png'));
    await lookAt(page, at[0], at[1], 1000);
    out.shots.push(await shot(page, 'c4b_11_battle_T1_1000m.png'));
    await page.evaluate(() => window.__warsim.hud.setMapMode('seaControl'));
    await settle(page);
    out.shots.push(await shot(page, 'c4b_12_battle_T1_seacontrol.png'));
    await page.evaluate(() => window.__warsim.hud.setMapMode('political'));
    // Hour by hour: alternate T2 (40 m/px) and T3 (12 m/px), record the busiest picture.
    let best = { t2: 0, t3: 0, t4: 0 };
    for (let k = 0; k < 14; k++) {
      const eng = await page.evaluate((f0) => {
        const v = window.__warsim.view;
        const p = v.formationPos(f0);
        const all = v.formationIds().filter((f) => v.formationAfloat(f) && v.formationEngaged(f)).map((f) => ({ f, pos: v.formationPos(f), t: v.formationTitle(f) }));
        return { p, all };
      }, found[0].f);
      const pos = eng.p ?? eng.all[0]?.pos;
      if (!pos) break;
      const tier = k % 3 === 0 ? 40 : k % 3 === 1 ? 12 : 4;
      await lookAt(page, pos[0], pos[1], tier, false);
      await hours(page, 1);
      let drawn = 0;
      for (let s = 0; s < 12; s++) {
        const n = await page.evaluate(() => {
          const v = window.__warsim.view;
          return { fx: v.fire.tracers.length + v.fire.flashes + v.fire.impacts, el: v.elementCount, ind: v.individualCount, wrecks: v.wrecks.shown.length, wakes: v.elementWakes, tags: v.tagRects.length };
        });
        const key = tier === 40 ? 't2' : tier === 12 ? 't3' : 't4';
        if (n.fx > best[key] || (s === 0 && best[key] === 0)) {
          best[key] = Math.max(best[key], n.fx);
          out.shots.push(await shot(page, `c4b_2${k}_battle_${tier}m_h${k}.png`));
          out.battles.push({ k, tier, ...n, engaged: eng.all.length, engagedNames: eng.all.map((e) => e.t?.name + ' / ' + e.t?.nation).slice(0, 8) });
        }
        await page.waitForTimeout(60);
      }
    }
    out.best = best;
  }
  // 30 more days in 24 h steps to see the war go on; then history and ticker.
  for (let d = 0; d < 30; d++) await hours(page, 24);
  const ins = await inspect(page);
  const nm = (i) => ins.nations.find((n) => n.id === i)?.name;
  out.warsDay = ins.wars.map((w) => ({ a: w.attackers.map(nm), d: w.defenders.map(nm), score: w.score, battle: w.battle }));
  out.tickEnd = ins.tick;
  // open history
  await page.getByTestId('history-btn').click();
  await page.waitForTimeout(800);
  out.history = await page.locator('[data-testid=history-row]').allInnerTexts();
  out.shots.push(await shot(page, 'c4b_40_history.png'));
  await page.getByTestId('history-close').click().catch(() => {});
  out.ticker = await page.locator('[data-testid=ticker-row]').allInnerTexts().catch(() => []);
  // Fleets overall: where the UK and German fleets are
  out.fleetsEnd = await page.evaluate((ids) => {
    const v = window.__warsim.view;
    const r = {};
    for (const f of v.formationIds()) {
      if (!v.formationAfloat(f)) continue;
      const t = v.formationTitle(f);
      if (![ids.GER, ids.ENG, ids.JAP, ids.USA].includes(t.nation)) continue;
      (r[t.nation] ??= []).push({ name: t.name, pos: v.formationPos(f).map((x) => +x.toFixed(1)), engaged: v.formationEngaged(f) });
    }
    return r;
  }, ids);
  await lookAt(page, 1060, 270, 2500);
  await page.evaluate(() => window.__warsim.hud.setMapMode('seaControl'));
  await settle(page);
  out.shots.push(await shot(page, 'c4b_50_northsea_seacontrol_day75.png'));
  await page.evaluate(() => window.__warsim.hud.setMapMode('political'));
  await settle(page);
  out.shots.push(await shot(page, 'c4b_51_northsea_political_day75.png'));
  await lookAt(page, 1900, 450, 6000);
  await page.evaluate(() => window.__warsim.hud.setMapMode('seaControl'));
  await settle(page);
  out.shots.push(await shot(page, 'c4b_52_pacific_seacontrol_day75.png'));
} catch (e) {
  out.fatal = String(e?.stack ?? e);
}
out.wallS = (Date.now() - T0) / 1000;
out.errors = errors;
save(`c4_b_${seed}.json`, out);
await browser.close();
console.log(JSON.stringify({ fatal: out.fatal, firstBattleHour: out.firstBattleHour, best: out.best, wallS: out.wallS, errors: errors.length }));
