/**
 * PLAN 7.37d: at a strike's day, the weights of its war's two sides (output `industryHeld`, income,
 * men) against the striker's, and why the struck nation passed `threatens`.
 * Usage: npx tsx tools/diag/nukeWeight.ts <seed> <from.bin|new> <tick> <striker> <target>
 */
import { readFileSync } from 'node:fs';
import { size1938, TAGS_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { loadAssets1938 } from '../headless/assets';
import { industryHeld, warheadsOf, THREAT_SHARE, CAPITAL_THREAT_KM, canDeliver } from '../../src/sim/systems/nuclear';
import { seaKm } from '../../src/sim/systems/navalCombat';

const [seedS, from, tickS, sTag, tTag] = process.argv.slice(2);
const SZ = size1938(undefined);
const sim = new Sim({ scenario: '1938', seed: Number(seedS), assets: loadAssets1938(SZ.w) });
if (from !== 'new') sim.load(new Uint8Array(readFileSync(from!)));
const T = Number(tickS);
while (sim.world.tick < T) sim.step(Math.min(24, T - sim.world.tick), (w) => { w.out.events.length = 0; w.out.fires.length = 0; });
const w = sim.world;
const id = (t: string): number => TAGS_1938.indexOf(t) + 1;
const tag = (n: number): string => TAGS_1938[n - 1] ?? `#${n}`;
const s = id(sTag!), t = id(tTag!);
const nc = w.nations.cols;
const held = industryHeld(w);
const men = new Float64Array(w.nations.highWater);
w.formations.forEach((f) => { if (!w.isFleet(f) && !w.isWing(f)) men[w.formations.cols.nation[f]!]! += w.formations.cols.strength[f]!; });
const realm = (k: number): number => (nc.overlord[k]! !== 0 ? nc.overlord[k]! : k);
const war = w.wars.list.find((q) => (q.sides[0].includes(s) && q.sides[1].includes(t)) || (q.sides[1].includes(s) && q.sides[0].includes(t)));
if (!war) throw new Error('no war');
const side = war.sides[0].includes(s) ? 0 : 1;
const sum = (ns: readonly number[], a: ArrayLike<number>): number => ns.reduce((q, m) => q + (a[m] ?? 0), 0);
const own = war.sides[side]!, enemy = war.sides[1 - side]!;
let near = false;
w.formations.forEach((f) => { const c = w.formations.cols; if (near || c.nation[f] !== t || w.isFleet(f) || w.isWing(f) || w.offLand(f)) return; if (seaKm(w, nc.capitalX[s]!, nc.capitalY[s]!, c.x[f]!, c.y[f]!) <= CAPITAL_THREAT_KM) near = true; });
const out = {
  tick: w.tick, day: w.tick / 24, striker: sTag, target: tTag, warDays: Math.round((w.tick - war.startTick) / 24), score: war.score,
  own: own.map(tag), enemy: enemy.map(tag),
  output: { striker: Math.round(held[s]!), ownSide: Math.round(sum(own, held)), enemySide: Math.round(sum(enemy, held)), target: Math.round(held[t]!), world: Math.round(held.reduce((a, b) => a + b, 0)) },
  income: { striker: nc.income[s], strikerRealm: nc.income[realm(s)], target: nc.income[t], targetRealm: nc.income[realm(t)], ownSide: sum(own, nc.income), enemySide: sum(enemy, nc.income) },
  men: { striker: men[s], ownSide: sum(own, men), enemySide: sum(enemy, men), target: men[t] },
  enemyByOutput: enemy.map((m) => [tag(m), Math.round(held[m]!), nc.income[m], warheadsOf(w, m), canDeliver(w, m)]),
  threatens: { targetWarheads: warheadsOf(w, t), realmWarheads: warheadsOf(w, realm(t)), overlord: tag(nc.overlord[t]!), incomeRatio: +(nc.income[realm(t)]! / nc.income[realm(s)]!).toFixed(3), THREAT_SHARE, nearCapital: near },
};
console.log(JSON.stringify(out, null, 1));
