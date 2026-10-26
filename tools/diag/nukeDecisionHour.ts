/**
 * PLAN 7.127: `nukePoland1938.test.ts`'s set-up (a strategic bomber group at Warsaw, 10 warheads,
 * Germany's war on Poland), stepped whole days to <day>, then hour by hour to Poland's first
 * `NukeDecided`. Each hour, in Poland's war with <enemy> (GER by default; SOV for seed 4016's other
 * war): its desperation, the war's enemy side, and its four best places in reach by utility over the
 * floor, each with its parts (value, men share, the theatre its men are weighed against, the chance
 * through), the enemy side's men in the blast by nation, and the nearest land formation of Poland's
 * side (whom the men there face, if anyone).
 *
 * Usage: npx tsx tools/diag/nukeDecisionHour.ts <seed> <day> [enemy tag = GER] [hours = 72]
 */
import { EventKind } from '../../src/shared/events';
import { BUILD_MIX_1938, SIZE_1938, TAGS_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { seaKm } from '../../src/sim/systems/navalCombat';
import { blastRadius, dayIndustry, desperationOf, largestYield, nuclearUtility, placeParts, reaches, strikeFloor, weighWar } from '../../src/sim/systems/nuclear';
import type { World } from '../../src/sim/world';
import { assets1938 } from '../../tests/helpers/earth';
import { nationId } from '../../tests/helpers/sim1938';

const [POL, GER] = ['POL', 'GER'].map(nationId) as [number, number];
const tag = (n: number): string => TAGS_1938[n - 1] ?? `#${n}`;
const seed = Number(process.argv[2]);
const day = Number(process.argv[3]);
const enemyOf = nationId(process.argv[4] ?? 'GER');
const hours = Number(process.argv[5] ?? 72);
const s = new Sim({ scenario: '1938', seed, assets: assets1938(SIZE_1938.w) });
const w = s.world;
const warsaw = w.airbases.find((b) => b.name === 'Warsaw' && w.cells.controller[b.cell] === POL)!;
const [wx, wy] = w.cellPoint(warsaw.cell);
s.command({ kind: 'spawnWing', nation: POL, x: wx, y: wy, template: BUILD_MIX_1938.wings.strategic });
s.command({ kind: 'grantWarheads', nation: POL, count: 10 });
s.command({ kind: 'declareWar', attacker: GER, defender: POL });
s.step(1);
const clear = (ww: World): void => {
  ww.out.events.length = 0;
  ww.out.fires.length = 0;
};
for (let d = 0; d < day; d++) s.step(24, clear);
const radius = blastRadius(largestYield(w, POL));
const fc = w.formations.cols;
for (let h = 0; h < hours; h++) {
  const war = w.wars.list.find((v) => v.sides[1].includes(POL) && v.sides[0].includes(enemyOf));
  if (!war) {
    console.log(JSON.stringify({ hour: h, war: 'none' }));
    break;
  }
  const r = weighWar(w, POL, war, 1, dayIndustry(w));
  const { desperation, extreme } = desperationOf(w, POL, war, 1);
  const rows = r.shared
    ? r.places
        .filter((p) => reaches(w, POL, p.x, p.y))
        .map((p) => ({ p, u: nuclearUtility({ targetValue: p.value, through: p.through, people: p.people, ...r.shared! }) - strikeFloor(p.people, p.through) }))
        .sort((a, b) => b.u - a.u)
        .slice(0, 4)
        .map(({ p, u }) => {
          const parts = placeParts(w, POL, war, 1, p.x, p.y);
          const by: Record<string, number> = {};
          let ownKm = Infinity;
          let ownTag = '';
          w.formations.forEach((f) => {
            if (w.offLand(f)) return;
            const m = fc.nation[f]!;
            const km = seaKm(w, p.x, p.y, fc.x[f]!, fc.y[f]!);
            if (war.sides[1].includes(m) && km < ownKm) {
              ownKm = km;
              ownTag = tag(m);
            }
            if (war.sides[0].includes(m) && km < radius) by[tag(m)] = (by[tag(m)] ?? 0) + Math.round(fc.strength[f]!);
          });
          const cell = Math.floor(p.y) * w.cells.w + Math.floor(p.x);
          return {
            u: +u.toFixed(3),
            at: [+p.x.toFixed(1), +p.y.toFixed(1)],
            controller: tag(w.cells.controller[cell]!),
            value: +parts.value.toFixed(3),
            econShare: +parts.econShare.toFixed(4),
            menShare: +parts.menShare.toFixed(4),
            menKilled: Math.round(parts.men),
            theatreMen: Math.round(parts.theatreMen),
            menAll: Math.round(parts.menAll),
            sideMen: Math.round(parts.sideMen),
            people: parts.people,
            through: +p.through.toFixed(3),
            inBlast: by,
            ownNearest: ownTag,
            ownKm: Math.round(ownKm),
          };
        })
    : [];
  let decided = '';
  s.step(1, (ww) => {
    const ev = ww.out.events;
    for (let i = 0; i < ev.length; i += 6) if (ev[i + 2] === POL && ev[i + 1] === EventKind.NukeDecided) decided = `u ${ev[i + 3]! / 1000} at (${ev[i + 4]}, ${ev[i + 5]})`;
    clear(ww);
  });
  console.log(JSON.stringify({ hour: h, desperation: +desperation.toFixed(3), extreme, enemySide: war.sides[0].map(tag).join('+'), rows, decided }));
  if (decided) break;
}
