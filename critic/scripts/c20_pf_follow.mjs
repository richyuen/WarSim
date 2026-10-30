// Critic run 19, session PF (new, ADR-758): the camera's follow of a selected formation. Wheel zoom while followed;
// the followed formation nuked by God (gone): the label, the camera, errors; a fleet selected and ordered.
import { launch, open1938, shot, save, lookAt, CELLS, hours } from './c20_lib.mjs';
const seed = Number(process.argv[2] ?? 4441);
const POL = CELLS.tags.POL;
const out = { seed, steps: [] };
const { browser, page, errors } = await launch();
const st = async (s) => out.steps.push({ s, label: await page.evaluate(() => document.querySelector('[data-testid=player-label]')?.innerText ?? null), following: await page.evaluate(() => window.__warsim.view.controller.following), cam: await page.evaluate(() => { const c = window.__warsim.view.controller.cam; return [+c.cx.toFixed(2), +c.cy.toFixed(2), +c.scale.toFixed(3)]; }), sel: await page.evaluate(() => [...window.__warsim.view.selectedFormations]) });
try {
  await open1938(page, seed);
  await page.waitForFunction((p) => window.__warsim.view.formationsOf(p).length > 3, POL, { timeout: 60_000 });
  await page.evaluate((p) => window.__warsim.view.select(p), POL);
  await page.getByTestId('take-control').click();
  await page.waitForTimeout(400);
  await page.evaluate(() => window.__warsim.view.select(0));
  const id = (await page.evaluate((p) => window.__warsim.view.formationsOf(p), POL))[0];
  const p0 = await page.evaluate((id) => window.__warsim.view.formationPos(id), id);
  await page.evaluate(([x, y]) => window.__warsim.view.controller.set({ cx: x, cy: y, scale: 16 }), p0);
  await page.waitForTimeout(400);
  await page.mouse.click(800, 450);
  await page.waitForTimeout(400);
  await st('clicked');
  // Order it 12 cells west, run 24 h: does the camera keep it centred?
  await page.mouse.click(800 - 12 * 16, 450);
  await page.waitForTimeout(300);
  await hours(page, 24);
  await page.waitForTimeout(1500);
  const sel = out.steps[0].sel[0];
  out.posAfter24 = await page.evaluate((id) => window.__warsim.view.formationPos(id), sel);
  await st('after 24h marching');
  // Wheel zoom in and out.
  await page.mouse.move(800, 450);
  await page.mouse.wheel(0, -600);
  await page.waitForTimeout(800);
  await st('wheel in');
  await page.mouse.wheel(0, 1200);
  await page.waitForTimeout(800);
  await st('wheel out');
  await hours(page, 24);
  await page.waitForTimeout(1500);
  out.posAfter48 = await page.evaluate((id) => window.__warsim.view.formationPos(id), sel);
  await st('after 48h');
  await shot(page, `c20pf_${seed}_00_followed.png`);
  // Nuke it by God (the command, at its place).
  const p = out.posAfter48;
  await page.evaluate(([x, y]) => window.__warsim.sim.command({ kind: 'godNuke', x, y, thermonuclear: true }, true), p);
  await hours(page, 6);
  await page.waitForTimeout(1500);
  out.alive = await page.evaluate(async (id) => (await window.__warsim.sim.inspect(true)).formations.some((f) => f.id === id && f.nation === 4), sel);
  await st('after nuke 6h');
  await shot(page, `c20pf_${seed}_01_after_nuke.png`);
  await page.mouse.click(800, 450);
  await page.waitForTimeout(400);
  await st('click after nuke');
  await hours(page, 24);
  await st('24h after nuke');
  out.ticker = await page.evaluate(() => document.body.innerText.split('\n').filter((l) => /19\d\d |not done|nuclear|Nuclear/.test(l)).slice(-8));
  // A Polish fleet: select by formationAt in Gdynia's water.
  await page.keyboard.press('Escape');
  const fleets = await page.evaluate(async (pol) => (await window.__warsim.sim.inspect(true)).formations.filter((f) => f.nation === pol && f.fleet !== undefined), POL);
  out.fleetKeys = fleets.length;
} catch (e) { out.fatal = String(e?.stack ?? e); }
out.errors = errors;
save(`c20_pf_${seed}.json`, out);
await browser.close();
console.log(JSON.stringify(out, null, 1).slice(0, 5000));
