// Critic run 17, session CV (new, ADR-738): a carrier's naval bombers strike ashore from the deck (seed 99, Japan on
// China). Find the sortie hour by hour (as tests/e2e/carrierStrikeAshore1938.spec.ts), then judge what the player
// sees: the planes over the target at T2, the flight framed from the fleet, the ticker, the fleet's panel, the
// target's panel. Usage: node critic/scripts/c17_cvashore.mjs [seed]
import { launch, open1938, shot, save, CELLS } from './c17_lib.mjs';
const seed = Number(process.argv[2] ?? 99);
const jap = CELLS.tags.JAP;
const out = { seed, hits: [] };
const { browser, page, errors } = await launch();
const ticker = () => page.evaluate(() => [...document.querySelectorAll('[data-testid=ticker] *')].map((e) => e.innerText).filter(Boolean).slice(0, 12));
try {
  await open1938(page, seed);
  for (let h = 0; h < 96 && out.hits.length < 3; h++) {
    const hit = await page.evaluate(async (jap) => {
      const { sim, view } = window.__warsim;
      const t = (await sim.step(1)).tick;
      await new Promise((done) => { const wait = () => (view.lastTick >= t ? done() : void setTimeout(wait, 5)); wait(); });
      const rows = view.sorties;
      const all = (await sim.inspect(true)).formations;
      const fleets = all.filter((f) => f.nation === jap && view.formationAfloat(f.id));
      const land = all.filter((f) => f.nation !== jap && !view.formationAfloat(f.id));
      for (let i = 0; i + 11 <= rows.length; i += 11) {
        const [bx, by, tx, ty, launch, kmh, km] = [rows[i], rows[i + 1], rows[i + 2], rows[i + 3], rows[i + 4], rows[i + 5], rows[i + 6]];
        if (rows[i + 8] !== jap || rows[i + 10] !== 4) continue;
        const fl = fleets.find((f) => Math.hypot(f.x - bx, f.y - by) < 1.5);
        const tgt = land.find((f) => Math.hypot(f.x - tx, f.y - ty) < 0.05);
        if (!fl || !tgt) continue;
        if (launch + km / kmh > 0) continue;
        return { tick: t, bx, by, tx, ty, fleet: fl.id, target: tgt.id };
      }
      return null;
    }, jap);
    if (!hit) continue;
    if (out.hits.some((x) => x.fleet === hit.fleet && x.target === hit.target)) continue;
    const k = out.hits.length;
    await page.evaluate(({ x, y }) => window.__warsim.view.controller.set({ cx: x, cy: y, scale: 24 }), { x: hit.tx, y: hit.ty });
    await page.waitForTimeout(900);
    hit.planesOnScreen = await page.evaluate((jap) => { const v = window.__warsim.view; v.draw(performance.now()); return v.sortieMarks.filter((s) => s.nation === jap && s.x >= 0 && s.x <= innerWidth && s.y >= 0 && s.y <= innerHeight).length; }, jap);
    hit.mpp = await page.evaluate(() => window.__warsim.view.metresPerPx);
    hit.shotT2 = await shot(page, `c17cv_${seed}_${k}_target_t2.png`);
    await page.evaluate(({ bx, by, tx, ty }) => window.__warsim.view.controller.set({ cx: (bx + tx) / 2, cy: (by + ty) / 2, scale: 7 }), hit);
    await page.waitForTimeout(900);
    hit.shotFrame = await shot(page, `c17cv_${seed}_${k}_framed.png`);
    hit.ticker = await ticker();
    await page.evaluate((id) => window.__warsim.hud.selectFormation(id), hit.fleet);
    await page.waitForTimeout(700);
    hit.fleetPanel = await page.evaluate(() => document.querySelector('[data-testid=formation-panel]')?.innerText ?? null);
    hit.shotFleet = await shot(page, `c17cv_${seed}_${k}_fleetpanel.png`);
    await page.evaluate((id) => window.__warsim.hud.selectFormation(id), hit.target);
    await page.waitForTimeout(700);
    hit.targetPanel = await page.evaluate(() => document.querySelector('[data-testid=formation-panel]')?.innerText ?? null);
    hit.shotTarget = await shot(page, `c17cv_${seed}_${k}_targetpanel.png`);
    await page.evaluate(() => window.__warsim.hud.selectFormation?.(0));
    out.hits.push(hit);
    save(`c17_cv_${seed}.json`, { ...out, errors });
  }
} catch (e) { out.fatal = String(e?.stack ?? e); }
out.errors = errors;
save(`c17_cv_${seed}.json`, out);
await browser.close();
console.log(JSON.stringify(out.hits.map((h) => [h.tick, h.planesOnScreen, h.mpp])), out.fatal ?? '');
