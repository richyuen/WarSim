// Session J (run 5): the seed the page runs, and every British and German fleet inside the first sea battle's circle.
import { readFileSync } from 'node:fs';
import { launch, open1938, save, hours } from './c5_lib.mjs';
const tags = JSON.parse(readFileSync(new URL('../c5_tags.json', import.meta.url), 'utf8'));
const out = {};
const { browser, page, errors } = await launch();
try {
  for (const seed of [6131, 2207]) {
    await open1938(page, seed);
    const ins = await page.evaluate(() => window.__warsim.sim.inspect());
    await page.evaluate(({ g, e, j, u }) => {
      window.__warsim.sim.command({ kind: 'declareWar', attacker: g, defender: e });
      window.__warsim.sim.command({ kind: 'declareWar', attacker: j, defender: u });
    }, { g: tags.GER, e: tags.ENG, j: tags.JAP, u: tags.USA });
    await hours(page, 41);
    const r = await page.evaluate(({ g, e }) => {
      const v = window.__warsim.view;
      const sb = v.seaBattles();
      const b = sb[0];
      const fl = v.formationIds().filter((f) => v.formationAfloat(f)).map((f) => ({ f, t: v.formationTitle(f), pos: v.formationPos(f), engaged: v.formationEngaged(f) })).filter((x) => x.t && (x.t.nation === g || x.t.nation === e));
      return { sb, fleets: fl.filter((x) => b && x.pos && Math.hypot(x.pos[0] - b.x, x.pos[1] - b.y) <= b.r).map((x) => ({ name: x.t.name, nation: x.t.nation, pos: x.pos.map((p) => +p.toFixed(1)), engaged: x.engaged, dist: +Math.hypot(x.pos[0] - b.x, x.pos[1] - b.y).toFixed(1) })) };
    }, { g: tags.GER, e: tags.ENG });
    out[seed] = { inspectSeed: ins.seed, tick: ins.tick, ...r };
  }
} catch (e) {
  out.fatal = String(e?.stack ?? e);
}
out.errors = errors;
save('c5_j.json', out);
await browser.close();
console.log(JSON.stringify(out));
