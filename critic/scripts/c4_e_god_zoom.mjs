// Session E: God Mode panel and actions, the editor, and the close zoom on a land battle (R3-B3 recheck).
import { launch, open1938, lookAt, shot, save, settle, hours, inspect } from './c4_lib.mjs';
const seed = Number(process.argv[2] ?? 9157);
const out = { seed, shots: [], god: {}, zoom: [] };
const { browser, page, errors } = await launch(1600, 900);
const T0 = Date.now();
try {
  await open1938(page, seed);
  const ids = await page.evaluate(() => {
    const ns = window.__warsim.hud.stats.value.nations;
    const f = (n) => ns.find((x) => x.name === n)?.id;
    return { GER: f('nation.GER'), POL: f('nation.POL'), FRA: f('nation.FRA'), ITA: f('nation.ITA'), SOV: f('nation.SOV') };
  });
  out.ids = ids;
  // God Mode panel on France
  await lookAt(page, 1040, 300, 3000);
  await page.evaluate((n) => window.__warsim.view.select(n), ids.FRA);
  await page.getByTestId('god-btn').click();
  await page.waitForTimeout(600);
  out.god.panelText = await page.getByTestId('panel-god').innerText().catch(async () => await page.locator('body').innerText());
  out.god.buttons = await page.locator('[data-testid=panel-god] button').allInnerTexts().catch(() => []);
  out.shots.push(await shot(page, 'c4e_00_god_panel.png'));
  // war Germany -> Poland via God command, then 20 days
  await page.evaluate(({ a, d }) => window.__warsim.sim.command({ kind: 'declareWar', attacker: a, defender: d }), { a: ids.GER, d: ids.POL });
  // A God nuke, if any command exists
  for (const kind of ['nuke', 'launchNuke', 'nuclearStrike', 'airStrike', 'spawnAirWing']) {
    await page.evaluate((k) => window.__warsim.sim.command({ kind: k, nation: 1, x: 1100, y: 268 }), kind).catch((e) => (out.god[kind] = String(e)));
  }
  for (let d = 0; d < 20; d++) await hours(page, 24);
  const ins = await inspect(page);
  out.warsDay20 = ins.wars.map((w) => ({ a: w.attackers.length, d: w.defenders.length, lead: [ins.nations.find((n) => n.id === w.attackers[0])?.name, ins.nations.find((n) => n.id === w.defenders[0])?.name], battle: w.battle, score: w.score }));
  // engaged German formations
  const eng = await page.evaluate((g) => {
    const v = window.__warsim.view;
    return v.formationsOf(g).filter((f) => v.formationEngaged(f) && !v.formationAfloat(f)).map((f) => ({ f, pos: v.formationPos(f), t: v.formationTitle(f) }));
  }, ids.GER);
  out.engagedGerman = eng.length;
  for (const e of eng.slice(0, 3)) {
    for (const m of [300, 40, 8]) {
      await lookAt(page, e.pos[0], e.pos[1], m);
      await page.waitForTimeout(300);
      const s = await page.evaluate(() => {
        const v = window.__warsim.view;
        const owners = new Set();
        const nat = {};
        for (let i = 0; i < v.elementCount; i++) {
          const f = v.elementFormation[i];
          const t = v.formationTitle(f);
          if (t) nat[t.nation] = (nat[t.nation] ?? 0) + 1;
        }
        return { elements: v.elementCount, individuals: v.individualCount, byNation: nat, fx: v.fire.tracers.length + v.fire.flashes + v.fire.impacts, wrecks: v.wrecks.shown.length };
      });
      out.zoom.push({ f: e.f, m, ...s });
      out.shots.push(await shot(page, `c4e_1${eng.indexOf(e)}_landfight_f${e.f}_${m}m.png`));
    }
  }
  // Use the formation panel "go to fight" if present
  if (eng[0]) {
    await lookAt(page, eng[0].pos[0], eng[0].pos[1], 300);
    await page.evaluate((f) => window.__warsim.view.selectedFormations, eng[0].f);
  }
  // The war banner: click the first and see where it lands
  const banner = page.locator('[data-testid=war-banner]').first();
  if (await banner.count()) {
    await banner.click();
    await page.waitForTimeout(2500);
    await settle(page);
    const s = await page.evaluate(() => {
      const v = window.__warsim.view;
      const nat = {};
      for (let i = 0; i < v.elementCount; i++) {
        const t = v.formationTitle(v.elementFormation[i]);
        if (t) nat[t.nation] = (nat[t.nation] ?? 0) + 1;
      }
      return { m: v.metresPerPx, elements: v.elementCount, byNation: nat };
    });
    out.bannerJump = s;
    out.shots.push(await shot(page, 'c4e_20_after_banner_click.png'));
    // live: run 1 hour and take the busiest frame
    let best = 0;
    await hours(page, 1);
    for (let k = 0; k < 15; k++) {
      const n = await page.evaluate(() => { const v = window.__warsim.view; return v.fire.tracers.length + v.fire.flashes + v.fire.impacts; });
      if (n > best) { best = n; await shot(page, 'c4e_21_banner_fight_live.png'); }
      await page.waitForTimeout(60);
    }
    out.bannerFx = best;
  }
  // Editor: open, a brush stroke, undo
  await page.getByTestId('editor-btn').click();
  await page.waitForTimeout(600);
  out.editorText = (await page.getByTestId('editor-panel').innerText().catch(() => '')).slice(0, 800);
  out.shots.push(await shot(page, 'c4e_30_editor.png'));
} catch (e) {
  out.fatal = String(e?.stack ?? e);
}
out.wallS = (Date.now() - T0) / 1000;
out.errors = errors;
save(`c4_e_${seed}.json`, out);
await browser.close();
console.log(JSON.stringify({ fatal: out.fatal, zoom: out.zoom, bannerJump: out.bannerJump, wallS: out.wallS }));
