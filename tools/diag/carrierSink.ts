/**
 * PLAN 7.57: what an air strike on ships does to them. From 1938 (or a checkpoint), optionally with
 * `A` declaring war on `D` at once (the critic's 8693 JAP → USA; `-` for none), every hour for
 * `days`: each fleet struck that hour (a `StrikeHit` on it), by the kind of strike, a carrier's
 * wings (`navalCombatSystem`) or a land-based wing's (`strikes`, PLAN 5.4c), one strike a fleet an
 * hour of each kind however many wings struck it; its ships before, the ships it lost in that hour
 * (by any fire: a carrier's battle may also have guns in reach) and the wound its ships took.
 * Also the war's `SeaBattle` history lines (the ships each side lost, as the page shows them).
 *
 * Usage: npx tsx tools/diag/carrierSink.ts <seed> <A | -> <D> [days = 20] [save.bin | new] [out = .cache/carrierSink_<seed>.json]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { size1938, TAGS_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { loadAssets1938 } from '../headless/assets';
import { elementIndex } from '../../src/sim/systems/elements';
import { EventKind } from '../../src/shared/events';
import { seaSide } from '../../src/shared/history';
import { Domain, type World } from '../../src/sim/world';

const seed = Number(process.argv[2]);
const A = process.argv[3] ?? 'JAP';
const D = process.argv[4] ?? 'USA';
const days = Number(process.argv[5] ?? 20);
const bin = process.argv[6] ?? 'new';
const out = process.argv[7] ?? `.cache/carrierSink_${seed}_${A}_${D}.json`;
const SZ = size1938(undefined);
const sim = new Sim({ scenario: '1938', seed, assets: loadAssets1938(SZ.w) });
if (bin !== 'new') sim.load(new Uint8Array(readFileSync(bin)));
const tag = (n: number): string => TAGS_1938[n - 1] ?? `#${n}`;
const id = (t: string): number => TAGS_1938.indexOf(t) + 1;
if (A !== '-') sim.command({ kind: 'declareWar', attacker: id(A), defender: id(D) });

type El = { s: number; w: number; f: number };
/** Every sea element: its ships, wound and fleet. */
const seaEls = (w: World): Map<number, El> => {
  const m = new Map<number, El>();
  const ec = w.elements.cols;
  const units = w.rules!.units;
  for (const [f, els] of elementIndex(w)) for (const e of els) if (units[ec.unit[e]!]!.domain === Domain.sea) m.set(e, { s: ec.strength[e]!, w: ec.wound[e]!, f });
  return m;
};

type Kind = 'carrier' | 'land';
type Strike = { h: number; kind: Kind; wings: string; fleet: number; nation: string; ships: number; sunk: number; hpUnits: number; untouched: boolean };
const strikes: Strike[] = [];
const battles: { h: number; a: string; lostA: number; b: string; lostB: number }[] = [];
let prev = new Map<number, El>();
const nationOf = new Map<number, number>();
/** Each fleet's ships when first seen (PLAN 7.60: a strike on a fleet that had lost none). */
const firstShips = new Map<number, number>();
for (let t = 0; t < days * 24; t++) {
  sim.step(1, (w) => {
    const now = seaEls(w);
    const c = w.formations.cols;
    const ev = w.out.events;
    const fleets = new Set([...prev.values()].map((e) => e.f));
    // The fleets struck this hour, by kind, with the wings that struck each.
    const struck = new Map<string, { kind: Kind; fleet: number; wings: Set<number> }>();
    for (let i = 0; i < ev.length; i += 6) {
      const kind = ev[i + 1]!;
      if (kind === EventKind.SeaBattle) {
        const [a, b] = [seaSide(ev[i + 2]!), seaSide(ev[i + 3]!)];
        battles.push({ h: w.tick, a: tag(a.nation), lostA: a.ships, b: tag(b.nation), lostB: b.ships });
        continue;
      }
      if (kind !== EventKind.StrikeHit) continue;
      const g = ev[i + 2]!;
      const wing = ev[i + 3]!;
      if (!fleets.has(g)) continue; // a land formation
      const k: Kind = (w.wingBase.get(wing) ?? 0) < 0 ? 'carrier' : 'land';
      const key = `${k}:${g}`;
      const s = struck.get(key) ?? { kind: k, fleet: g, wings: new Set<number>() };
      s.wings.add(wing);
      struck.set(key, s);
    }
    for (const { kind, fleet: g, wings } of struck.values()) {
      let ships = 0;
      let sunk = 0;
      let hp = 0;
      for (const [e, b] of prev) {
        if (b.f !== g) continue;
        const a = now.get(e);
        const sAfter = a?.s ?? 0;
        ships += b.s;
        sunk += b.s - sAfter;
        hp += b.s - sAfter + (a?.w ?? 0) - b.w;
      }
      const n = w.formations.has(g) ? c.nation[g]! : (nationOf.get(g) ?? 0);
      strikes.push({ h: w.tick, kind, wings: [...wings].map((x) => `${x}:${tag(c.nation[x]!)}`).join(','), fleet: g, nation: tag(n), ships, sunk, hpUnits: Math.round(hp * 1000) / 1000, untouched: ships >= (firstShips.get(g) ?? 0) });
    }
    for (const e of now.values()) if (!firstShips.has(e.f)) firstShips.set(e.f, [...now.values()].filter((x) => x.f === e.f).reduce((a, x) => a + x.s, 0));
    for (const f of new Set([...now.values()].map((e) => e.f))) nationOf.set(f, c.nation[f]!);
    w.out.events.length = 0;
    w.out.fires.length = 0;
    prev = now;
  });
}
type Sum = { strikes: number; fleetsStruck: number; sunk: number; perStrike: number; hpUnits: number; strikesThatSank: number; wholeFleetStrikes: number; wholeFleetShips: number; overHalfUntouched: number };
const sum = (kind: Kind): Sum => {
  const s = strikes.filter((x) => x.kind === kind);
  const sunk = s.reduce((a, x) => a + x.sunk, 0);
  // PLAN 7.60: strikes that sank the whole fleet they struck (and its ships); strikes that sank more
  // than half of a fleet that had lost none before.
  const whole = s.filter((x) => x.sunk > 0 && x.sunk === x.ships);
  const overHalf = s.filter((x) => x.untouched && 2 * x.sunk > x.ships).length;
  return { strikes: s.length, fleetsStruck: new Set(s.map((x) => x.fleet)).size, sunk, perStrike: s.length ? Math.round((sunk / s.length) * 1000) / 1000 : 0, hpUnits: Math.round(s.reduce((a, x) => a + x.hpUnits, 0) * 1000) / 1000, strikesThatSank: s.filter((x) => x.sunk > 0).length, wholeFleetStrikes: whole.length, wholeFleetShips: whole.reduce((a, x) => a + x.sunk, 0), overHalfUntouched: overHalf };
};
const war = A === '-' ? battles : battles.filter((b) => [b.a, b.b].includes(A) && [b.a, b.b].includes(D));
const summary = { seed, A, D, days, carrier: sum('carrier'), land: sum('land'), seaBattles: war.length, shipsLostInThem: war.reduce((a, b) => a + b.lostA + b.lostB, 0) };
console.log(JSON.stringify(summary));
writeFileSync(out, JSON.stringify({ summary, battles: war, strikes }, null, 1));
console.log(`wrote ${out}`);
