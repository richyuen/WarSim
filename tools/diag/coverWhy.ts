/**
 * PLAN 7.115a: why a larger army covers fewer of its front's sectors. `operationalAi`'s duel
 * (seed 1938, Germany on Poland, every other AI off), each day from `from` to `to`: the test's
 * sectors of the nation's front (front cells it controls next to an enemy's, by SECTOR_CELLS
 * buckets) and the share with one of its land formations within 2 sectors (the test's coverage);
 * its land formations by state (engaged, on the retreat, free and on the march, free and standing),
 * the cells they stand on and the largest stack; and its last plan's free formations allotted
 * (`OP_PROBE.sectors`). On the last day, every sector and formation to `out`. Read only.
 *
 * Usage: npx tsx tools/diag/coverWhy.ts <out.json> <from> <to> [POL|GER]
 */
import { writeFileSync } from 'node:fs';
import { OP_PROBE, SECTOR_CELLS, type SectorsSeen } from '../../src/sim/ai/operational';
import { neighbours4 } from '../../src/sim/nav/grid';
import { NATIONS_1938, SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { frontierOf } from '../../src/sim/systems/territory';
import type { World } from '../../src/sim/world';
import { loadAssets1938 } from '../headless/assets';

const out = process.argv[2]!;
const from = Number(process.argv[3]);
const to = Number(process.argv[4]);
const code = (c: string): number => NATIONS_1938.findIndex((n) => n.tag === c) + 1;
const GER = code('GER');
const POL = code('POL');
const who = process.argv[5] === 'GER' ? GER : POL;
const s = new Sim({ scenario: '1938', seed: 1938, assets: loadAssets1938(SIZE_1938.w) });
const w = s.world;
for (const n of [GER, POL]) {
  w.alliances.leave(n);
  w.alliances.guarantees = w.alliances.guarantees.filter((g) => g.guarantor !== n && g.target !== n);
}
w.nations.forEach((n) => {
  if (n !== GER && n !== POL) w.nations.cols.aiOff[n] = 1;
});
w.nations.cols.aggression[GER] = 0;
w.nations.cols.aggression[POL] = 0;
s.command({ kind: 'declareWar', attacker: GER, defender: POL });
const quiet = (ww: World): void => {
  ww.out.events.length = 0;
  ww.out.fires.length = 0;
};
s.step(1, quiet);
w.wars.between(GER, POL)!.war.fightToDeath = [true, true];
let last: SectorsSeen | undefined;
OP_PROBE.sectors = (p) => {
  if (p.nation === who) last = p;
};
s.step(24 * from - 1, quiet);

const R = 2 * SECTOR_CELLS;
function measure(detail: boolean): Record<string, unknown> {
  const { w: mw, h, controller } = w.cells;
  const nb: number[] = [];
  const bw = Math.ceil(mw / SECTOR_CELLS);
  const sectors = new Map<number, [number, number, number]>();
  for (const c of frontierOf(w)) {
    if (controller[c] !== who) continue;
    if (!neighbours4(c, mw, h, true, nb).some((k) => controller[k] !== 0 && w.wars.atWar(who, controller[k]!))) continue;
    const x = c % mw;
    const y = (c - x) / mw;
    const key = Math.floor(y / SECTOR_CELLS) * bw + Math.floor(x / SECTOR_CELLS);
    const q = sectors.get(key) ?? [0, 0, 0];
    sectors.set(key, [q[0] + x + 0.5, q[1] + y + 0.5, q[2] + 1]);
  }
  const f = w.formations.cols;
  const land = w.formations.ids().filter((id) => f.nation[id] === who && !w.isWing(id) && !w.isFleet(id));
  const testSectors = [...sectors.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([key, [sx, sy, k]]) => {
      const cx = sx / k;
      const cy = sy / k;
      const d = land.map((id) => Math.hypot(f.x[id]! - cx, f.y[id]! - cy));
      return { key, cx: +cx.toFixed(1), cy: +cy.toFixed(1), cells: k, nearest: +Math.min(...d).toFixed(1), within: d.filter((x) => x <= R).length };
    });
  const byCell = new Map<number, number[]>();
  for (const id of land) {
    const c = Math.floor(f.y[id]!) * mw + Math.floor(f.x[id]!);
    byCell.set(c, [...(byCell.get(c) ?? []), id]);
  }
  const state = { engaged: 0, retreat: 0, marching: 0, standing: 0 };
  for (const id of land) state[f.engaged[id] === 1 ? 'engaged' : f.retreat[id]! > 0 ? 'retreat' : f.moving[id] === 1 ? 'marching' : 'standing']++;
  const covered = testSectors.filter((t) => t.within > 0).length;
  const r: Record<string, unknown> = {
    day: Math.floor(w.tick / 24),
    coverage: +(covered / testSectors.length).toFixed(3),
    covered,
    sectors: testSectors.length,
    land: land.length,
    ...state,
    cells: byCell.size,
    stack: Math.max(...[...byCell.values()].map((v) => v.length)),
    allotted: last ? last.sectors.reduce((t, q) => t + q.n, 0) : 0,
    allottedSectors: last ? last.sectors.filter((q) => q.n > 0).length : 0,
    planSectors: last?.sectors.length ?? 0,
  };
  if (detail) {
    r['testSectors'] = testSectors;
    r['formations'] = land.map((id) => {
      const c = Math.floor(f.y[id]!) * mw + Math.floor(f.x[id]!);
      const t = f.targetCell[id]!;
      return {
        id,
        x: +f.x[id]!.toFixed(1),
        y: +f.y[id]!.toFixed(1),
        men: Math.round(f.strength[id]!),
        engaged: f.engaged[id],
        retreat: f.retreat[id],
        moving: f.moving[id],
        to: f.moving[id] === 1 ? [t % mw, Math.floor(t / mw)] : null,
        onCell: byCell.get(c)!.length,
      };
    });
    r['plan'] = last && { tick: last.tick, classes: last.classes, sectors: last.sectors.map((q) => ({ ...q, cx: +q.cx.toFixed(1), cy: +q.cy.toFixed(1), threat: Math.round(q.threat), strength: Math.round(q.strength) })) };
  }
  return r;
}
const series: Record<string, unknown>[] = [];
for (let d = from; d <= to; d++) {
  const r = measure(d === to);
  series.push(r);
  const { testSectors: _t, formations: _f, plan: _p, ...line } = r;
  console.log(JSON.stringify(line));
  if (d < to) s.step(24, quiet);
}
writeFileSync(out, JSON.stringify(series, null, 1));
