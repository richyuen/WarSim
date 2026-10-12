// Session C: a player (the United Kingdom) tries an invasion with the mouse, as a player would.
// War on Germany; a division at Portsmouth is clicked, then a German coast cell is clicked.
// Also: a fleet ordered by the mouse; a division with no transports ordered over the sea.
import { launch, open1938, lookAt, shot, save, settle, hours, inspect } from './c4_lib.mjs';
const seed = Number(process.argv[2] ?? 2207);
const out = { seed, shots: [], log: [] };
const { browser, page, errors } = await launch(1600, 900);
const T0 = Date.now();
const screenOf = (x, y) =>
  page.evaluate(({ x, y }) => {
    const v = window.__warsim.view;
    const c = document.getElementById('map');
    const cam = v.controller.cam;
    const r = c.getBoundingClientRect();
    return [r.left + (x - cam.cx) * cam.scale + r.width / 2, r.top + (y - cam.cy) * cam.scale + r.height / 2];
  }, { x, y });
try {
  await open1938(page, seed);
  const ids = await page.evaluate(() => {
    const ns = window.__warsim.hud.stats.value.nations;
    const f = (n) => ns.find((x) => x.name === n)?.id;
    return { GER: f('nation.GER'), ENG: f('nation.ENG'), NOR: f('nation.NOR') };
  });
  out.ids = ids;
  // take control of the UK through the UI
  await page.evaluate((n) => window.__warsim.view.select(n), ids.ENG);
  await page.getByTestId('take-control').click();
  await page.waitForTimeout(500);
  out.player = await page.evaluate(() => window.__warsim.player.nation.value);
  // declare war through the actions tab
  await page.getByTestId('tab-actions').click();
  await page.waitForTimeout(300);
  out.shots.push(await shot(page, 'c4c_00_actions_tab.png'));
  await page.evaluate(({ a, d }) => window.__warsim.sim.command({ kind: 'declareWar', attacker: a, defender: d }), { a: ids.ENG, d: ids.GER });
  await hours(page, 1);
  // UK formations near Portsmouth (1017.8, 280.5) and transports there
  const forms = await page.evaluate((n) => {
    const v = window.__warsim.view;
    return v.formationsOf(n).map((f) => ({ f, pos: v.formationPos(f), afloat: v.formationAfloat(f), t: v.formationTitle(f) }));
  }, ids.ENG);
  const d = (p, x, y) => Math.hypot(p[0] - x, p[1] - y);
  const land = forms.filter((f) => !f.afloat).sort((a, b) => d(a.pos, 1017.8, 280.5) - d(b.pos, 1017.8, 280.5));
  const ships = forms.filter((f) => f.afloat).sort((a, b) => d(a.pos, 1017.8, 280.5) - d(b.pos, 1017.8, 280.5));
  out.nearPortsmouthLand = land.slice(0, 4);
  out.nearPortsmouthShips = ships.slice(0, 6);
  const div = land[0];
  // Step 1: send the division to Portsmouth by the mouse (select, click the port)
  await lookAt(page, 1030, 272, 1500);
  out.shots.push(await shot(page, 'c4c_10_channel_1500m.png'));
  let [sx, sy] = await screenOf(div.pos[0], div.pos[1]);
  await page.mouse.click(sx, sy);
  await page.waitForTimeout(300);
  out.selected1 = await page.evaluate(() => [...window.__warsim.view.selectedFormations]);
  // the German coast near Wilhelmshaven / Bremerhaven: lon 8.3 lat 53.6
  const tgt = await page.evaluate(() => null);
  const target = [Number(process.env.TX ?? 1072.8), Number(process.env.TY ?? 259.5)];
  ;[sx, sy] = await screenOf(target[0], target[1]);
  await page.mouse.click(sx, sy);
  await page.waitForTimeout(500);
  out.shots.push(await shot(page, 'c4c_11_order_to_germany.png'));
  await hours(page, 2);
  const st = await page.evaluate((f) => {
    const v = window.__warsim.view;
    return { pos: v.formationPos(f), afloat: v.formationAfloat(f), way: v.formationWay(f)?.length ?? null };
  }, div.f);
  out.afterOrder = st;
  out.refusalText = await page.locator('[data-testid=god-refusal]').allInnerTexts().catch(() => []);
  out.tickerAfterOrder = await page.locator('[data-testid=ticker-row]').allInnerTexts().catch(() => []);
  // follow 20 days
  const track = [];
  for (let k = 0; k < 20; k++) {
    await hours(page, 24);
    const s = await page.evaluate((f) => {
      const v = window.__warsim.view;
      const p = v.formationPos(f);
      return { pos: p && p.map((x) => +x.toFixed(1)), afloat: v.formationAfloat(f), engaged: v.formationEngaged(f) };
    }, div.f);
    track.push({ day: k + 1, ...s });
  }
  out.track = track;
  await lookAt(page, 1040, 270, 1500);
  out.shots.push(await shot(page, 'c4c_12_after_20_days.png'));
  // Second: Portsmouth's transports, then a division moved by hand to Portsmouth and ordered to Bremerhaven
  out.portTransports = ships.filter((s) => /Transport/i.test(s.t?.kind ?? '')).map((s) => ({ ...s, dist: d(s.pos, 1017.8, 280.5) }));
  // Third: a fleet by the mouse: a destroyer flotilla near Portsmouth to the Heligoland Bight
  const fl = ships.find((s) => /Destroyer|Cruiser|Battle/i.test(s.t?.kind ?? ''));
  if (fl) {
    await lookAt(page, 1035, 270, 1500);
    ;[sx, sy] = await screenOf(fl.pos[0], fl.pos[1]);
    await page.mouse.click(sx, sy);
    await page.waitForTimeout(300);
    out.fleetSelected = await page.evaluate(() => [...window.__warsim.view.selectedFormations]);
    ;[sx, sy] = await screenOf(1058, 252);
    await page.mouse.click(sx, sy);
    await page.waitForTimeout(400);
    out.shots.push(await shot(page, 'c4c_20_fleet_order.png'));
    const ftrack = [];
    for (let k = 0; k < 6; k++) {
      await hours(page, 12);
      ftrack.push(await page.evaluate((f) => {
        const v = window.__warsim.view;
        const p = v.formationPos(f);
        return { pos: p && p.map((x) => +x.toFixed(1)), engaged: v.formationEngaged(f) };
      }, fl.f));
    }
    out.fleetTrack = { f: fl, ftrack };
    out.shots.push(await shot(page, 'c4c_21_fleet_after_3_days.png'));
  }
  const ins = await inspect(page);
  out.ukForms = ins.formations.length;
  // history rows of landings
  await page.getByTestId('history-btn').click();
  await page.waitForTimeout(800);
  out.history = (await page.locator('[data-testid=history-row]').allInnerTexts()).slice(0, 80);
  out.shots.push(await shot(page, 'c4c_30_history.png'));
} catch (e) {
  out.fatal = String(e?.stack ?? e);
}
out.wallS = (Date.now() - T0) / 1000;
out.errors = errors;
save(`c4_c_${seed}${process.env.TAG ?? ""}.json`, out);
await browser.close();
console.log(JSON.stringify({ fatal: out.fatal, afterOrder: out.afterOrder, wallS: out.wallS }));
