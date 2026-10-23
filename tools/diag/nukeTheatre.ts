/**
 * PLAN 7.92: `nukePoland1938.test.ts`'s set-up as the test makes it (a strategic bomber group at
 * Warsaw, 10 warheads, Germany's war on Poland), read only. Each day to the first burst: Poland's three
 * best places in reach by utility; for each, its value's parts (`placeParts`), the enemy side's men in
 * its blast by nation, and for each of those nations who its men there face: the nearest land formation
 * at war with that nation, whether of Poland's side in this war or of a third party (a nation of the
 * enemy side at war with another nation alone), and how far.
 *
 * Usage: npx tsx tools/diag/nukeTheatre.ts <seed> [days = 120]
 */
import { EventKind } from '../../src/shared/events';
import { nukeStrike } from '../../src/shared/history';
import { BUILD_MIX_1938, SIZE_1938, TAGS_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { seaKm } from '../../src/sim/systems/navalCombat';
import { blastRadius, dayIndustry, largestYield, nuclearUtility, placeParts, reaches, strikeFloor, weighWar } from '../../src/sim/systems/nuclear';
import type { World } from '../../src/sim/world';
import { assets1938 } from '../../tests/helpers/earth';
import { nationId } from '../../tests/helpers/sim1938';

const [POL, GER] = ['POL', 'GER'].map(nationId) as [number, number];
const tag = (n: number): string => TAGS_1938[n - 1] ?? `#${n}`;
const seed = Number(process.argv[2] ?? 5591);
const days = Number(process.argv[3] ?? 120);
const s = new Sim({ scenario: '1938', seed, assets: assets1938(SIZE_1938.w) });
const w = s.world;
const warsaw = w.airbases.find((b) => b.name === 'Warsaw' && w.cells.controller[b.cell] === POL)!;
const [wx, wy] = w.cellPoint(warsaw.cell);
s.command({ kind: 'spawnWing', nation: POL, x: wx, y: wy, template: BUILD_MIX_1938.wings.strategic });
s.command({ kind: 'grantWarheads', nation: POL, count: 10 });
s.command({ kind: 'declareWar', attacker: GER, defender: POL });
s.step(1);

/** Whether nations a and b are at war, and in which war (index), or -1. */
function warOf(world: World, a: number, b: number): number {
  return world.wars.list.findIndex((v) => (v.sides[0].includes(a) && v.sides[1].includes(b)) || (v.sides[1].includes(a) && v.sides[0].includes(b)));
}

/** The enemy side's men in the blast at (x, y) by nation, and whom each nation's men there face. */
function who(world: World, war: { sides: number[][] }, side: number, x: number, y: number): Record<string, unknown>[] {
  const fc = world.formations.cols;
  const radius = blastRadius(largestYield(world, POL));
  const enemy = new Set(war.sides[1 - side]!);
  const own = new Set(war.sides[side]!);
  const by = new Map<number, { men: number; fx: number; fy: number }>();
  world.formations.forEach((f) => {
    const m = fc.nation[f]!;
    if (!enemy.has(m) || world.offLand(f)) return;
    if (seaKm(world, x, y, fc.x[f]!, fc.y[f]!) >= radius) return;
    const e = by.get(m) ?? { men: 0, fx: fc.x[f]!, fy: fc.y[f]! };
    e.men += fc.strength[f]!;
    by.set(m, e);
  });
  const out: Record<string, unknown>[] = [];
  for (const [m, e] of by) {
    // The nearest land formation at war with m: whose, and how far.
    let near = { km: Infinity, n: 0 };
    world.formations.forEach((f) => {
      const o = fc.nation[f]!;
      if (world.offLand(f) || warOf(world, m, o) < 0) return;
      const km = seaKm(world, x, y, fc.x[f]!, fc.y[f]!);
      if (km < near.km) near = { km, n: o };
    });
    // Poland's side's nearest land formation (of this war's side).
    let ownNear = Infinity;
    world.formations.forEach((f) => {
      if (world.offLand(f) || !own.has(fc.nation[f]!)) return;
      ownNear = Math.min(ownNear, seaKm(world, x, y, fc.x[f]!, fc.y[f]!));
    });
    const others = world.wars.list
      .filter((v) => v !== war && (v.sides[0].includes(m) || v.sides[1].includes(m)))
      .map((v) => (v.sides[0].includes(m) ? v.sides[1] : v.sides[0]).map(tag).join('+'));
    out.push({ nation: tag(m), men: Math.round(e.men), faces: tag(near.n), facesKm: Math.round(near.km), facesOwnSide: own.has(near.n), ownNearKm: Math.round(ownNear), otherWars: others });
  }
  return out;
}

let burst = false;
for (let d = 0; d < days && !burst; d++) {
  const events: string[] = [];
  s.step(24, (ww) => {
    const ev = ww.out.events;
    for (let i = 0; i < ev.length; i += 6) {
      if (ev[i + 2] !== POL) continue;
      if (ev[i + 1] === EventKind.NukeDecided) events.push(`decided u ${ev[i + 3]! / 1000} at (${ev[i + 4]},${ev[i + 5]})`);
      if (ev[i + 1] === EventKind.NukeCasualties) {
        const st = nukeStrike(ev[i + 3]!);
        events.push(`burst on ${tag(st.nation)} dead ${st.dead}`);
        burst = true;
      }
    }
    ww.out.events.length = 0;
    ww.out.fires.length = 0;
  });
  const war = w.wars.list.find((v) => v.sides[1].includes(POL) && v.sides[0].includes(GER));
  if (!war) break;
  const side = 1;
  const r = weighWar(w, POL, war, side, dayIndustry(w));
  const row: Record<string, unknown> = { day: d + 1, events };
  if (r.shared) {
    const scored = r.places
      .filter((p) => reaches(w, POL, p.x, p.y))
      .map((p) => ({ p, u: nuclearUtility({ targetValue: p.value, through: p.through, people: p.people, ...r.shared! }) - strikeFloor(p.people, p.through) }))
      .sort((a, b) => b.u - a.u)
      .slice(0, 3);
    row.best = scored.map(({ p, u }) => {
      const parts = placeParts(w, POL, war, side, p.x, p.y);
      const cell = Math.floor(p.y) * w.cells.w + Math.floor(p.x);
      return {
        uOverFloor: +u.toFixed(3),
        at: [+p.x.toFixed(1), +p.y.toFixed(1)],
        controller: tag(w.cells.controller[cell]!),
        value: +parts.value.toFixed(3),
        econShare: +parts.econShare.toFixed(4),
        menShare: +parts.menShare.toFixed(4),
        menAll: Math.round(parts.menAll),
        theatreMen: Math.round(parts.theatreMen),
        sideMen: Math.round(parts.sideMen),
        people: parts.people,
        who: who(w, war, side, p.x, p.y),
      };
    });
  } else row.gate = 'noAim';
  console.log(JSON.stringify(row));
}
