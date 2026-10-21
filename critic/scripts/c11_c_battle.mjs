// Critic run 11, session C: a land war at every tier, live; armour in contact; contact lines, wrecks.
// Germany against Poland by God command (also France against Germany for a western front).
// Usage: node critic/scripts/c11_c_battle.mjs <seed>
import { launch, open1938, lookAt, shot, save, hours, CELLS } from './c11_lib.mjs';

const seed = Number(process.argv[2] ?? 6047);
const tag = `c11c_${seed}`;
const T = CELLS.tags;
const out = { seed, views: [], picks: [] };
const { browser, page, errors } = await launch();
const live = async (ms) => {
  await page.evaluate(() => { window.__warsim.hud.setSpeedLevel(0); if (window.__warsim.hud.paused.value) window.__warsim.hud.togglePause(); });
  await page.waitForTimeout(ms);
};
const stop = async () => page.evaluate(() => { if (!window.__warsim.hud.paused.value) window.__warsim.hud.togglePause(); });
const probe = () => page.evaluate(() => {
  const v = window.__warsim.view;
  return { el: v.elementCount ?? null, ind: v.individualCount ?? null, sorties: v.sortieMarks?.length ?? null, wrecks: v.wrecks?.count ?? null, contact: v.contactLinesShown?.length ?? null, mpp: v.metresPerPx };
});
try {
  await open1938(page, seed);
  await page.evaluate(({ a, d }) => window.__warsim.sim.command({ kind: 'declareWar', attacker: a, defender: d }), { a: T.GER, d: T.POL });
  let inf = [];
  let arm = [];
  for (let d = 0; d < 12 && arm.length < 1; d++) {
    await hours(page, 24);
    const all = await page.evaluate((n) => {
      const v = window.__warsim.view;
      return v.formationsOf(n).map((f) => ({ f, t: v.formationTitle(f), pos: v.formationPos(f), e: v.formationEngaged(f) })).filter((x) => x.e);
    }, T.GER);
    inf = all.filter((x) => /Infantry/i.test(JSON.stringify(x.t)));
    arm = all.filter((x) => /Armoured|Tank|Panzer/i.test(JSON.stringify(x.t)));
    out.day = d + 1;
    out.engaged = all.length;
  }
  out.picks = { inf: inf.slice(0, 2), arm: arm.slice(0, 3) };
  const tiers = [3000, 900, 250, 80, 25, 10];
  for (const [label, p] of [['inf', inf[0]], ['arm', arm[0]]]) {
    if (!p) continue;
    for (const m of tiers) {
      const pos = await page.evaluate((f) => window.__warsim.view.formationPos(f), p.f);
      if (!pos) break;
      await lookAt(page, pos[0], pos[1], m);
      await live(2500);
      const s = await probe();
      out.views.push({ label, f: p.f, m, ...s });
      await shot(page, `${tag}_${label}_${String(m).padStart(4, '0')}m.png`);
      await stop();
    }
  }
  if (arm[0]) {
    const p = await page.evaluate((f) => window.__warsim.view.formationPos(f), arm[0].f);
    if (p) {
      await lookAt(page, p[0], p[1], 15);
      await live(200);
      for (let i = 0; i < 3; i++) {
        await page.waitForTimeout(1500);
        out.views.push({ label: 'arm15live', i, ...(await probe()) });
        await shot(page, `${tag}_arm_15m_live_${i}.png`);
      }
      await stop();
    }
  }
  // A week on, the same front at 80 and 25 m/px: wrecks left?
  await hours(page, 24 * 7);
  const all2 = await page.evaluate((n) => {
    const v = window.__warsim.view;
    return v.formationsOf(n).map((f) => ({ f, t: v.formationTitle(f), pos: v.formationPos(f), e: v.formationEngaged(f) })).filter((x) => x.e);
  }, T.GER);
  out.engagedWeek2 = all2.length;
  const a2 = all2.find((x) => /Armoured/i.test(JSON.stringify(x.t))) ?? all2[0];
  if (a2) {
    for (const m of [250, 80, 25]) {
      await lookAt(page, a2.pos[0], a2.pos[1], m);
      await live(2500);
      out.views.push({ label: 'week2', f: a2.f, m, ...(await probe()) });
      await shot(page, `${tag}_week2_${String(m).padStart(4, '0')}m.png`);
      await stop();
    }
  }
} catch (e) {
  out.fatal = String(e?.stack ?? e);
}
out.errors = errors;
save(`c11_c_${seed}.json`, out);
await browser.close();
console.log(JSON.stringify({ fatal: out.fatal, errors: errors.length, day: out.day, picks: out.picks, views: out.views }));
