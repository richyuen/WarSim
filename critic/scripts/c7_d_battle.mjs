// Critic run 7, session D: a land war's fight at every tier, live; armour in contact at T2/T3.
// Germany against Poland (declared by the God command), then the first engaged formations.
import { launch, open1938, lookAt, shot, save, hours, CELLS } from './c7_lib.mjs';

const seed = Number(process.argv[2] ?? 7781);
const tag = `c7d_${seed}`;
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
  return { el: v.elementCount ?? null, ind: v.individualCount ?? null, sorties: v.sortieMarks.length, wrecks: v.wrecks?.count ?? null };
});
try {
  await open1938(page, seed);
  await page.evaluate(({ a, d }) => window.__warsim.sim.command({ kind: 'declareWar', attacker: a, defender: d }), { a: T.GER, d: T.POL });
  let inf = [];
  let arm = [];
  for (let d = 0; d < 10 && arm.length < 1; d++) {
    await hours(page, 24);
    const all = await page.evaluate((n) => {
      const v = window.__warsim.view;
      return v.formationsOf(n).map((f) => ({ f, t: v.formationTitle(f), pos: v.formationPos(f), e: v.formationEngaged(f) })).filter((x) => x.e);
    }, T.GER);
    inf = all.filter((x) => /Infantry/i.test(x.t?.kind ?? x.t?.name ?? ''));
    arm = all.filter((x) => /Armoured|Tank|Panzer/i.test(x.t?.kind ?? x.t?.name ?? ''));
    out.day = d + 1;
    out.engaged = all.length;
  }
  out.picks = { inf: inf.slice(0, 2), arm: arm.slice(0, 3) };
  const tiers = [3000, 900, 250, 80, 25, 10];
  for (const [label, p] of [['inf', inf[0]], ['arm', arm[0]]]) {
    if (!p) continue;
    for (const m of tiers) {
      await lookAt(page, p.pos[0], p.pos[1], m);
      await live(2200);
      const s = await probe();
      out.views.push({ label, f: p.f, m, ...s });
      await shot(page, `${tag}_${label}_${String(m).padStart(4, '0')}m.png`);
      await stop();
    }
  }
  // Armour: follow one for 3 seconds at 25 m/px in 3 frames
  if (arm[0]) {
    const p = await page.evaluate((f) => window.__warsim.view.formationPos(f), arm[0].f);
    if (p) {
      await lookAt(page, p[0], p[1], 15);
      await live(200);
      for (let i = 0; i < 3; i++) {
        await page.waitForTimeout(1200);
        await shot(page, `${tag}_arm_15m_live_${i}.png`);
      }
      await stop();
    }
  }
  // Air: sorties drawn at T2 over the front?
  const [px, py] = CELLS.polfront;
  await lookAt(page, px, py, 900);
  await live(3000);
  out.air900 = await probe();
  await shot(page, `${tag}_air_900m.png`);
  await stop();
} catch (e) {
  out.fatal = String(e?.stack ?? e);
}
out.errors = errors;
save(`c7_d_${seed}.json`, out);
await browser.close();
console.log(JSON.stringify({ fatal: out.fatal, errors: errors.length, day: out.day, picks: out.picks, views: out.views }));
