/**
 * PLAN 7.28: the critic's set-ups. France (seed 7127, 10 warheads, Germany's war, 100 days) and
 * Poland (seeds 5591, 7127, 3929, 10 warheads and a strategic group at Warsaw, 120 days): each
 * launch and what became of it, each day held by the gap after a launch (STRIKE_GAP_DAYS) with the
 * outcome of the launch that began it and whether the day would have been a strike.
 * Usage: npx tsx tools/diag/nukeGap.ts FRA|POL <seed> [days]
 */
import { Sim } from '../../src/sim/sim';
import { SIZE_1938, BUILD_MIX_1938 } from '../../src/sim/scenario1938';
import { assets1938 } from '../../tests/helpers/earth';
import { nationId } from '../../tests/helpers/sim1938';
import { EventKind } from '../../src/shared/events';
import { nukeStrike } from '../../src/shared/history';
import { avengingOf, canDeliver, dayIndustry, NUKE_FLOOR, nuclearUtility, reaches, strikePaused, warheadsOf, weighWar } from '../../src/sim/systems/nuclear';

const who = process.argv[2]!;
const seed = Number(process.argv[3]);
const days = Number(process.argv[4] ?? (who === 'FRA' ? 100 : 120));
const s = new Sim({ scenario: '1938', seed, assets: assets1938(SIZE_1938.w) });
const w = s.world;
const N = nationId(who);
const GER = nationId('GER');
if (who === 'POL') {
  const warsaw = w.airbases.find((b) => b.name === 'Warsaw' && w.cells.controller[b.cell] === N)!;
  const [x, y] = w.cellPoint(warsaw.cell);
  s.command({ kind: 'spawnWing', nation: N, x, y, template: BUILD_MIX_1938.wings.strategic });
}
s.command({ kind: 'grantWarheads', nation: N, count: 10 });
s.command({ kind: 'declareWar', attacker: GER, defender: N });
const log: string[] = [];
const launches = new Map<number, { tick: number; out: string }>();
let nextId = w.nextLaunchId;
const held = { burst: 0, short: 0, flight: 0, burstStrike: 0, shortStrike: 0, flightStrike: 0 };
for (let d = 0; d < days; d++) {
  s.step(24, (ww) => {
    const ev = ww.out.events;
    for (let i = 0; i < ev.length; i += 6) {
      const k = ev[i + 1];
      if (k === EventKind.NukeLaunched) {
        const id = nextId++;
        if (ev[i + 2] === N) {
          launches.set(id, { tick: ev[i]!, out: 'flight' });
          log.push(`day ${d} h${ev[i]! % 24}: launch #${id} by ${ev[i + 3] ? 'missile' : 'bomber'} at ${ev[i + 4]},${ev[i + 5]}`);
        }
      }
      if (k === EventKind.NukeIntercepted && ev[i + 2] === N) {
        launches.get(ev[i + 3]!)!.out = 'short';
        log.push(`day ${d} h${ev[i]! % 24}: #${ev[i + 3]} stopped short`);
      }
      if (k === EventKind.NukeCasualties && ev[i + 2] === N) log.push(`day ${d} h${ev[i]! % 24}: burst on ${nukeStrike(ev[i + 3]!).nation} dead ${nukeStrike(ev[i + 3]!).dead}`);
      if (k === EventKind.NukeDecided && ev[i + 2] === N) log.push(`day ${d}: decided u=${ev[i + 3]! / 1000}`);
    }
    ww.out.events.length = 0;
    ww.out.fires.length = 0;
  });
  for (const [id, l] of launches) if (l.out === 'flight' && !w.nukeLaunches.some((x) => x.id === id)) l.out = 'burst';
  const war = w.wars.list.find((x) => x.sides[1].includes(N));
  if (!war) {
    log.push(`day ${d}: the war is over`);
    break;
  }
  if (!canDeliver(w, N)) log.push(`day ${d}: cannot deliver (warheads ${warheadsOf(w, N)})`);
  if (avengingOf(w, N) || !strikePaused(w, war, 1)) continue;
  const t = war.lastStrike![1];
  const l = [...launches.values()].find((x) => x.tick === t);
  const o = (l?.out ?? 'burst') as 'burst' | 'short' | 'flight';
  const r = weighWar(w, N, war, 1, dayIndustry(w));
  let strike = false;
  if (r.shared) for (const p of r.places) if (nuclearUtility({ targetValue: p.value, through: p.through, people: p.people, ...r.shared }) > NUKE_FLOOR && reaches(w, N, p.x, p.y)) strike = true;
  held[o]++;
  if (strike) held[`${o}Strike`]++;
  log.push(`day ${d}: held (gap after a launch that ${o === 'short' ? 'was stopped short' : o === 'burst' ? 'burst' : 'is in flight'})${strike ? ', a strike otherwise' : ''}`);
}
console.log(log.filter((x, i, a) => !(x.includes('cannot deliver') && a[i - 1]?.includes('cannot deliver'))).join('\n'));
console.log(`done: ${who} seed ${seed}`, JSON.stringify(held), 'warheads left', warheadsOf(w, N));
