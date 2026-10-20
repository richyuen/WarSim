/**
 * PLAN 7.18 (critic R8-B1: "France and Poland, given 10 warheads in the editor and overrun, never
 * strike in 120 to 150 days"): the critic's set-up, day by day. On 1938 seed <seed>, <holder> is given
 * <warheads> and <attacker> declares war on it; each day the holder's nuclear decision as the AI weighs
 * it (`weighWar`, `nuclearUtility`, `reaches`): the gate that stops it, the desperation, the best
 * place's utility and its parts, the delivery it has (strategic bomber wings, missiles), its land and
 * men against the war's start.
 *
 * With `bomber` last (PLAN 7.37b, the critic's Czechoslovakia), the holder is also given a strategic
 * bomber group at its capital, as the editor's air-wing tool places one, and a row is printed each day.
 *
 * Usage: npx tsx tools/diag/nukeCase.ts <seed> <holder> <attacker> [warheads = 10] [days = 150] [bomber]
 */
import { Sim } from '../../src/sim/sim';
import { SIZE_1938, TAGS_1938 } from '../../src/sim/scenario1938';
import { assets1938 } from '../../tests/helpers/earth';
import { EventKind } from '../../src/shared/events';
import { avengingOf, dayIndustry, desperationOf, nuclearUtility, NUKE_FLOOR, reaches, strikePaused, warheadsOf, weighsStrikes, weighsWar, weighWar } from '../../src/sim/systems/nuclear';

const [seedArg, holderTag, attackerTag] = process.argv.slice(2);
const warheads = Number(process.argv[5] ?? 10);
const days = Number(process.argv[6] ?? 150);
const s = new Sim({ scenario: '1938', seed: Number(seedArg), assets: assets1938(SIZE_1938.w) });
const w = s.world;
const id = (t: string): number => TAGS_1938.indexOf(t) + 1;
const tag = (n: number): string => TAGS_1938[n - 1] ?? `#${n}`;
const H = id(holderTag!);
const A = id(attackerTag!);
const bomber = process.argv[7] === 'bomber';
if (bomber) {
  const rules = w.rules!;
  const template = rules.templates.findIndex((t) => t.elements.length > 0 && rules.units[t.elements[0]!.unit]!.cls === 'bomber_str');
  s.command({ kind: 'spawnWing', nation: H, x: w.nations.cols.capitalX[H]!, y: w.nations.cols.capitalY[H]!, template });
}
s.command({ kind: 'grantWarheads', nation: H, count: warheads });
s.command({ kind: 'declareWar', attacker: A, defender: H });
const strategicWings = (): number => {
  let k = 0;
  const f = w.formations.cols;
  w.formations.forEach((fid) => {
    if (f.nation[fid] !== H || !w.isWing(fid)) return;
    const t = w.rules!.templates[f.template[fid]!]!;
    if (t.elements.some((e) => w.rules!.units[e.unit]!.cls === 'bomber_str')) k++;
  });
  return k;
};
const startLand = w.landCounts().owned[H]!;
for (let d = 0; d < days; d++) {
  const bursts: string[] = [];
  s.step(24, (ww) => {
    const ev = ww.out.events;
    for (let i = 0; i < ev.length; i += 6) if (ev[i + 1] === EventKind.NukeDecided && ev[i + 2] === H) bursts.push(`decided u ${ev[i + 3]! / 1000}`);
    ww.out.events.length = 0;
    ww.out.fires.length = 0;
  });
  if (!bomber && d % 5 !== 4 && bursts.length === 0) continue;
  const row: Record<string, unknown> = { day: d + 1, warheads: warheadsOf(w, H), weighs: weighsStrikes(w, H), strategicWings: strategicWings(), land: +(w.landCounts().owned[H]! / startLand).toFixed(3), lost: +(w.landCounts().lost[H]! / Math.max(1, w.landCounts().owned[H]!)).toFixed(3), capitalFallen: w.wars.list.some((x) => x.capitalsLost?.includes(H)), bursts };
  const war = w.wars.list.find((x) => x.sides[0].includes(H) || x.sides[1].includes(H));
  if (war && weighsStrikes(w, H)) {
    const side = war.sides[0].includes(H) ? 0 : 1;
    if (weighsWar(w, H, war, side, avengingOf(w, H))) {
      const { desperation, extreme } = desperationOf(w, H, war, side);
      const r = weighWar(w, H, war, side, dayIndustry(w));
      row.desperation = +desperation.toFixed(2);
      row.extreme = extreme;
      row.exhaustion = war.exhaustion[side]!.toFixed(0);
      row.score = war.score;
      if (!avengingOf(w, H) && strikePaused(w, war, side)) row.gate = 'paused';
      else if (!r.shared) row.gate = 'noAim';
      else if (r.places.length === 0) row.gate = 'noPlace';
      else {
        let best: { u: number; raw: number; value: number; x: number; y: number; reach: boolean } | null = null;
        for (const p of r.places) {
          const u = nuclearUtility({ targetValue: p.value, through: p.through, ...r.shared });
          const raw = nuclearUtility({ targetValue: p.value, through: p.through, ...r.shared, mad: false });
          if (!best || raw > best.raw) best = { u, raw, value: p.value, x: p.x, y: p.y, reach: reaches(w, H, p.x, p.y) };
        }
        row.gate = best!.u > NUKE_FLOOR ? (best!.reach ? 'strike' : 'noReach') : best!.raw > NUKE_FLOOR ? 'mad' : 'low';
        row.best = { u: +best!.u.toFixed(3), raw: +best!.raw.toFixed(3), value: +best!.value.toFixed(3), reach: best!.reach };
        row.parts = Object.fromEntries(Object.entries(r.shared).map(([k, v]) => [k, typeof v === 'number' ? +v.toFixed(3) : v]));
        row.aim = [...r.aim.at].map(tag);
      }
    } else row.gate = 'notWeighed';
  } else row.gate = war ? 'notWeighing' : 'noWar';
  console.log(JSON.stringify(row));
}
