// Critic run 7, session F: can the AI still decide a strike when the case arises? God Mode only sets the
// case (as a player could): France gets warheads, Germany attacks it with buffs, France fights to the death.
// No burst is placed by hand. Usage: node critic/scripts/c7_f_ainuke.mjs <seed> <days>
import { launch, open1938, lookAt, shot, save, hours, CELLS, settle } from './c7_lib.mjs';

const seed = Number(process.argv[2] ?? 2604);
const days = Number(process.argv[3] ?? 120);
const missiles = process.argv[4] === 'missiles';
const sfx = (missiles ? '_m' : '') + (process.argv[5] ?? '');
const tag = `c7f_${seed}${sfx}`;
const T = CELLS.tags;
const out = { seed, log: [], alerts: [] };
const { browser, page, errors } = await launch();
try {
  await open1938(page, seed);
  const cmd = (c) => page.evaluate((c) => window.__warsim.sim.command(c), c);
  await cmd({ kind: 'grantWarheads', nation: T.FRA, count: 6 });
  if (missiles) await cmd({ kind: 'grantTech', nation: T.FRA, tech: 'ballistic_missiles' });
  await cmd({ kind: 'declareWar', attacker: T.GER, defender: T.FRA });
  await hours(page, 2);
  const wars = await page.evaluate(() => window.__warsim.sim.inspect());
  out.inspectKeys = Object.keys(wars);
  const warId = (wars.wars ?? []).find((w) => w.attackers.includes(T.GER) && w.defenders.includes(T.FRA))?.id ?? null;
  out.warId = warId;
  for (const b of ['attack', 'defense', 'speed']) await cmd({ kind: 'grantBuff', targetKind: 'nation', target: T.GER, buff: b, magnitude: 0.6, hours: 24 * 200, nameKey: 'god.buff' });
  await cmd({ kind: 'setEfficiency', nation: T.GER, value: 2 });
  await cmd({ kind: 'setEfficiency', nation: T.FRA, value: 0.5 });
  await page.evaluate(() => {
    const w = window.__warsim;
    w.__alerts = [];
    let last = null;
    setInterval(() => {
      const a = w.hud.nukeAlert.value;
      if (a && a !== last) { last = a; w.__alerts.push({ t: w.hud.tick.value, a: JSON.parse(JSON.stringify(a)) }); }
    }, 50);
  });
  for (let d = 1; d <= days; d++) {
    if (d === 2 && warId !== null) {
      await cmd({ kind: 'setWarFightToDeath', war: warId, side: 1, value: true });
      await cmd({ kind: 'setWarFightToDeath', war: warId, side: 0, value: true });
    }
    await hours(page, 24);
    if (d % 10 === 0 || d === 2) {
      const h = await page.evaluate(() => window.__warsim.sim.history());
      const nuk = h.filter((r) => /nuc|atomic|bomb|warhead/i.test(JSON.stringify(r)));
      const st = await page.evaluate((f) => window.__warsim.hud.stats.value?.nations?.find?.((n) => n.id === f) ?? null, T.FRA);
      out.log.push({ d, nukeRows: nuk.length, fra: st ? { area: st.area, men: st.men, warheads: st.warheads, aircraft: st.aircraft } : null });
      out.alerts = await page.evaluate(() => window.__warsim.__alerts);
      save(`c7_f_${seed}${sfx}.json`, { ...out, errors });
      if (d % 30 === 0) {
        await lookAt(page, CELLS.paris[0], CELLS.paris[1], 3000);
        await shot(page, `${tag}_day${d}.png`);
      }
      if (nuk.length > 0 && !out.firstNukeDay) {
        out.firstNukeDay = d;
        out.nukeRows = nuk.slice(0, 10);
        await shot(page, `${tag}_first_alert.png`);
      }
    }
  }
  const h = await page.evaluate(() => window.__warsim.sim.history());
  out.nukeRowsEnd = h.filter((r) => /nuc|atomic|bomb|warhead/i.test(JSON.stringify(r))).slice(0, 20);
  out.histTail = h.slice(-15);
} catch (e) {
  out.fatal = String(e?.stack ?? e);
}
out.errors = errors;
save(`c7_f_${seed}${sfx}.json`, out);
await browser.close();
console.log(JSON.stringify({ fatal: out.fatal, errors: errors.length, warId: out.warId, first: out.firstNukeDay, log: out.log, alerts: out.alerts.length }));
