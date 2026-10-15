// Session D (run 6): run 5's blockers re-tested on a new seed. Germany on Poland and the United Kingdom.
// R5-B1: the air at T3, the air mode with its legend, the air in history, ticker, panel, charts.
// R5-B4: the ticker's sea battle row clicked: both fleets on screen?
import { launch, open1938, lookAt, shot, save, hours, CELLS, screenOf } from './c6_lib.mjs';
const seed = Number(process.argv[2] ?? 5861);
const tag = `c6d_${seed}`;
const T = CELLS.tags;
const out = { seed, shots: [], fightSearch: [], tiers: [], live: [], sea: [] };
const { browser, page, errors } = await launch();
const state = () => page.evaluate(() => {
  const v = window.__warsim.view;
  v.draw();
  return { tick: v.lastTick, m: Math.round(v.metresPerPx * 10) / 10, el: v.elementCount, ind: v.individualCount, sorties: v.sortieMarks.length, air: v.airFx.shown.slice() };
});
try {
  await open1938(page, seed);
  await page.evaluate(({ g, e, p }) => {
    window.__warsim.sim.command({ kind: 'declareWar', attacker: g, defender: p });
    window.__warsim.sim.command({ kind: 'declareWar', attacker: g, defender: e });
  }, { g: T.GER, e: T.ENG, p: T.POL });
  // First hour with an air fight over Poland/Germany.
  let fight = null;
  let seaClicked = false;
  for (let h = 0; h < 96 && !fight; h++) {
    await hours(page, 1);
    const r = await page.evaluate(() => {
      const v = window.__warsim.view;
      const last = Math.max(...v.airFx.marks.map((k) => k.born), -Infinity);
      const hm = v.airFx.marks.filter((k) => k.born === last);
      return { tick: v.lastTick, sorties: v.sorties.length / 11, fights: hm.filter((k) => k.kind === 0).map((k) => ({ x: k.x, y: k.y })), bombs: hm.filter((k) => k.kind === 1).map((k) => ({ x: k.x, y: k.y })) };
    });
    out.fightSearch.push({ h, sorties: r.sorties, fights: r.fights.length, bombs: r.bombs.length });
    const f = [...r.bombs, ...r.fights].find((f) => f.x > 1060 && f.x < 1180 && f.y > 220 && f.y < 320);
    if (f) {
      fight = f;
      out.fightHour = h;
    }
  }
  out.fight = fight;
  if (fight) {
    for (const m of [1000, 150, 40, 15]) {
      await lookAt(page, fight.x, fight.y, m, false);
      await page.waitForTimeout(200);
      out.tiers.push(await state());
      out.shots.push(await shot(page, `${tag}_10_tier_${String(m).padStart(4, '0')}m.png`));
    }
    // Live at 20 m/px, speed x1, 20 s.
    await lookAt(page, fight.x, fight.y, 20, false);
    await page.evaluate(() => {
      window.__warsim.hud.setSpeedLevel(0);
      window.__warsim.sim.setPaused(false);
      window.__warsim.hud.paused.value = false;
    });
    let best = -1;
    for (let i = 0; i < 20; i++) {
      await page.waitForTimeout(1000);
      const s = await state();
      out.live.push(s);
      const score = s.sorties + s.air.reduce((a, b) => a + b, 0);
      if (score > best) {
        best = score;
        out.shots.push(await shot(page, `${tag}_20_live_20m_best.png`));
      }
    }
    out.shots.push(await shot(page, `${tag}_21_live_20m_last.png`));
    await page.evaluate(() => {
      window.__warsim.sim.setPaused(true);
      window.__warsim.hud.paused.value = true;
    });
  }
  // The sea battle row.
  const rows = page.locator('[data-testid=sea-battle-row]');
  for (let h = 0; h < 72 && (await rows.count()) === 0; h += 6) await hours(page, 6);
  out.seaRowCount = await rows.count();
  if (out.seaRowCount > 0) {
    out.seaRowText = await rows.first().innerText();
    await rows.first().click();
    seaClicked = true;
    await page.waitForTimeout(2500);
    out.sea.push(await state());
    out.seaCam = await page.evaluate(() => ({ ...window.__warsim.view.controller.cam, mpp: window.__warsim.view.metresPerPx }));
    out.shots.push(await shot(page, `${tag}_30_sea_row_clicked.png`));
    // Fleets near the view centre by nation.
    out.fleetsNear = await page.evaluate(async () => {
      const ins = await window.__warsim.sim.inspect(true);
      const c = window.__warsim.view.controller.cam;
      const halfW = window.innerWidth / 2 / c.scale;
      const halfH = window.innerHeight / 2 / c.scale;
      return ins.formations.filter((f) => !f.wing && Math.abs(f.x - c.cx) < halfW && Math.abs(f.y - c.cy) < halfH).map((f) => ({ id: f.id, nation: f.nation, s: f.strength }));
    });
    await page.evaluate(() => {
      window.__warsim.hud.setSpeedLevel(0);
      window.__warsim.sim.setPaused(false);
      window.__warsim.hud.paused.value = false;
    });
    for (let i = 0; i < 8; i++) {
      await page.waitForTimeout(1000);
      out.sea.push(await state());
      if (i === 3 || i === 7) out.shots.push(await shot(page, `${tag}_31_sea_live_${i}.png`));
    }
    await page.evaluate(() => {
      window.__warsim.sim.setPaused(true);
      window.__warsim.hud.paused.value = true;
    });
  }
  out.seaClicked = seaClicked;
  // Twenty days of war: the air mode over Poland, its legend.
  const now = await page.evaluate(() => window.__warsim.view.lastTick);
  if (now < 480) await hours(page, 480 - now);
  await page.evaluate(() => window.__warsim.hud.setMapMode('airControl'));
  await lookAt(page, CELLS.warsaw[0] - 8, CELLS.warsaw[1], 2500, false);
  await page.waitForTimeout(1200);
  out.shots.push(await shot(page, `${tag}_40_aircontrol_day20.png`));
  out.airLegend = await page.locator('.map-legend, [data-testid=map-legend], [data-testid=legend]').first().innerText().catch(() => null);
  out.legendAll = await page.evaluate(() => [...document.querySelectorAll('[class*=legend]')].map((e) => e.textContent).slice(0, 4));
  await page.evaluate(() => window.__warsim.hud.setMapMode('political'));
  // Forty days: history and ticker about the air; Germany's panel; the charts.
  await hours(page, 480);
  out.ticker = await page.locator('[data-testid=ticker-row]').allInnerTexts().catch(() => []);
  await page.getByTestId('history-btn').click();
  await page.waitForTimeout(800);
  out.history = (await page.locator('[data-testid=history-row]').allInnerTexts().catch(() => [])).slice(0, 60);
  out.historyAir = out.history.filter((r) => /air|bomb|raid|aircraft|sortie/i.test(r));
  out.shots.push(await shot(page, `${tag}_50_history_day40.png`));
  await page.getByTestId('history-btn').click();
  await lookAt(page, CELLS.berlin[0], CELLS.berlin[1], 4000, false);
  const [sx, sy] = await screenOf(page, CELLS.berlin[0] - 6, CELLS.berlin[1] + 4);
  await page.mouse.click(sx, sy);
  await page.waitForTimeout(700);
  out.germanyPanel = await page.getByTestId('nation-panel').innerText().catch(() => null);
  out.shots.push(await shot(page, `${tag}_51_germany_panel.png`));
  await page.locator('button', { hasText: 'Charts' }).click().catch(() => {});
  await page.waitForTimeout(1200);
  out.shots.push(await shot(page, `${tag}_52_charts.png`));
  out.chartOptions = await page.evaluate(() => [...document.querySelectorAll('select option')].map((o) => o.textContent).filter((t) => t && t.length < 40).slice(0, 60));
} catch (e) {
  out.fatal = String(e?.stack ?? e);
}
out.errors = errors;
save(`c6_d_${seed}.json`, out);
await browser.close();
console.log(JSON.stringify({ fatal: out.fatal, errors: errors.length, fightHour: out.fightHour, tiers: out.tiers, live: out.live.map((s) => [s.sorties, s.air.join('/')]).join(' '), seaRow: out.seaRowText, fleetsNear: out.fleetsNear, historyAir: out.historyAir?.length, legend: out.airLegend }));
