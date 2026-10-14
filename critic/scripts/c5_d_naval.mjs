// Session D (run 5): R4-B4 again. Germany on the UK, Japan on the US; the first sea battles seen live
// at T1/T2/T3 with the frame loop natural; a carrier's planes in a fleet battle if any.
import { readFileSync } from 'node:fs';
import { launch, open1938, lookAt, shot, save, hours } from './c5_lib.mjs';
const seed = Number(process.argv[2] ?? 6131);
const tag = `c5d_${seed}`;
const tags = JSON.parse(readFileSync(new URL('../c5_tags.json', import.meta.url), 'utf8'));
const out = { seed, shots: [], battles: [], live: [] };
const { browser, page, errors } = await launch();
try {
  await open1938(page, seed);
  await page.evaluate(({ g, e, j, u }) => {
    window.__warsim.sim.command({ kind: 'declareWar', attacker: g, defender: e });
    window.__warsim.sim.command({ kind: 'declareWar', attacker: j, defender: u });
  }, { g: tags.GER, e: tags.ENG, j: tags.JAP, u: tags.USA });
  let found = null;
  for (let h = 0; h < 96 && !found; h++) {
    await hours(page, 1);
    const sb = await page.evaluate(() => window.__warsim.view.seaBattles());
    if (sb.length) {
      out.battles.push({ h, sb });
      found = sb[0];
      out.firstHour = h;
    }
  }
  if (found) {
    const fleetsNear = await page.evaluate(({ x, y }) => {
      const v = window.__warsim.view;
      return v.formationIds().filter((f) => v.formationAfloat(f)).map((f) => ({ f, pos: v.formationPos(f), t: v.formationTitle(f) })).filter((a) => a.pos && Math.hypot(a.pos[0] - x, a.pos[1] - y) < 4);
    }, found);
    out.fleetsNear = fleetsNear;
    for (const m of [1500, 300, 60, 20]) {
      await lookAt(page, found.x, found.y, m, false);
      await page.waitForTimeout(300);
      out.shots.push(await shot(page, `${tag}_10_battle_${String(m).padStart(4, '0')}m.png`));
    }
    // live at x1 (1 h/s) at 60 m and 20 m: 12 s each, best frame kept
    for (const m of [60, 20]) {
      await lookAt(page, found.x, found.y, m, false);
      await page.evaluate(() => {
        window.__warsim.hud.setSpeedLevel(0);
        window.__warsim.sim.setPaused(false);
        window.__warsim.hud.paused.value = false;
      });
      for (let i = 0; i < 12; i++) {
        await page.waitForTimeout(1000);
        const s = await page.evaluate(() => {
          const v = window.__warsim.view;
          return { tick: v.lastTick, el: v.elementCount, ind: v.individualCount, sorties: v.sortieMarks.length, air: v.airFx.shown.slice(), sb: v.seaBattles().length, tags: v.tagRects?.length };
        });
        out.live.push({ m, i, ...s });
        if (i % 4 === 3) out.shots.push(await shot(page, `${tag}_20_live_${m}m_${i}.png`));
      }
      await page.evaluate(() => {
        window.__warsim.sim.setPaused(true);
        window.__warsim.hud.paused.value = true;
      });
    }
  }
  // the sea battles of the ticker, after a few days
  await hours(page, 72);
  out.seaRows = await page.locator('[data-testid=sea-battle-row]').allInnerTexts().catch(() => []);
  out.tickerRows = await page.locator('[data-testid=ticker-row]').allInnerTexts().catch(() => []);
  await page.evaluate(() => window.__warsim.hud.setMapMode('seaControl'));
  await lookAt(page, 1040, 250, 3000);
  out.shots.push(await shot(page, `${tag}_30_seacontrol_northsea.png`));
  out.legend = await page.evaluate(() => document.querySelector('.map-legend, [data-testid=map-legend]')?.innerText ?? null);
} catch (e) {
  out.fatal = String(e?.stack ?? e);
}
out.errors = errors;
save(`c5_d_${seed}.json`, out);
await browser.close();
console.log(JSON.stringify({ fatal: out.fatal, errors: errors.length, firstHour: out.firstHour, battle: out.battles[0], fleetsNear: out.fleetsNear?.map((f) => f.t?.name), live: out.live.map((l) => [l.m, l.el, l.ind, l.sorties, l.sb]) }));
