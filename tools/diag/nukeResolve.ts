/**
 * PLAN 7.18h: what each strike decided falls on, and why. For each `NukeDecided`, the war whose
 * side remembers it (`War.lastStrike`), whether the resolve to end a long war drove it (the side's
 * own desperation under its resolve, PLAN 7.18e), the place's parts (`placeParts`: the enemy side's
 * output and men there, the men of the theatre, the capital, the chance through), the nation whose
 * land it is and that nation's share of the enemy side's output; and the burst's toll. PLAN 7.18i:
 * the launches stopped short (`NukeIntercepted`) too.
 *
 * Usage: npx tsx tools/diag/nukeResolve.ts <seed> [years = 30] [out = .cache/nukeResolve_<seed>.json]
 */
import { writeFileSync } from 'node:fs';
import { Sim } from '../../src/sim/sim';
import { SIZE_1938, TAGS_1938 } from '../../src/sim/scenario1938';
import { assets1938 } from '../../tests/helpers/earth';
import { EventKind } from '../../src/shared/events';
import { nukeStrike } from '../../src/shared/history';
import { desperationOf, industryHeld, madWar, placeParts, RESOLVE, RESOLVE_FULL_DAYS, RESOLVE_GAP_DAYS, RESOLVE_STRIKES, retaliationRisk } from '../../src/sim/systems/nuclear';
import { cellX } from '../../src/sim/systems/elements';

const seed = Number(process.argv[2]);
const years = Number(process.argv[3] ?? 30);
const s = new Sim({ scenario: '1938', seed, assets: assets1938(SIZE_1938.w) });
const w = s.world;
const tag = (n: number): string => TAGS_1938[n - 1] ?? `#${n}`;
const r3 = (v: number): number => +v.toFixed(3);
const bursts: { day: number; n: string; struck: string; dead: number; x: number; y: number }[] = [];
const decisions: Record<string, unknown>[] = [];
const intercepted: { day: number; n: string; x: number; y: number }[] = [];
// Each war side's last strike decided, and how many of its strikes its resolve drove.
const lastBySide = new Map<string, number>();
const resolveCount = new Map<string, number>();
let day = 0;
for (let y = 0; y < years; y++) {
  for (let d = 0; d < 365; d++, day++) {
    const decided: { tick: number; n: number; u: number; x: number; y: number }[] = [];
    s.step(24, (ww) => {
      const ev = ww.out.events;
      for (let i = 0; i < ev.length; i += 6) {
        if (ev[i + 1] === EventKind.NukeCasualties) {
          const k = nukeStrike(ev[i + 3]!);
          bursts.push({ day, n: tag(ev[i + 2]!), struck: tag(k.nation), dead: k.dead, x: ev[i + 4]!, y: ev[i + 5]! });
        }
        if (ev[i + 1] === EventKind.NukeIntercepted) intercepted.push({ day, n: tag(ev[i + 2]!), x: ev[i + 4]!, y: ev[i + 5]! });
        if (ev[i + 1] === EventKind.NukeDecided) decided.push({ tick: ev[i]!, n: ev[i + 2]!, u: ev[i + 3]! / 1000, x: ev[i + 4]!, y: ev[i + 5]! });
      }
      ww.out.events.length = 0;
      ww.out.fires.length = 0;
    });
    if (decided.length === 0) continue;
    const held = industryHeld(w);
    for (const o of decided) {
      const war = w.wars.list.find((wr) => wr.lastStrike?.some((t, sd) => t === o.tick && wr.sides[sd]!.includes(o.n)));
      if (!war) {
        decisions.push({ day, n: tag(o.n), u: o.u, x: o.x, y: o.y, war: null });
        continue;
      }
      const side = war.sides[0].includes(o.n) ? 0 : 1;
      const { desperation, extreme } = desperationOf(w, o.n, war, side);
      const warDays = Math.floor((w.tick - war.startTick) / 24);
      const retal = retaliationRisk(w, war, side);
      // The resolve at the decision: the side's strike before it (kept here, as `War.lastStrike` is now this one's) RESOLVE_GAP_DAYS or more ago, under RESOLVE_STRIKES of its resolve before.
      const key = `${war.id}:${side}`;
      const prev = lastBySide.get(key);
      const count = resolveCount.get(key) ?? 0;
      const gapOk = prev === undefined || o.tick - prev >= RESOLVE_GAP_DAYS * 24;
      const resolve = retal > 0 || madWar(w, war) || warDays < 365 || !gapOk || count >= RESOLVE_STRIKES ? 0 : RESOLVE * Math.min(1, warDays / RESOLVE_FULL_DAYS);
      lastBySide.set(key, o.tick);
      const xx = cellX(w, Math.floor(o.x));
      const owner = xx === null ? 0 : w.cells.owner[Math.floor(o.y) * w.cells.w + xx]!;
      let sideOut = 0;
      let top = 0;
      for (const m of war.sides[1 - side]!) {
        sideOut += held[m] ?? 0;
        top = Math.max(top, held[m] ?? 0);
      }
      if (!extreme && resolve > desperation) resolveCount.set(key, count + 1);
      const p = placeParts(w, o.n, war, side, o.x, o.y);
      decisions.push({
        day,
        n: tag(o.n),
        u: o.u,
        x: o.x,
        y: o.y,
        war: war.id,
        enemies: war.sides[1 - side]!.map(tag),
        warDays,
        score: side === 0 ? war.score : -war.score,
        desperation: r3(desperation),
        extreme,
        resolve: r3(resolve),
        byResolve: !extreme && resolve > desperation,
        owner: tag(owner),
        ownerShare: r3(sideOut > 0 ? (held[owner] ?? 0) / sideOut : 0),
        ownerOfTop: r3(top > 0 ? (held[owner] ?? 0) / top : 0),
        econShare: r3(p.econShare),
        menShare: r3(p.menShare),
        ownShare: r3(p.ownShare),
        menAll: Math.round(p.menAll),
        theatreMen: Math.round(p.theatreMen),
        sideMen: Math.round(p.sideMen),
        capital: p.capital,
        through: r3(p.through),
        value: r3(p.value),
      });
    }
  }
  process.stderr.write(`seed ${seed} year ${y + 1}: decisions ${decisions.length}\n`);
}
// Each decision's toll: its burst at the same point (none when stopped short).
for (const dcs of decisions) {
  const b = bursts.find((b) => b.x === dcs.x && b.y === dcs.y && b.day >= (dcs.day as number));
  dcs.dead = b ? b.dead : null;
}
writeFileSync(process.argv[4] ?? `.cache/nukeResolve_${seed}.json`, JSON.stringify({ seed, years, decisions, bursts, intercepted }, null, 1));
console.log(`done: seed ${seed} decisions ${decisions.length} bursts ${bursts.length} intercepted ${intercepted.length}`);
