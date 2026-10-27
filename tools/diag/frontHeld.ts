/**
 * PLAN 7.138: fronts held and not fought. For each war with a land front of at least MIN_FRONT
 * cells (the cells of either side next to a cell of the other's), hour 12 of each day: the land
 * formations of its sides by their distance to that front (cells, 4-neighbour steps), the engaged
 * among them, those within NEAR of the front with an enemy formation of the war within PAIR cells,
 * and the moving among the near ones; per plan of a member (`OP_PROBE.sectors`), the sectors with
 * a threat, those manned, and those that attack. Summed per case, a day and a war.
 *
 * Usage: npx tsx tools/diag/frontHeld.ts <out.json> <days> <seed:state.bin|seed:1938:skipDays> [...]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { OP_PROBE, type SectorsSeen } from '../../src/sim/ai/operational';
import { neighbours4 } from '../../src/sim/nav/grid';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { frontierOf } from '../../src/sim/systems/territory';
import { navOf, type World } from '../../src/sim/world';
import { loadAssets1938 } from '../headless/assets';

const MIN_FRONT = 100;
const FAR = 250;
const NEAR = 5;
const PAIR = 6;
const BANDS = [0, 2, 5, 10, 30, 60, 120, 250] as const;

const out = process.argv[2]!;
const days = Number(process.argv[3]);
const cases = process.argv.slice(4).map((a) => {
  const [seed, bin, skip] = a.split(':');
  return { seed: Number(seed), bin: bin!, skip: Number(skip ?? 0) };
});
let plans: SectorsSeen[] = [];
OP_PROBE.sectors = (p) => plans.push(p);

/** Each war's front cells today (index into wars.list). */
function frontCells(w: World): Map<number, number[]> {
  const { w: W, h, controller } = w.cells;
  const nb: number[] = [];
  const list = w.wars.list;
  const cells = new Map<number, number[]>();
  for (const c of frontierOf(w)) {
    const a = controller[c]!;
    if (a === 0) continue;
    const hit = new Set<number>();
    for (const q of neighbours4(c, W, h, w.settings.loopingMap, nb)) {
      const b = controller[q]!;
      if (b === 0 || b === a || !w.wars.atWar(a, b)) continue;
      for (let i = 0; i < list.length; i++) {
        const s = list[i]!.sides;
        if ((s[0].includes(a) && s[1].includes(b)) || (s[1].includes(a) && s[0].includes(b))) hit.add(i);
      }
    }
    for (const i of hit) {
      let l = cells.get(i);
      if (!l) cells.set(i, (l = []));
      l.push(c);
    }
  }
  return cells;
}

/** Steps from the nearest of `src`, up to FAR (255 beyond). */
function distance(w: World, src: readonly number[], d: Uint8Array): void {
  d.fill(255);
  const { w: W, h } = w.cells;
  const nb: number[] = [];
  let q = src.slice();
  for (const c of q) d[c] = 0;
  for (let k = 1; k <= FAR && q.length > 0; k++) {
    const next: number[] = [];
    for (const c of q) for (const n of neighbours4(c, W, h, w.settings.loopingMap, nb)) if (d[n] === 255) {
      d[n] = k;
      next.push(n);
    }
    q = next;
  }
}

const result: unknown[] = [];
for (const { seed, bin, skip } of cases) {
  const s = new Sim({ scenario: '1938', seed, assets: loadAssets1938(SIZE_1938.w) });
  if (bin !== '1938') s.load(new Uint8Array(readFileSync(bin)));
  const w = s.world;
  const quiet = (ww: World): void => {
    ww.out.events.length = 0;
    ww.out.fires.length = 0;
  };
  for (let d = 0; d < skip; d++) s.step(24, quiet);
  const dist = new Uint8Array(w.cells.w * w.cells.h);
  const t = { farFronted: 0, farFrontedSameLand: 0, farFrontedSameLandStill: 0, farUnfronted: 0, farUnfrontedSameLand: 0, farOtherWar: 0, warDays: 0, front: 0, side: 0, bands: BANDS.map(() => 0), beyond: 0, engaged: 0, engagedNear: 0, near: 0, nearPaired: 0, nearMoving: 0, weakNear: 0, strongNear: 0, sectors: 0, threatened: 0, manned: 0, attack: 0, threatenedAttack: 0, plansOf: 0, ratioSum: 0, ratioN: 0, ratioOver1: 0 };
  for (let day = 0; day < days; day++) {
    plans = [];
    s.step(12, quiet);
    const c = w.formations.cols;
    const fronts = frontCells(w);
    const members = new Set<number>();
    for (const [i, cells] of fronts) {
      if (cells.length < MIN_FRONT) continue;
      const war = w.wars.list[i]!;
      t.warDays++;
      t.front += cells.length;
      distance(w, cells, dist);
      const sideOf = (n: number): number => (war.sides[0].includes(n) ? 0 : war.sides[1].includes(n) ? 1 : -1);
      for (const side of war.sides) for (const n of side) members.add(n);
      const ids: number[] = [];
      w.formations.forEach((id) => {
        if (w.isFleet(id) || w.isWing(id) || w.embarked.has(id) || w.offLand(id)) return;
        if (sideOf(c.nation[id]!) < 0) return;
        ids.push(id);
      });
      const land = navOf(w).grid.component;
      const fronted = new Set<number>();
      const lands = [new Set<number>(), new Set<number>()];
      for (const fc of cells) {
        const o = w.cells.controller[fc]!;
        fronted.add(o);
        const sd = sideOf(o);
        if (sd >= 0) lands[sd]!.add(land[fc]!);
      }
      const men = [0, 0];
      for (const id of ids) men[sideOf(c.nation[id]!)]! += c.strength[id]!;
      const weak = men[0]! <= men[1]! ? 0 : 1;
      for (const id of ids) {
        t.side++;
        const cell = Math.floor(c.y[id]!) * w.cells.w + Math.floor(c.x[id]!);
        const d = dist[cell]!;
        const b = BANDS.findIndex((x) => d <= x);
        if (b < 0) t.beyond++;
        else t.bands[b]!++;
        if (c.engaged[id] === 1) t.engaged++;
        if (d > 60) {
          const sd = sideOf(c.nation[id]!);
          const same = lands[sd]!.has(land[cell]!);
          if (fronted.has(c.nation[id]!)) {
            t.farFronted++;
            if (same) {
              t.farFrontedSameLand++;
              if (c.moving[id] !== 1) t.farFrontedSameLandStill++;
            }
          } else {
            t.farUnfronted++;
            if (same) t.farUnfrontedSameLand++;
          }
          if (c.engaged[id] === 1) t.farOtherWar++;
        }
        if (d > NEAR) continue;
        t.near++;
        if (sideOf(c.nation[id]!) === weak) t.weakNear++;
        else t.strongNear++;
        if (c.engaged[id] === 1) t.engagedNear++;
        if (c.moving[id] === 1) t.nearMoving++;
        const mine = sideOf(c.nation[id]!);
        if (ids.some((o) => sideOf(c.nation[o]!) === 1 - mine && Math.hypot(c.x[o]! - c.x[id]!, c.y[o]! - c.y[id]!) <= PAIR)) t.nearPaired++;

      }
    }
    for (const p of plans) {
      if (!members.has(p.nation)) continue;
      t.plansOf++;
      for (const x of p.sectors) {
        t.sectors++;
        if (x.attack) t.attack++;
        if (x.threat <= 0) continue;
        t.threatened++;
        if (x.n > 0) {
          t.manned++;
          t.ratioSum += x.strength / x.threat;
          t.ratioN++;
          if (x.strength >= x.threat) t.ratioOver1++;
        }
        if (x.attack) t.threatenedAttack++;
      }
    }
    s.step(12, quiet);
  }
  const r = (x: number): number => Math.round(x * 1000) / 1000;
  const wd = Math.max(1, t.warDays);
  const row = {
    seed,
    bin,
    day: Math.floor(w.tick / 24),
    warsADay: r(t.warDays / days),
    frontAWar: r(t.front / wd),
    formationsAWar: r(t.side / wd),
    byBand: Object.fromEntries(BANDS.map((x, k) => [`<=${x}`, r(t.bands[k]! / wd)])),
    beyond: r(t.beyond / wd),
    farFronted: r(t.farFronted / wd),
    farFrontedSameLand: r(t.farFrontedSameLand / wd),
    farFrontedSameLandStill: r(t.farFrontedSameLandStill / wd),
    farUnfronted: r(t.farUnfronted / wd),
    farUnfrontedSameLand: r(t.farUnfrontedSameLand / wd),
    farEngagedElsewhere: r(t.farOtherWar / wd),
    engagedAWar: r(t.engaged / wd),
    nearAWar: r(t.near / wd),
    weakNear: r(t.weakNear / wd),
    strongNear: r(t.strongNear / wd),
    engagedNearAWar: r(t.engagedNear / wd),
    nearPairedAWar: r(t.nearPaired / wd),
    nearMovingAWar: r(t.nearMoving / wd),
    frontCellsPerNear: r(t.front / Math.max(1, t.near)),
    plansOfMembersADay: r(t.plansOf / days),
    sectorsAPlan: r(t.sectors / Math.max(1, t.plansOf)),
    threatenedAPlan: r(t.threatened / Math.max(1, t.plansOf)),
    threatenedMannedShare: r(t.manned / Math.max(1, t.threatened)),
    threatenedAttackShare: r(t.threatenedAttack / Math.max(1, t.threatened)),
    attackAPlan: r(t.attack / Math.max(1, t.plansOf)),
    meanRatioManned: r(t.ratioSum / Math.max(1, t.ratioN)),
    ratioOver1Share: r(t.ratioOver1 / Math.max(1, t.ratioN)),
  };
  result.push(row);
  process.stderr.write(JSON.stringify(row) + '\n');
}
writeFileSync(out, JSON.stringify(result, null, 1));
