/**
 * PLAN 7.35b: why two navies at war do not meet (critic R9, naval 6: Japan–USA on seed 3407, no
 * sea battle in 12 days). From 1938 (or a checkpoint), `A` declares war on `D` at once as the
 * critic did; every day at 01:00 (the naval AI acts at 00:00, `navalAi`), each fleet with power of
 * the two sides (the nations on each side of a war between `A`'s and `D`'s blocs): where it stands
 * (its nearest port, km), under way to where, and what the naval AI's sortie test sees from there
 * (`plan` in `src/sim/ai/naval.ts`): the nearest enemy port of all and its km; the nearest within
 * `SORTIE_KM`, its zone's enemy power against the power that would sail there together; why none
 * is taken. At the end, per side: its fleets' power by the sea they stand in, the least km between
 * a fleet of each side over the days, and every sea battle between the two sides.
 *
 * Usage: npx tsx tools/diag/seaMeet.ts <seed> <A> <D> [days = 12] [save.bin | new] [out = .cache/seaMeet_<seed>_<A>_<D>.json]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { size1938, TAGS_1938, TEMPLATES_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { loadAssets1938 } from '../headless/assets';
import { AT_PORT_CELLS, seaKm } from '../../src/sim/systems/navalCombat';
import { fleetPower, navalPower } from '../../src/sim/systems/seaControl';
import { blocOf } from '../../src/sim/systems/supply';
import { AVOID_RATIO, SORTIE_KM } from '../../src/sim/ai/naval';
import { portSeaOf, seaOf, seaRangeOf, type World } from '../../src/sim/world';

const seed = Number(process.argv[2]);
const A = process.argv[3] ?? 'JAP';
const D = process.argv[4] ?? 'USA';
const days = Number(process.argv[5] ?? 12);
const bin = process.argv[6] ?? 'new';
const out = process.argv[7] ?? `.cache/seaMeet_${seed}_${A}_${D}.json`;
const SZ = size1938(undefined);
const sim = new Sim({ scenario: '1938', seed, assets: loadAssets1938(SZ.w) });
if (bin !== 'new') sim.load(new Uint8Array(readFileSync(bin)));
const tag = (n: number): string => TAGS_1938[n - 1] ?? `#${n}`;
const id = (t: string): number => TAGS_1938.indexOf(t) + 1;
const nA = id(A);
const nD = id(D);
sim.command({ kind: 'declareWar', attacker: nA, defender: nD });

/** The nations at war on A's side and on D's: every nation at war with D's bloc, every one at war with A's. */
const sides = (w: World): [Set<number>, Set<number>] => {
  const a = new Set<number>();
  const d = new Set<number>();
  for (const war of w.wars.list) {
    const [s0, s1] = war.sides;
    const has = (s: readonly number[], n: number): boolean => s.some((x) => blocOf(w, x) === blocOf(w, n));
    const [mine, theirs] = has(s0, nA) && has(s1, nD) ? [s0, s1] : has(s1, nA) && has(s0, nD) ? [s1, s0] : [[], []];
    for (const x of mine) a.add(x);
    for (const x of theirs) d.add(x);
  }
  return [a, d];
};

const nearestPort = (w: World, x: number, y: number): { name: string; km: number; holder: string } => {
  let best = { name: '', km: Infinity, holder: '' };
  for (const p of w.ports) {
    const km = seaKm(w, x, y, p.x, p.y);
    if (km < best.km) best = { name: p.name, km: Math.round(km), holder: tag(w.cells.controller[p.cell]!) };
  }
  return best;
};

type Row = { day: number; side: 'A' | 'D'; id: number; nation: string; tpl: string; power: number; at: string; moving: boolean; to: string; enemyPort: string; enemyPortKm: number; inReach: number; take: string; why: string };
const rows: Row[] = [];
const battles: { day: number; a: string; b: string; at: string; fleets: number }[] = [];
const seen = new Set<object>();
let least = { km: Infinity, day: -1, a: '', d: '' };

for (let day = 0; day < days; day++) {
  sim.step(24, (w) => {
    // Every sea battle of the two sides, once each.
    const [sa, sd] = sides(w);
    for (const b of w.seaBattles) {
      if (seen.has(b)) continue;
      if ((sa.has(b.a) && sd.has(b.b)) || (sd.has(b.a) && sa.has(b.b))) {
        seen.add(b);
        battles.push({ day: Math.round(w.tick / 24 * 10) / 10, a: tag(b.a), b: tag(b.b), at: nearestPort(w, b.x, b.y).name, fleets: b.fleets.length });
      }
    }
    if (w.tick % 24 !== 1) return;
    const c = w.formations.cols;
    const z = seaOf(w);
    const water = portSeaOf(w);
    const ww = w.cells.w;
    const power = navalPower(w);
    const fleets: { id: number; side: 'A' | 'D' }[] = [];
    w.formations.forEach((f) => {
      if (!w.isFleet(f) || fleetPower(w, f) <= 0) return;
      const n = c.nation[f]!;
      if (sa.has(n)) fleets.push({ id: f, side: 'A' });
      else if (sd.has(n)) fleets.push({ id: f, side: 'D' });
    });
    for (const p of fleets) for (const q of fleets) {
      if (p.side !== 'A' || q.side !== 'D') continue;
      const km = seaKm(w, c.x[p.id]!, c.y[p.id]!, c.x[q.id]!, c.y[q.id]!);
      if (km < least.km) least = { km: Math.round(km), day: Math.floor(w.tick / 24), a: `${p.id}:${tag(c.nation[p.id]!)}`, d: `${q.id}:${tag(c.nation[q.id]!)}` };
    }
    for (const { id: f, side } of fleets) {
      const n = c.nation[f]!;
      const bloc = blocOf(w, n);
      const enemyIn = (zone: number): number => {
        let e = 0;
        for (const [b, p] of power.get(zone) ?? []) if (b !== bloc && w.wars.atWar(b, n)) e += p;
        return e;
      };
      const km = (cell: number): number => seaKm(w, c.x[f]!, c.y[f]!, (cell % ww) + 0.5, Math.floor(cell / ww) + 0.5);
      // At a port its bloc holds, as `plan`'s `atOwnPort` (within AT_PORT_CELLS of the port's water).
      const near = (a: number, b: number): boolean => {
        let dx = Math.abs((a % ww) - (b % ww));
        if (w.settings.loopingMap && dx > ww / 2) dx = ww - dx;
        return dx <= w.atSize(AT_PORT_CELLS) && Math.abs(Math.floor(a / ww) - Math.floor(b / ww)) <= w.atSize(AT_PORT_CELLS);
      };
      const cellOf = (g: number): number => Math.floor(c.y[g]!) * ww + Math.floor(c.x[g]!);
      const atOwnPort = (g: number): boolean => w.ports.some((p, i) => water[i]! >= 0 && w.cells.controller[p.cell] !== 0 && blocOf(w, w.cells.controller[p.cell]!) === bloc && near(cellOf(g), water[i]!));
      // Its nation's warfleets that stand at its bloc's ports (the `together` of `plan`).
      const mineAtPort: number[] = [];
      w.formations.forEach((g) => {
        if (!w.isFleet(g) || c.nation[g] !== n || c.moving[g] === 1 || c.engaged[g] === 1 || seaRangeOf(w, g) !== undefined || fleetPower(w, g) <= 0) return;
        if (atOwnPort(g)) mineAtPort.push(g);
      });
      let anyBest = { name: '', km: Infinity };
      let take = '';
      let why = '';
      const home = atOwnPort(f);
      let inReach = 0;
      let bestKm = Infinity;
      w.ports.forEach((p, i) => {
        const holder = w.cells.controller[p.cell]!;
        const at = water[i]!;
        if (holder === 0 || at < 0 || !w.wars.atWar(n, holder)) return;
        const zone = z.zoneOf[at]!;
        if (zone === 0 || z.closed[zone] === 1) return;
        const d = km(at);
        if (d < anyBest.km) anyBest = { name: `${p.name}(${tag(holder)})`, km: Math.round(d) };
        if (d > SORTIE_KM) return;
        inReach++;
        const together = mineAtPort.reduce((s, g) => s + (seaKm(w, c.x[g]!, c.y[g]!, (at % ww) + 0.5, Math.floor(at / ww) + 0.5) <= SORTIE_KM ? fleetPower(w, g) : 0), 0);
        const e = enemyIn(zone);
        if (e <= together) {
          if (d < bestKm) [bestKm, take] = [d, `${p.name}(${tag(holder)}) ${Math.round(d)} km, enemy ${Math.round(e)} ≤ ${Math.round(together)}`];
        } else if (!why) why = `${p.name}(${tag(holder)}) ${Math.round(d)} km: enemy ${Math.round(e)} > together ${Math.round(together)}`;
      });
      if (!take && inReach === 0) why = `no enemy port within ${SORTIE_KM} km`;
      if (!home) {
        // Away from its bloc's ports, `plan` sorties nothing: it stays, or turns home where the enemy is AVOID_RATIO times the stronger.
        const e = enemyIn(z.zoneOf[cellOf(f)]!);
        const p = fleetPower(w, f);
        take = '';
        why = `away: zone's enemy ${Math.round(e)} ${e > AVOID_RATIO * p ? '>' : '≤'} ${AVOID_RATIO} × ${Math.round(p)} → ${e > AVOID_RATIO * p ? 'home' : 'stays'}`;
      }
      const np = nearestPort(w, c.x[f]!, c.y[f]!);
      const t = c.targetCell[f]!;
      rows.push({
        day: Math.floor(w.tick / 24),
        side,
        id: f,
        nation: tag(n),
        tpl: TEMPLATES_1938[c.template[f]!]?.id ?? String(c.template[f]),
        power: Math.round(fleetPower(w, f)),
        at: `${np.name}(${np.holder}) ${np.km} km`,
        moving: c.moving[f] === 1,
        to: c.moving[f] === 1 ? nearestPort(w, (t % ww) + 0.5, Math.floor(t / ww) + 0.5).name : '',
        enemyPort: anyBest.name,
        enemyPortKm: anyBest.km,
        inReach,
        take,
        why,
      });
    }
  });
}

const w = sim.world;
const [sa, sd] = sides(w);
const res = { seed, A, D, days, sideA: [...sa].map(tag), sideD: [...sd].map(tag), least, battles, rows };
writeFileSync(out, JSON.stringify(res, null, 1));
// A short print: the first day's and the last day's rows, the least km, the battles.
const print = (r: Row): string => `d${r.day} ${r.side} ${r.id} ${r.nation} ${r.tpl} p${r.power} @${r.at}${r.moving ? ` → ${r.to}` : ''} | nearest enemy port ${r.enemyPort} ${r.enemyPortKm} km, ${r.inReach} in reach | ${r.take ? `take ${r.take}` : `none: ${r.why}`}`;
console.log(`sides: A ${res.sideA.join(' ')} | D ${res.sideD.join(' ')}`);
for (const r of rows.filter((r) => r.day === 1 || r.day === 6 || r.day === days - 1)) console.log(print(r));
console.log('least km A–D fleets:', JSON.stringify(least));
console.log('battles A–D:', JSON.stringify(battles));
console.log(`written ${out}`);
