// Session B2: watch a sea battle as a player does: the game running at its slowest speed (1 h a second),
// the camera kept on the middle of the two engaged fleets, at 60 m/px then 15 m/px. Seed 6131 as session B.
import { launch, open1938, lookAt, shot, save, settle, hours } from './c4_lib.mjs';
const seed = Number(process.argv[2] ?? 6131);
const out = { seed, shots: [], samples: [] };
const { browser, page, errors } = await launch(1600, 900);
try {
  await open1938(page, seed);
  const ids = await page.evaluate(() => {
    const ns = window.__warsim.hud.stats.value.nations;
    const f = (n) => ns.find((x) => x.name === n)?.id;
    return { GER: f('nation.GER'), ENG: f('nation.ENG'), JAP: f('nation.JAP'), USA: f('nation.USA') };
  });
  await page.evaluate(({ a, d }) => window.__warsim.sim.command({ kind: 'declareWar', attacker: a, defender: d }), { a: ids.GER, d: ids.ENG });
  await page.evaluate(({ a, d }) => window.__warsim.sim.command({ kind: 'declareWar', attacker: a, defender: d }), { a: ids.JAP, d: ids.USA });
  const engagedPair = () =>
    page.evaluate(() => {
      const v = window.__warsim.view;
      const e = v.formationIds().filter((f) => v.formationAfloat(f) && v.formationEngaged(f)).map((f) => ({ f, pos: v.formationPos(f), n: v.formationTitle(f)?.nation }));
      for (const a of e) for (const b of e) if (a.n !== b.n && Math.hypot(a.pos[0] - b.pos[0], a.pos[1] - b.pos[1]) < 4) return [a, b];
      return null;
    });
  let pair = null;
  let watched = 0;
  for (let h = 0; h < 40 * 24 && watched < 3; h += 1) {
    await hours(page, 1);
    pair = await engagedPair();
    if (!pair) continue;
    watched++;
    // slowest speed, running
    const mid = [(pair[0].pos[0] + pair[1].pos[0]) / 2, (pair[0].pos[1] + pair[1].pos[1]) / 2];
    out.samples.push({ battle: watched, hour: h, pair, gapKm: Math.hypot(pair[0].pos[0] - pair[1].pos[0], pair[0].pos[1] - pair[1].pos[1]) * 19.6 });
    await lookAt(page, mid[0], mid[1], 60, false);
    for (let i = 0; i < 8; i++) await page.getByTestId('speed-down').click({ timeout: 1500 }).catch(() => {});
    out.speed = await page.getByTestId('speed-label').innerText();
    await page.getByTestId('pause-btn').click();
    let best = -1;
    const t0 = Date.now();
    while (Date.now() - t0 < 45000) {
      const p = await engagedPair();
      const s = await page.evaluate(() => {
        const v = window.__warsim.view;
        const nat = {};
        for (let i = 0; i < v.elementCount; i++) {
          const t = v.formationTitle(v.elementFormation[i]);
          if (t) nat[t.nation] = (nat[t.nation] ?? 0) + 1;
        }
        return { tick: v.lastTick, m: Math.round(v.metresPerPx), fx: v.fire.tracers.length + v.fire.flashes + v.fire.impacts, shots: v.fire.shots.length, el: v.elementCount, byNation: nat, wrecks: v.wrecks.shown.length };
      });
      out.samples.push({ battle: watched, ...s, engaged: !!p });
      const m = Date.now() - t0 > 22000 ? 15 : 60;
      if (p) await lookAt(page, (p[0].pos[0] + p[1].pos[0]) / 2, (p[0].pos[1] + p[1].pos[1]) / 2, m, false);
      if (s.fx > best) {
        best = s.fx;
        out.shots.push(await shot(page, `c4b2_${watched}_live_best_${m}m.png`));
      }
      if (!p) break;
      await page.waitForTimeout(250);
    }
    out.shots.push(await shot(page, `c4b2_${watched}_live_end.png`));
    await page.getByTestId('pause-btn').click();
    await page.waitForTimeout(500);
    out[`best${watched}`] = best;
    h += 12;
    await hours(page, 12);
  }
} catch (e) {
  out.fatal = String(e?.stack ?? e);
}
out.errors = errors;
save(`c4_b2_${seed}.json`, out);
await browser.close();
console.log(JSON.stringify({ fatal: out.fatal, b1: out.best1, b2: out.best2, b3: out.best3, speed: out.speed }));
