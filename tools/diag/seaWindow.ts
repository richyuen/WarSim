/**
 * PLAN 7.148's read: one checkpoint stepped `days` days, its sea battles and the fleets a carrier's wing struck, for
 * windows stepped both ways (the arms were `seaChannels.ts`'s switches, `NOCV=1` and `CVSEE=1`, removed after the read:
 * on HEAD it runs HEAD's rule whatever is set). Writes:
 * - `battles`: each sea battle as it starts (a new `world.seaBattles` record): hour, its two nations, its fleets;
 * - `cvStruck`: each fleet a carrier's wing struck out of a sea battle (`StrikeHit`, the wing's base < 0): its
 *   nation, the first hour, the ships it had then, the ships it lost in those hours, the strikes, and whether it
 *   is afloat at the window's end (`alive`);
 * - `sums`: battles, ships sunk in them (`SeaBattle` rows), ships lost to carrier and to land-based wings out of a
 *   battle.
 *
 * Usage: npx tsx tools/diag/seaWindow.ts <save.bin> [days = 60] [out]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { EventKind } from '../../src/shared/events';
import { seaSide } from '../../src/shared/history';
import { size1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { loadAssets1938 } from '../headless/assets';
import { elementIndex } from '../../src/sim/systems/elements';
import { Domain, type World } from '../../src/sim/world';

const bin = process.argv[2]!;
const days = Number(process.argv[3] ?? 60);
const arm = process.env.NOCV === '1' ? 'nocv' : process.env.CVSEE === '1' ? 'cvsee' : 'head';
const out = process.argv[4] ?? bin.replace(/\.bin$/, `_${arm}_${days}.json`);
const sim = new Sim({ scenario: '1938', seed: 1, assets: loadAssets1938(size1938(undefined).w) });
sim.load(new Uint8Array(readFileSync(bin)));

/** Each fleet's live ships and their hit points left (strength less wound). */
function fleets(w: World): Map<number, { ships: number; hp: number }> {
  const m = new Map<number, { ships: number; hp: number }>();
  const ec = w.elements.cols;
  const units = w.rules!.units;
  for (const [f, els] of elementIndex(w)) {
    if (!w.formations.has(f) || !w.isFleet(f)) continue;
    let ships = 0;
    let hp = 0;
    for (const e of els) {
      if (ec.strength[e]! <= 0 || units[ec.unit[e]!]!.domain !== Domain.sea) continue;
      ships += ec.strength[e]!;
      hp += ec.strength[e]! - ec.wound[e]!;
    }
    m.set(f, { ships, hp });
  }
  return m;
}

const battles: { h: number; a: number; b: number; fleets: number[] }[] = [];
const cvStruck = new Map<number, { nation: number; first: number; ships: number; lost: number; strikes: number }>();
const sums = { battles: 0, sunk: 0, lostCv: 0, lostLand: 0 };
const known = new Set<object>();
for (const r of sim.world.seaBattles) known.add(r);
let prev = fleets(sim.world);
const start = sim.world.tick;
sim.step(24 * days, (w) => {
  const ev = w.out.events;
  const inBattle = new Set<number>();
  for (const r of w.seaBattles) {
    for (const f of r.fleets) inBattle.add(f);
    if (!known.has(r)) {
      known.add(r);
      battles.push({ h: w.tick - start, a: r.a, b: r.b, fleets: [...r.fleets] });
    }
  }
  const cvHit = new Set<number>();
  const landHit = new Set<number>();
  for (let i = 0; i < ev.length; i += 6) {
    const kind = ev[i + 1];
    if (kind === EventKind.SeaBattle) {
      sums.battles++;
      sums.sunk += seaSide(ev[i + 2]!).ships + seaSide(ev[i + 3]!).ships;
    } else if (kind === EventKind.StrikeHit) {
      const g = ev[i + 2]!;
      if (!prev.has(g) || inBattle.has(g)) continue;
      if ((w.wingBase.get(ev[i + 3]!) ?? 0) < 0) cvHit.add(g);
      else landHit.add(g);
    }
  }
  ev.length = 0;
  w.out.fires.length = 0;
  const now = fleets(w);
  for (const g of cvHit) {
    const before = prev.get(g)!;
    const lost = before.ships - (now.get(g)?.ships ?? 0);
    const s = cvStruck.get(g) ?? { nation: w.formations.has(g) ? w.formations.cols.nation[g]! : 0, first: w.tick - start, ships: before.ships, lost: 0, strikes: 0 };
    s.lost += Math.max(0, lost);
    s.strikes++;
    cvStruck.set(g, s);
    sums.lostCv += Math.max(0, lost);
  }
  for (const g of landHit) if (!cvHit.has(g)) sums.lostLand += Math.max(0, prev.get(g)!.ships - (now.get(g)?.ships ?? 0));
  prev = now;
});
writeFileSync(out, JSON.stringify({ bin, arm, days, sums, battles, cvStruck: [...cvStruck].map(([fleet, s]) => ({ fleet, ...s, alive: sim.world.formations.has(fleet) })) }, null, 1));
console.log(JSON.stringify({ arm, ...sums, cvStruck: cvStruck.size }));
console.log('done:');
