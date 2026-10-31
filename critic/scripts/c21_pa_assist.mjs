// Critic run 19, session PA (new, ADR-758/759): play Germany. War on Poland from the right-click menu; a front
// formation ordered back (a fighting withdrawal); a rear formation ordered into Poland (contact: cancelled, told);
// Ctrl+A and a click (every unit ordered?); the camera's follow; the army box unticked; order arrows at three zooms.
import { launch, open1938, shot, save, lookAt, CELLS, hours, screenOf } from './c21_lib.mjs';
const seed = Number(process.argv[2] ?? 5557);
const T = CELLS.tags;
const GER = T.GER, POL = T.POL;
const out = { seed, steps: [] };
const { browser, page, errors } = await launch();
const ticker = () => page.evaluate(() => [...document.querySelectorAll('.ticker-row, [data-testid^=ticker] div, [class*=ticker] [class*=row]')].map((e) => e.innerText.trim()).filter(Boolean).slice(-10));
const tickerAll = () => page.evaluate(() => document.body.innerText.split('\n').filter((l) => /not done|met the enemy|declared war|stopped/.test(l)).slice(-12));
const label = () => page.evaluate(() => document.querySelector('[data-testid=player-label]')?.innerText ?? null);
const forms = (n) => page.evaluate(async (n) => {
  const v = window.__warsim.view;
  const full = (await window.__warsim.sim.inspect(true)).formations;
  const out = [];
  for (let i = 0; i < v.formIds.length; i++) {
    if (v.formNation[i] !== n) continue;
    const id = v.formIds[i];
    const f = full.find((x) => x.id === id);
    out.push({ id, x: v.formX[i], y: v.formY[i], moving: (v.formFlags[i] & 1) !== 0, engaged: (v.formFlags[i] & 2) !== 0, wing: f?.wing ?? false, strength: f?.strength ?? 0, elements: f?.elements ?? 0 });
  }
  return out;
}, n);
const cam = () => page.evaluate(() => { const c = window.__warsim.view.controller.cam; return [c.cx, c.cy, c.scale]; });
const pos = (id) => page.evaluate((id) => window.__warsim.view.formationPos(id), id);
try {
  await open1938(page, seed);
  await page.waitForFunction((p) => window.__warsim.view.formationsOf(p).length > 3, GER, { timeout: 60_000 });
  await page.evaluate((p) => window.__warsim.view.select(p), GER);
  await page.getByTestId('take-control').click();
  await page.waitForTimeout(600);
  out.label0 = await label();
  const f0 = await forms(GER);
  out.formKeys = Object.keys(f0[0] ?? {});
  out.gerFormations = f0.length;
  await page.evaluate(() => window.__warsim.view.select(0));
  // Right-click on Polish ground near the border.
  await page.evaluate(([x, y]) => window.__warsim.view.controller.set({ cx: x, cy: y, scale: 10 }), CELLS.polfront);
  await page.waitForTimeout(500);
  const spot = await page.evaluate((n) => {
    const v = window.__warsim.view;
    for (let y = 200; y <= 700; y += 20) for (let x = 900; x <= 1400; x += 20) if (v.nationAt(x, y) === n && v.nationAt(x + 10, y) === n) return [x, y];
    return null;
  }, POL);
  out.polSpot = spot;
  await page.mouse.click(spot[0], spot[1], { button: 'right' });
  await page.waitForTimeout(400);
  out.menu = await page.evaluate(() => document.querySelector('[data-testid=nation-menu]')?.innerText ?? null);
  await shot(page, `c21pa_${seed}_00_menu.png`);
  await page.getByTestId('nation-menu-war').click();
  await page.waitForTimeout(400);
  await hours(page, 2);
  out.steps.push({ s: 'war declared', ticker: await tickerAll() });
  await hours(page, 24 * 4);
  let g = await forms(GER);
  out.engagedDay4 = g.filter((f) => f.engaged).length;
  out.sample = g.slice(0, 2);
  // A front formation in contact, ordered 8 cells west.
  out.engagedList = g.filter((f) => f.engaged).length;
  const eng = g.filter((f) => f.engaged && !f.wing).sort((a, b) => b.strength - a.strength)[0];
  out.front = eng ? { id: eng.id, x: eng.x, y: eng.y, name: eng.name } : null;
  if (eng) {
    await page.evaluate(([x, y]) => window.__warsim.view.controller.set({ cx: x, cy: y, scale: 16 }), [eng.x, eng.y]);
    await page.waitForTimeout(400);
    const picked = await page.evaluate((p) => window.__warsim.view.formationAt(800, 450, p), GER);
    await page.mouse.click(800, 450);
    await page.waitForTimeout(400);
    out.frontPicked = picked;
    out.frontLabel = await label();
    out.frontSelected = await page.evaluate(() => [...window.__warsim.view.selectedFormations]);
    const before = await pos(picked);
    await page.mouse.click(800 - 8 * 16, 450);
    await page.waitForTimeout(300);
    await shot(page, `c21pa_${seed}_01_withdraw_order.png`);
    const track = [];
    for (let h = 0; h < 24; h += 4) {
      await hours(page, 4);
      const f = (await forms(GER)).find((x) => x.id === picked);
      track.push({ h: h + 4, pos: f ? [f.x, f.y] : null, engaged: f?.engaged, moving: f?.moving, strength: f?.strength, ticker: await tickerAll() });
    }
    out.withdraw = { before, track, camAfter: await cam(), ticker: await tickerAll() };
    await shot(page, `c21pa_${seed}_02_withdraw_day1.png`);
  }
  // A rear formation (not engaged, farthest west) ordered 25 cells east into Poland.
  g = await forms(GER);
  const rear = g.filter((f) => !f.engaged && !f.wing && !f.fleet && Math.abs(f.y - CELLS.polfront[1]) < 15).sort((a, b) => Math.hypot(a.x - CELLS.polfront[0], a.y - CELLS.polfront[1]) - Math.hypot(b.x - CELLS.polfront[0], b.y - CELLS.polfront[1]))[0];
  out.rear = rear ? { id: rear.id, x: rear.x, y: rear.y, name: rear.name } : null;
  if (rear) {
    await page.keyboard.press('Escape');
    await page.evaluate(([x, y]) => window.__warsim.view.controller.set({ cx: x, cy: y, scale: 16 }), [rear.x, rear.y]);
    await page.waitForTimeout(400);
    const picked = await page.evaluate((p) => window.__warsim.view.formationAt(800, 450, p), GER);
    await page.mouse.click(800, 450);
    await page.waitForTimeout(300);
    out.rearPicked = picked;
    out.rearLabel = await label();
    const tgt = await page.evaluate(() => { const v = window.__warsim.view; v.controller.set({ cx: v.controller.cam.cx + 25, cy: v.controller.cam.cy, scale: 16 }); return null; });
    await page.waitForTimeout(400);
    out.rearTargetNation = await page.evaluate(() => window.__warsim.view.nationAt(800, 450));
    await page.mouse.click(800, 450);
    await page.waitForTimeout(300);
    for (const m of [3000, 250, 25]) {
      const p = await pos(picked);
      if (p) await lookAt(page, p[0], p[1], m);
      await shot(page, `c21pa_${seed}_03_rear_arrow_${m}m.png`);
    }
    const track = [];
    for (let h = 0; h < 96; h += 8) {
      await hours(page, 8);
      const f = (await forms(GER)).find((x) => x.id === picked);
      track.push({ h: h + 8, pos: f ? [f.x, f.y] : null, engaged: f?.engaged, moving: f?.moving });
    }
    out.rearRun = { track, ticker: await tickerAll() };
    await shot(page, `c21pa_${seed}_04_rear_after.png`);
  }
  // Ctrl+A and a click on Warsaw at country zoom.
  await page.keyboard.press('Escape');
  await lookAt(page, CELLS.berlin[0] + 8, CELLS.berlin[1], 3000);
  await page.mouse.click(5, 5).catch(() => {});
  await page.keyboard.press('Control+KeyA');
  await page.waitForTimeout(500);
  out.ctrlA = { label: await label(), n: await page.evaluate(() => window.__warsim.view.selectedFormations.size), ids: await page.evaluate(() => [...window.__warsim.view.selectedFormations]), cam: await cam() };
  await shot(page, `c21pa_${seed}_05_ctrlA.png`);
  await page.waitForTimeout(1500);
  out.ctrlA.camLater = await cam();
  const ws = await screenOf(page, CELLS.warsaw[0], CELLS.warsaw[1]);
  out.ctrlA.warsawScreen = ws;
  const before = await forms(GER);
  await page.mouse.click(ws[0], ws[1]);
  await page.waitForTimeout(500);
  await shot(page, `c21pa_${seed}_06_ctrlA_ordered.png`);
  await hours(page, 48);
  const after = await forms(GER);
  const moved = after.filter((f) => { const b = before.find((x) => x.id === f.id); return b && Math.hypot(b.x - f.x, b.y - f.y) > 1; });
  out.ctrlA.after48 = { total: after.length, moved: moved.length, wingsMoved: moved.filter((f) => f.wing).length, fleetsMoved: moved.filter((f) => f.fleet).length, ticker: await tickerAll(), cam: await cam() };
  out.ctrlA.nearWarsaw = after.filter((f) => Math.hypot(f.x - CELLS.warsaw[0], f.y - CELLS.warsaw[1]) < 6).length;
  await shot(page, `c21pa_${seed}_07_ctrlA_48h.png`);
  // Army box unticked: 5 days, how many unordered German formations move.
  await page.keyboard.press('Escape');
  await page.evaluate((p) => window.__warsim.view.select(p), GER);
  await page.waitForTimeout(400);
  await page.getByTestId('tab-actions').click();
  await page.waitForTimeout(300);
  out.boxes = await page.evaluate(() => [...document.querySelectorAll('[data-testid^=act-assist-]')].map((e) => [e.dataset.testid, e.checked]));
  await shot(page, `c21pa_${seed}_08_actions.png`);
  const ordered = new Set(out.ctrlA.ids ?? []);
  const moves = async () => { const a = await forms(GER); await hours(page, 24 * 3); const b = await forms(GER); const m = b.filter((f) => !ordered.has(f.id) && !f.wing).filter((f) => { const o = a.find((x) => x.id === f.id); return o && Math.hypot(o.x - f.x, o.y - f.y) > 1; }); return { moved: m.length, movingNow: b.filter((f) => !ordered.has(f.id) && f.moving && !f.wing).length, engaged: b.filter((f) => f.engaged).length, unordered: b.filter((f) => !ordered.has(f.id) && !f.wing).length }; };
  out.movedArmyOn5d = await moves();
  await page.getByTestId('act-assist-army').uncheck();
  await page.waitForTimeout(300);
  out.movedArmyOff5d = await moves();
  out.engagedEnd = (await forms(GER)).filter((f) => f.engaged).length;
  await lookAt(page, CELLS.warsaw[0] - 4, CELLS.warsaw[1], 3000);
  await shot(page, `c21pa_${seed}_09_armyoff.png`);
} catch (e) { out.fatal = String(e?.stack ?? e); }
out.errors = errors;
save(`c21_pa_${seed}.json`, out);
await browser.close();
if (out.ctrlA) delete out.ctrlA.ids; console.log(JSON.stringify(out, null, 1).slice(0, 8000));
