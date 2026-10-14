// Session B (run 5): an air war watched as a player would. Germany on Poland, seed from argv.
// Find the first hour with an air fight that has sorties of two nations near it, then look at it at
// every tier with the frame loop running (no rigging of the marks), and watch it run at speed.
import { readFileSync } from 'node:fs';
import { launch, open1938, lookAt, shot, save, settle, hours } from './c5_lib.mjs';
const seed = Number(process.argv[2] ?? 8317);
const tag = `c5b_${seed}`;
const out = { seed, shots: [], hours: [], tiers: [], live: [] };
const { browser, page, errors } = await launch();
const id = async (t) => page.evaluate((t) => window.__warsim.sim.inspect().then((i) => i.nations.find((n) => n.tag === t)?.id), t);
try {
  await open1938(page, seed);
  const tagOf = JSON.parse(readFileSync(new URL('../c5_tags.json', import.meta.url), 'utf8'));
  out.ger = tagOf.GER;
  out.pol = tagOf.POL;
  await page.evaluate(({ a, d }) => window.__warsim.sim.command({ kind: 'declareWar', attacker: a, defender: d }), { a: tagOf.GER, d: tagOf.POL });
  let fight = null;
  for (let h = 0; h < 120 && !fight; h++) {
    await hours(page, 1);
    const r = await page.evaluate(() => {
      const v = window.__warsim.view;
      const last = Math.max(...v.airFx.marks.map((k) => k.born), -Infinity);
      const hm = v.airFx.marks.filter((k) => k.born === last);
      return { tick: v.lastTick, sorties: v.sorties.length / 11, fights: hm.filter((k) => k.kind === 0).map((k) => ({ x: k.x, y: k.y, lost: k.lost })), bombs: hm.filter((k) => k.kind === 1).length, flak: hm.filter((k) => k.kind === 2).length };
    });
    out.hours.push({ h, tick: r.tick, sorties: r.sorties, fights: r.fights.length, bombs: r.bombs, flak: r.flak });
    if (r.fights.length > 0 && r.fights.some((f) => f.x > 1000 && f.x < 1200 && f.y > 200 && f.y < 330)) {
      fight = r.fights.find((f) => f.x > 1000 && f.x < 1200 && f.y > 200 && f.y < 330);
      out.fightHour = h;
    }
  }
  out.fight = fight;
  if (fight) {
    // Each tier, frame loop natural: a shot right after the camera arrives (the marks are seconds old by now).
    for (const m of [4000, 1000, 300, 150, 40, 15, 5]) {
      await lookAt(page, fight.x, fight.y, m, false);
      await page.waitForTimeout(150);
      const s = await page.evaluate(() => {
        const v = window.__warsim.view;
        return { m: Math.round(v.metresPerPx), sorties: v.sortieMarks.length, shown: v.airFx.shown.slice(), marks: v.airFx.marks.length, el: v.elementCount, ind: v.individualCount, shares: { ...v.shares } };
      });
      out.tiers.push(s);
      out.shots.push(await shot(page, `${tag}_10_tier_${String(m).padStart(4, '0')}m.png`));
    }
    // Live: speed x1 then x3, camera at T1 over the fight, 16 samples one per second; then T2 150 m.
    for (const [lvl, m] of [[0, 1000], [4, 1000], [0, 150], [0, 20]]) {
      await lookAt(page, fight.x, fight.y, m, false);
      await page.evaluate((lvl) => {
        const h = window.__warsim.hud;
        h.setSpeedLevel(lvl);
        window.__warsim.sim.setPaused(false);
        h.paused.value = false;
      }, lvl);
      const t0 = await page.evaluate(() => window.__warsim.view.lastTick);
      let best = null;
      for (let i = 0; i < 16; i++) {
        await page.waitForTimeout(1000);
        const s = await page.evaluate(() => {
          const v = window.__warsim.view;
          return { tick: v.lastTick, sorties: v.sortieMarks.length, shown: v.airFx.shown.slice() };
        });
        out.live.push({ lvl, m, i, ...s });
        const score = s.sorties + 3 * (s.shown[0] + s.shown[1] + s.shown[2]);
        if (!best || score > best.score) {
          best = { score, i };
          await shot(page, `${tag}_20_live_l${lvl}_${m}m_best.png`);
        }
        if (i === 5) out.shots.push(await shot(page, `${tag}_20_live_l${lvl}_${m}m_s5.png`));
      }
      const t1 = await page.evaluate(() => window.__warsim.view.lastTick);
      out.live.push({ lvl, m, hoursIn16s: t1 - t0, best });
      out.shots.push(`critic/shots/${tag}_20_live_l${lvl}_${m}m_best.png`);
      await page.evaluate(() => {
        window.__warsim.sim.setPaused(true);
        window.__warsim.hud.paused.value = true;
      });
      await page.waitForTimeout(500);
    }
    // Air superiority mode over the front.
    await page.evaluate(() => window.__warsim.hud.setMapMode('airControl'));
    await lookAt(page, fight.x, fight.y, 2500);
    await page.waitForTimeout(600);
    out.shots.push(await shot(page, `${tag}_30_aircontrol_2500m.png`));
    await page.evaluate(() => window.__warsim.hud.setMapMode('political'));
  }
  out.ticker = await page.evaluate(() => document.querySelector('[data-testid=ticker]')?.innerText?.slice(0, 1500) ?? null);
  const hist = await page.evaluate(() => window.__warsim.sim.history());
  out.historyLen = hist.length;
  out.historyAir = hist.filter((r) => /air|bomb|sortie|plane|wing/i.test(JSON.stringify(r))).slice(0, 20);
  out.historyTail = hist.slice(-25);
} catch (e) {
  out.fatal = String(e?.stack ?? e);
}
out.errors = errors;
save(`c5_b_${seed}.json`, out);
await browser.close();
console.log(JSON.stringify({ fatal: out.fatal, errors: errors.length, fightHour: out.fightHour, fight: out.fight, tiers: out.tiers, liveSummary: out.live.filter((l) => l.hoursIn16s !== undefined) }, null, 0));
