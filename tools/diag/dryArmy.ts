/**
 * PLAN 7.146: where the land formations without supply stand, of the members of long-front wars (as
 * `longWarArmy.ts` reads them: a front of at least MIN_FRONT cells, each side weak or strong by its men
 * on land). Hour 12 daily, each land formation (not a fleet, a wing, aboard) at supply 0, per role,
 * a war-day: its men, and in one bucket by the cell it stands on: its own side's cell (`own`: a
 * pocket or a network that does not reach), an enemy's (`enemy`), a neutral's (`neutral`, an ally
 * outside the war counted so), unowned (`none`); and by the 4-neighbour steps to the nearest front
 * cell of its role's war (near ≤ NEAR, mid ≤ 60, far beyond); and moving or standing.
 *
 * Usage: npx tsx tools/diag/dryArmy.ts <out.json> <days> <seed:state.bin> [...]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { neighbours4 } from '../../src/sim/nav/grid';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { frontierOf } from '../../src/sim/systems/territory';
import type { World } from '../../src/sim/world';
import { loadAssets1938 } from '../headless/assets';

const MIN_FRONT = 100;
const NEAR = 10;
const MID = 60;
const out = process.argv[2]!;
const days = Number(process.argv[3]);

function distance(w: World, src: readonly number[], d: Uint8Array, far: number): void {
  d.fill(255);
  const { w: W, h } = w.cells;
  const nb: number[] = [];
  let q = src.slice();
  for (const c of q) d[c] = 0;
  for (let k = 1; k <= far && q.length > 0; k++) {
    const next: number[] = [];
    for (const c of q)
      for (const n of neighbours4(c, W, h, w.settings.loopingMap, nb))
        if (d[n] === 255) {
          d[n] = k;
          next.push(n);
        }
    q = next;
  }
}

const result: unknown[] = [];
const tot: Record<string, Record<string, number>> = { weak: {}, strong: {} };
let totDays = 0;
for (const a of process.argv.slice(4)) {
  const [seedS, bin] = a.split(':');
  const s = new Sim({ scenario: '1938', seed: Number(seedS), assets: loadAssets1938(SIZE_1938.w) });
  s.load(new Uint8Array(readFileSync(bin!)));
  const w = s.world;
  const quiet = (ww: World): void => {
    ww.out.events.length = 0;
    ww.out.fires.length = 0;
  };
  const sum: Record<string, Record<string, number>> = { weak: {}, strong: {} };
  const add = (r: string, k: string, v: number): void => {
    sum[r]![k] = (sum[r]![k] ?? 0) + v;
  };
  const dist = new Uint8Array(w.cells.w * w.cells.h);
  for (let day = 0; day < days; day++) {
    s.step(12, quiet);
    const { w: W, h, controller } = w.cells;
    const nb: number[] = [];
    const list = w.wars.list;
    const cells = new Map<number, number[]>();
    for (const c of frontierOf(w)) {
      const x = controller[c]!;
      if (x === 0) continue;
      const hit = new Set<number>();
      for (const q of neighbours4(c, W, h, w.settings.loopingMap, nb)) {
        const y = controller[q]!;
        if (y === 0 || y === x || !w.wars.atWar(x, y)) continue;
        for (let i = 0; i < list.length; i++) {
          const sd = list[i]!.sides;
          if ((sd[0].includes(x) && sd[1].includes(y)) || (sd[1].includes(x) && sd[0].includes(y))) hit.add(i);
        }
      }
      for (const i of hit) (cells.get(i) ?? cells.set(i, []).get(i)!).push(c);
    }
    const c = w.formations.cols;
    const men = new Map<number, number>();
    w.formations.forEach((id) => {
      if (w.isFleet(id) || w.isWing(id) || w.embarked.has(id) || w.offLand(id)) return;
      men.set(c.nation[id]!, (men.get(c.nation[id]!) ?? 0) + c.strength[id]!);
    });
    // Each nation's role and war (its longest front's).
    const role = new Map<number, { r: string; war: number; side: number }>();
    const best = new Map<number, number>();
    for (const [i, cs] of cells) {
      if (cs.length < MIN_FRONT) continue;
      const sd = list[i]!.sides;
      const m = sd.map((x) => x.reduce((t, n) => t + (men.get(n) ?? 0), 0));
      const weak = m[0]! <= m[1]! ? 0 : 1;
      for (let k = 0; k < 2; k++)
        for (const n of sd[k]!) {
          if ((best.get(n) ?? -1) >= cs.length) continue;
          best.set(n, cs.length);
          role.set(n, { r: k === weak ? 'weak' : 'strong', war: i, side: k });
        }
    }
    const byWar = new Map<number, number[]>();
    w.formations.forEach((id) => {
      if (w.isFleet(id) || w.isWing(id) || w.embarked.has(id) || w.offLand(id)) return;
      const ro = role.get(c.nation[id]!);
      if (!ro) return;
      add(ro.r, 'formations', 1);
      if (c.supply[id]! > 0) return;
      (byWar.get(ro.war) ?? byWar.set(ro.war, []).get(ro.war)!).push(id);
    });
    for (const [i, ids] of byWar) {
      distance(w, cells.get(i)!, dist, MID);
      const sd = list[i]!.sides;
      for (const id of ids) {
        const ro = role.get(c.nation[id]!)!;
        const cell = Math.floor(c.y[id]!) * W + Math.floor(c.x[id]!);
        const o = controller[cell] ?? 0;
        const where = o === 0 ? 'none' : sd[ro.side]!.includes(o) ? 'own' : sd[1 - ro.side]!.includes(o) ? 'enemy' : 'neutral';
        const d = dist[cell]!;
        const band = d <= NEAR ? 'near' : d <= MID ? 'mid' : 'far';
        add(ro.r, 'dry', 1);
        add(ro.r, 'dryMen', c.strength[id]!);
        add(ro.r, `at:${where}`, 1);
        add(ro.r, `band:${band}`, 1);
        add(ro.r, `${band}:${where}`, 1);
        add(ro.r, c.engaged[id] === 1 ? 'engaged' : c.moving[id] === 1 ? 'moving' : 'still', 1);
      }
    }
    s.step(12, quiet);
  }
  const per = (o: Record<string, number>): Record<string, number> => Object.fromEntries(Object.entries(o).sort().map(([k, v]) => [k, Math.round((100 * v) / days) / 100]));
  const row = { seed: Number(seedS), bin, days, weak: per(sum.weak!), strong: per(sum.strong!) };
  result.push(row);
  for (const r of ['weak', 'strong']) for (const [k, v] of Object.entries(sum[r]!)) tot[r]![k] = (tot[r]![k] ?? 0) + v;
  totDays += days;
  process.stderr.write(JSON.stringify(row) + '\n');
}
const perT = (o: Record<string, number>): Record<string, number> => Object.fromEntries(Object.entries(o).sort().map(([k, v]) => [k, Math.round((100 * v) / totDays) / 100]));
writeFileSync(out, JSON.stringify({ total: { weak: perT(tot.weak!), strong: perT(tot.strong!) }, rows: result }, null, 1));
console.log(`done: ${JSON.stringify({ weak: perT(tot.weak!), strong: perT(tot.strong!) })}`);
