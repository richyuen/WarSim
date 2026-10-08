import { writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DEPLOY_RANGE_CELLS, SECTOR_CELLS, STAGGER } from '../../src/sim/ai/operational';
import { SIZE_1938, TEMPLATES_LAND } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { frontierOf } from '../../src/sim/systems/territory';
import { passageOf } from '../../src/sim/systems/movement';
import { neighbours4 } from '../../src/sim/nav/grid';
import { wideNode } from '../../src/sim/nav/provinceGraph';
import { navOf, type World } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';
import { addDivision, eventKinds, nationId, runEvents } from '../helpers/sim1938';
import { EventKind } from '../../src/shared/events';
import { cellOf } from '../../src/sim/data/terrain';
import { destroyFormation } from '../../src/sim/systems/elements';

// PLAN 1.25 operational AI v1. AT: in a scripted 2-nation war the larger nation advances;
// formations are spread along the front (coverage metric).

const W = SIZE_1938.w;
const H = SIZE_1938.h;
const [GER, POL] = ['GER', 'POL'].map(nationId) as [number, number];

/** GER vs POL alone: no alliances or guarantees, every other AI off, no new declarations. */
function duel(): Sim {
  const s = new Sim({ scenario: '1938', seed: 1938, assets: assets1938(W) });
  const w = s.world;
  for (const n of [GER, POL]) {
    w.alliances.leave(n);
    w.alliances.guarantees = w.alliances.guarantees.filter((g) => g.guarantor !== n && g.target !== n);
  }
  w.nations.forEach((n) => {
    if (n !== GER && n !== POL) w.nations.cols.aiOff[n] = 1;
  });
  w.nations.cols.aggression[GER] = 0; // operational AI only: no new wars
  w.nations.cols.aggression[POL] = 0;
  s.command({ kind: 'declareWar', attacker: GER, defender: POL });
  return s;
}

/** Share of `n`'s front sectors with one of its formations within 2 sectors of the centre. */
function coverage(w: World, n: number): number {
  const { w: mw, h, controller } = w.cells;
  const nb: number[] = [];
  const bw = Math.ceil(mw / SECTOR_CELLS);
  const sectors = new Map<number, [number, number, number]>();
  for (const c of frontierOf(w)) {
    if (controller[c] !== n) continue;
    if (!neighbours4(c, mw, h, true, nb).some((k) => controller[k] !== 0 && w.wars.atWar(n, controller[k]!))) continue;
    const x = c % mw;
    const y = (c - x) / mw;
    const key = Math.floor(y / SECTOR_CELLS) * bw + Math.floor(x / SECTOR_CELLS);
    const s = sectors.get(key) ?? [0, 0, 0];
    sectors.set(key, [s[0] + x + 0.5, s[1] + y + 0.5, s[2] + 1]);
  }
  const f = w.formations.cols;
  const own = w.formations.ids().filter((id) => f.nation[id] === n);
  let covered = 0;
  for (const [sx, sy, k] of sectors.values()) {
    const cx = sx / k;
    const cy = sy / k;
    if (own.some((id) => (f.x[id]! - cx) * (f.x[id]! - cx) + (f.y[id]! - cy) * (f.y[id]! - cy) <= (2 * SECTOR_CELLS) * (2 * SECTOR_CELLS))) covered++;
  }
  return sectors.size === 0 ? 1 : covered / sectors.size;
}

/** Cells first owned by `victim` and now controlled by `taker`. */
function taken(w: World, owner0: Uint16Array, victim: number, taker: number): number {
  let n = 0;
  for (let c = 0; c < owner0.length; c++) if (owner0[c] === victim && w.cells.controller[c] === taker) n++;
  return n;
}

describe('operational AI (PLAN 1.25)', () => {
  it('the larger nation advances, and both sides spread along the front', () => {
    const s = duel();
    const w = s.world;
    const owner0 = new Uint16Array(w.cells.owner);
    runEvents(s, 1); // the declaration applies at tick 0
    // A sustained war: neither side may sue (an early exhaustion peace would end the test).
    const war = w.wars.between(GER, POL)!.war;
    war.fightToDeath = [true, true];
    runEvents(s, 24 * 10 - 1);
    const cov10 = [coverage(w, GER), coverage(w, POL)];
    runEvents(s, 24 * 20);
    const cov30 = [coverage(w, GER), coverage(w, POL)];
    runEvents(s, 24 * 30);
    const gerGain = taken(w, owner0, POL, GER);
    const polGain = taken(w, owner0, GER, POL);
    const log = process.env['OPAI_LOG'];
    if (log) writeFileSync(log, JSON.stringify({ cov10, cov30, gerGain, polGain, score: war.score }));
    // The larger nation advances (and the smaller one's early raids are pushed back).
    expect(gerGain).toBeGreaterThan(300);
    expect(gerGain).toBeGreaterThan(4 * polGain);
    // Formations are spread along the front: most front sectors have a division within 2 sectors.
    for (const c of [...cov10, ...cov30]) expect(c).toBeGreaterThanOrEqual(0.6);
    expect(H).toBe(SIZE_1938.h);
  }, 180_000);
});

describe('allied fronts (PLAN 1.42b)', () => {
  it('a nation with no front of its own sends its army to the front of the ally it fights beside', () => {
    const ITA = nationId('ITA');
    const s = duel();
    const w = s.world;
    const f = w.formations.cols;
    runEvents(s, 1);
    const war = w.wars.between(GER, POL)!.war;
    war.fightToDeath = [true, true];
    war.sides[0].push(ITA);
    w.wars.changed();
    w.nations.cols.aiOff[ITA] = 0;
    w.nations.cols.aggression[ITA] = 0;
    for (const id of w.formations.ids()) if (f.nation[id] === ITA) destroyFormation(w, id);
    // Three Italian divisions in Brandenburg, some 150 km behind the German–Polish border.
    const [bx, by] = cellOf(13.4, 52.5, W, H);
    const ids = [-1, 0, 1].map((k) => addDivision(w, ITA, Math.floor(bx) + 0.5, Math.floor(by) + k + 0.5));
    const x0 = ids.map((id) => f.x[id]!);
    runEvents(s, 24 * 2);
    // Each has orders to a front cell: one held by Germany or by Poland, never by Italy.
    for (const id of ids) {
      expect(f.moving[id] === 1 || f.x[id] !== x0[ids.indexOf(id)]).toBe(true);
      expect([GER, POL]).toContain(w.cells.controller[f.targetCell[id]!]);
    }
    runEvents(s, 24 * 12);
    // They reached the front (within 3 cells of Polish-held ground) and stayed in supply.
    const nearPoland = (id: number): boolean => {
      for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if (w.cells.owner[(Math.floor(f.y[id]!) + dy) * W + Math.floor(f.x[id]!) + dx] === POL) return true;
      return false;
    };
    const alive = ids.filter((id) => w.formations.has(id));
    expect(alive.length).toBeGreaterThan(0);
    expect(alive.some(nearPoland)).toBe(true);
    for (const id of alive) expect(f.supply[id]).toBeGreaterThan(0);
  });
});

describe('marches are not countermanded (PLAN 1.42f, ADR-53)', () => {
  it('a formation marching into a front sector that still exists keeps its target at the next plan', () => {
    const s = duel();
    const w = s.world;
    const f = w.formations.cols;
    const mw = w.cells.w;
    const bw = Math.ceil(mw / SECTOR_CELLS);
    const sectorOf = (c: number): number => Math.floor(Math.floor(c / mw) / SECTOR_CELLS) * bw + Math.floor((c % mw) / SECTOR_CELLS);
    const dist = (a: number, b: number): number => {
      let dx = Math.abs((a % mw) - (b % mw));
      if (dx > mw / 2) dx = mw - dx;
      return Math.max(dx, Math.abs(Math.floor(a / mw) - Math.floor(b / mw)));
    };
    /** Sector keys of `n`'s front against its enemy, as the planner builds them. */
    const frontSectors = (n: number): Set<number> => {
      const nb: number[] = [];
      const keys = new Set<number>();
      for (const c of frontierOf(w)) {
        if (w.cells.controller[c] !== n) continue;
        if (neighbours4(c, mw, w.cells.h, true, nb).some((k) => w.cells.controller[k] !== 0 && w.wars.atWar(n, w.cells.controller[k]!))) keys.add(sectorOf(c));
      }
      return keys;
    };
    runEvents(s, 1);
    w.wars.between(GER, POL)!.war.fightToDeath = [true, true];
    // Before each German plan: its free formations on the march into a sector that is still a
    // front sector. After the plan: their targets, which must be within one sector of the old ones.
    let watched = new Map<number, number>();
    let marches = 0;
    let countermanded = 0;
    s.step(24 * 14, (ww) => {
      ww.out.events.length = 0;
      ww.out.fires.length = 0;
      for (const [id, target] of watched) {
        if (!ww.formations.has(id) || f.moving[id] !== 1) continue; // destroyed, or arrived and stopped
        marches++;
        if (dist(f.targetCell[id]!, target) > SECTOR_CELLS) countermanded++;
      }
      watched = new Map();
      // The planner runs in tick T when T is a multiple of 6 and (T / 6 + nation) is a multiple of STAGGER.
      if (ww.tick % 6 !== 0 || (ww.tick / 6 + GER) % STAGGER !== 0) return;
      const sectors = frontSectors(GER);
      for (const id of ww.formations.ids()) {
        if (f.nation[id] === GER && f.moving[id] === 1 && f.engaged[id] !== 1 && sectors.has(sectorOf(f.targetCell[id]!))) watched.set(id, f.targetCell[id]!);
      }
    });
    expect(marches).toBeGreaterThan(50);
    expect(countermanded).toBe(0);
  }, 180_000);
});

describe('allot by reach (PLAN 3.5b)', () => {
  it('fronts with no way between them: each formation is sent to one it can reach, and no order is refused', () => {
    const ITA = nationId('ITA');
    const FRA = nationId('FRA');
    const s = duel();
    const w = s.world;
    const f = w.formations.cols;
    runEvents(s, 1);
    // Italy fights Poland beside Germany and France alone: fronts in Europe and in Africa, and
    // an army at home, on its islands and in its colonies, with the sea or a nation at peace
    // between them.
    const war = w.wars.between(GER, POL)!.war;
    war.fightToDeath = [true, true];
    war.sides[0].push(ITA);
    w.wars.start([ITA], [FRA], w.tick).fightToDeath = [true, true];
    w.wars.changed();
    w.nations.cols.aiOff[ITA] = 0;
    w.nations.cols.aggression[ITA] = 0;
    // Where a formation can go: its landmass, and on it the provinces joined by ground that is
    // open to Italy (a nation at peace parts one group from the next).
    const nav = navOf(w);
    const pass = passageOf(w, ITA);
    const reachOf = (c: number): string => `${nav.grid.component[c]}:${pass.group![nav.graph.nodeOf[c]!]}`;
    const italians = w.formations.ids().filter((id) => f.nation[id] === ITA);
    const stood = new Map(italians.map((id) => [id, reachOf(Math.floor(f.y[id]!) * W + Math.floor(f.x[id]!))] as const));
    expect(new Set(stood.values()).size).toBeGreaterThan(2);
    const refused = eventKinds(runEvents(s, 24 * 2), EventKind.MoveRejected).filter(([, nation]) => nation === ITA);
    expect(refused).toEqual([]);
    // Whoever marches, marches to a place in its reach; and from more than one of them
    // somebody does.
    const marching = italians.filter((id) => w.formations.has(id) && f.moving[id] === 1);
    for (const id of marching) expect(reachOf(f.targetCell[id]!), `formation ${id}`).toBe(stood.get(id));
    expect(new Set(marching.map((id) => stood.get(id))).size).toBeGreaterThanOrEqual(2);
    expect(marching.length).toBeGreaterThan(20);
  });
});

describe('spearheads (PLAN 3.5c)', () => {
  it('where a sector attacks with armour, the armour is sent at the enemy and the rest hold the front', () => {
    const LTU = nationId('LIT'); // Lithuania
    const PANZER = TEMPLATES_LAND.findIndex((t) => t.id === 'panzer_div');
    const s = new Sim({ scenario: '1938', seed: 1938, assets: assets1938(W) });
    const w = s.world;
    const f = w.formations.cols;
    for (const n of [GER, LTU]) {
      w.alliances.leave(n);
      w.alliances.guarantees = w.alliances.guarantees.filter((g) => g.guarantor !== n && g.target !== n);
    }
    w.nations.forEach((n) => {
      if (n !== GER) w.nations.cols.aiOff[n] = 1;
    });
    w.nations.cols.aggression[GER] = 0;
    runEvents(s, 1);
    w.wars.start([GER], [LTU], w.tick).fightToDeath = [true, true];
    w.wars.changed();
    // Nobody but twelve German divisions in East Prussia, a day's march and more behind the
    // Lithuanian border: no threat, so every sector of the front attacks. The two armoured
    // ones stand nearest the border (never the reserve).
    for (const id of w.formations.ids()) destroyFormation(w, id);
    const [kx, ky] = cellOf(20.5, 54.7, W, H).map(Math.floor) as [number, number];
    const armour = [0, 1].map((k) => addDivision(w, GER, kx + 1.5, ky + k + 0.5, PANZER));
    const foot = Array.from({ length: 10 }, (_, k) => addDivision(w, GER, kx - (k % 2) + 0.5, ky - 2 + Math.floor(k / 2) + 0.5));
    const held = new Uint16Array(w.cells.controller);
    // To the hour after Germany's next plan.
    do runEvents(s, 1);
    while (w.tick % 6 !== 1 || ((w.tick - 1) / 6 + GER) % STAGGER !== 0);
    const target = (id: number): number => f.targetCell[id]!;
    const dist = (a: number, b: number): number => Math.max(Math.abs((a % W) - (b % W)), Math.abs(Math.floor(a / W) - Math.floor(b / W)));
    // The armour marches on Lithuanian ground.
    for (const id of armour) {
      expect(f.moving[id], `armour ${id}`).toBe(1);
      expect(held[target(id)], `armour ${id}`).toBe(LTU);
    }
    const marching = foot.filter((id) => f.moving[id] === 1);
    const holding = marching.filter((id) => held[target(id)] === GER);
    const attacking = marching.filter((id) => held[target(id)] === LTU);
    expect(holding.length + attacking.length).toBe(marching.length);
    // Infantry of the armour's sectors holds the front behind it: a German cell, and within a
    // sector of the cell an armoured division is sent at.
    expect(holding.length).toBeGreaterThan(0);
    for (const id of holding) expect(Math.min(...armour.map((a) => dist(target(a), target(id)))), `division ${id}`).toBeLessThanOrEqual(SECTOR_CELLS);
    // A sector with no armour attacks with what it has, as before.
    expect(attacking.length).toBeGreaterThan(0);
  });
});

describe('the range is to the sector (PLAN 3.10c1, ADR-187)', () => {
  it('a nation with two fronts far apart: no formation of the one is ordered to the other', () => {
    const SOV = nationId('SOV');
    const JAP = nationId('JAP');
    const s = new Sim({ scenario: '1938', seed: 1938, assets: assets1938(W) });
    const w = s.world;
    const f = w.formations.cols;
    for (const n of [SOV, POL, JAP]) {
      w.alliances.leave(n);
      w.alliances.guarantees = w.alliances.guarantees.filter((g) => g.guarantor !== n && g.target !== n);
    }
    w.nations.forEach((n) => {
      if (n !== SOV) w.nations.cols.aiOff[n] = 1;
    });
    w.nations.cols.aggression[SOV] = 0;
    runEvents(s, 1);
    // A front in Europe and one in East Asia, on one landmass with open ground between them.
    w.wars.start([SOV], [POL], w.tick).fightToDeath = [true, true];
    w.wars.start([SOV], [JAP], w.tick).fightToDeath = [true, true];
    w.wars.changed();
    const dist = (x: number, y: number, c: number): number => {
      let dx = Math.abs(x - ((c % W) + 0.5));
      if (dx > W / 2) dx = W - dx;
      return Math.hypot(dx, y - (Math.floor(c / W) + 0.5));
    };
    // Every order of five days: how far its target is from where the formation stands. The
    // range is to the sector's centre, and the cell ordered to is the sector's front cell or
    // the enemy's next to it: a sector's diagonal and a cell more.
    const slack = SECTOR_CELLS * Math.SQRT2 + 1;
    const last = new Map<number, number>();
    const orders: { id: number; d: number; x: number; front: number }[] = [];
    // How far a place is from the nearest Soviet front cell (asked for the long orders only).
    const nb: number[] = [];
    const toFront = (x: number, y: number): number => {
      let best = Infinity;
      for (const c of frontierOf(w)) {
        if (w.cells.controller[c] !== SOV || !neighbours4(c, W, H, true, nb).some((k) => w.cells.controller[k] === POL || w.cells.controller[k] === JAP)) continue;
        best = Math.min(best, dist(x, y, c));
      }
      return best;
    };
    const stood = new Map<number, [number, number]>();
    s.step(24 * 5, (ww) => {
      ww.out.events.length = 0;
      ww.out.fires.length = 0;
      for (const id of ww.formations.ids()) {
        if (f.nation[id] !== SOV) continue;
        const target = f.moving[id] === 1 && f.retreat[id] === 0 && f.home[id] === 0 ? f.targetCell[id]! : -1;
        if (target >= 0 && target !== last.get(id)) {
          const d = dist(f.x[id]!, f.y[id]!, target);
          // Where it stood the hour before the order (an order moves a formation within its cell).
          const [x, y] = stood.get(id) ?? [f.x[id]!, f.y[id]!];
          orders.push({ id, d, x: target % W, front: d > DEPLOY_RANGE_CELLS + slack ? toFront(x, y) : 0 });
        }
        last.set(id, target);
        stood.set(id, [f.x[id]!, f.y[id]!]);
      }
    });
    expect(orders.length).toBeGreaterThan(20);
    // Both fronts are given orders: the Polish one (west of 50° E) and the Japanese one (east of 100° E).
    const [west] = cellOf(50, 50, W, H);
    const [east] = cellOf(100, 50, W, H);
    expect(orders.filter((o) => o.x < west).length).toBeGreaterThan(0);
    expect(orders.filter((o) => o.x > east).length).toBeGreaterThan(0);
    // An order beyond the range goes only to a formation that stood far from both fronts (PLAN
    // 3.10c1a, ADR-190: restated; before it there was no such order), and to none a second time.
    const far = orders.filter((o) => o.d > DEPLOY_RANGE_CELLS + slack);
    expect(far.filter((o) => o.front <= DEPLOY_RANGE_CELLS - slack).map((o) => `formation ${o.id}: ${o.d.toFixed(0)} cells, ${o.front.toFixed(0)} from a front`)).toEqual([]);
    expect(new Set(far.map((o) => o.id)).size).toBe(far.length);
  }, 180_000);
});

describe('marches from afar (PLAN 3.10c1a, ADR-190)', () => {
  it('an army far from its only front marches to it, and is given no second order on the way', () => {
    const SOV = nationId('SOV');
    const s = new Sim({ scenario: '1938', seed: 1938, assets: assets1938(W) });
    const w = s.world;
    const f = w.formations.cols;
    for (const n of [SOV, POL]) {
      w.alliances.leave(n);
      w.alliances.guarantees = w.alliances.guarantees.filter((g) => g.guarantor !== n && g.target !== n);
    }
    w.nations.forEach((n) => {
      if (n !== SOV) w.nations.cols.aiOff[n] = 1;
    });
    w.nations.cols.aggression[SOV] = 0;
    runEvents(s, 1);
    w.wars.start([SOV], [POL], w.tick).fightToDeath = [true, true];
    w.wars.changed();
    // Nobody but six Soviet divisions at Chita, east of Lake Baikal: the front is in Poland.
    for (const id of w.formations.ids()) destroyFormation(w, id);
    const [mx, my] = cellOf(113.5, 52.0, W, H).map(Math.floor) as [number, number];
    const ids = Array.from({ length: 6 }, (_, k) => addDivision(w, SOV, mx + (k % 3) + 0.5, my + Math.floor(k / 3) + 0.5));
    const nb: number[] = [];
    const isFront = (c: number): boolean => w.cells.controller[c] === SOV && neighbours4(c, W, H, true, nb).some((k) => w.cells.controller[k] === POL);
    const front = [...frontierOf(w)].filter(isFront);
    expect(front.length).toBeGreaterThan(0);
    const toFront = (id: number): number => Math.min(...front.map((c) => Math.hypot(f.x[id]! - ((c % W) + 0.5), f.y[id]! - (Math.floor(c / W) + 0.5))));
    const d0 = ids.map(toFront);
    expect(Math.min(...d0)).toBeGreaterThan(2 * DEPLOY_RANGE_CELLS);
    // Twenty days: the orders each is given (a target it did not have the hour before).
    const last = new Map<number, number>();
    const orders = new Map<number, number[]>(ids.map((id) => [id, []]));
    s.step(24 * 20, (ww) => {
      ww.out.events.length = 0;
      ww.out.fires.length = 0;
      for (const id of ids) {
        const target = f.moving[id] === 1 ? f.targetCell[id]! : -1;
        if (target >= 0 && target !== last.get(id)) orders.get(id)!.push(target);
        last.set(id, target);
      }
    });
    for (const id of ids) {
      // One order, to a cell of the front as it was, and the division is on its way there.
      expect(orders.get(id)!.length, `division ${id}`).toBe(1);
      expect(front, `division ${id}`).toContain(orders.get(id)![0]);
      expect(f.moving[id], `division ${id}`).toBe(1);
      expect(toFront(id), `division ${id}`).toBeLessThan(d0[ids.indexOf(id)]! - 10);
    }
    // Each to a sector of its own.
    const bw = Math.ceil(W / SECTOR_CELLS);
    const sectorOf = (c: number): number => Math.floor(Math.floor(c / W) / SECTOR_CELLS) * bw + Math.floor((c % W) / SECTOR_CELLS);
    expect(new Set(ids.map((id) => sectorOf(orders.get(id)![0]!))).size).toBe(ids.length);
  }, 180_000);
});

describe('to spare (PLAN 3.10c1d, ADR-191)', () => {
  /**
   * Twelve American divisions at the Pacific end of the front against Mexico, `behind` cells
   * north of it, for thirty days. `marching`: the far orders given to a division on the march.
   */
  const thirtyDays = (behind: number): { marching: number } => {
    const [USA, MEX] = ['USA', 'MEX'].map(nationId) as [number, number];
    const s = new Sim({ scenario: '1938', seed: 1938, assets: assets1938(W) });
    const w = s.world;
    const f = w.formations.cols;
    for (const n of [USA, MEX]) {
      w.alliances.leave(n);
      w.alliances.guarantees = w.alliances.guarantees.filter((g) => g.guarantor !== n && g.target !== n);
    }
    w.nations.forEach((n) => {
      if (n !== USA) w.nations.cols.aiOff[n] = 1;
    });
    w.nations.cols.aggression[USA] = 0;
    runEvents(s, 1);
    w.wars.start([USA], [MEX], w.tick).fightToDeath = [true, true];
    w.wars.changed();
    for (const id of w.formations.ids()) destroyFormation(w, id);
    const nb: number[] = [];
    const isFront = (c: number): boolean => w.cells.controller[c] === USA && neighbours4(c, W, H, true, nb).some((k) => w.cells.controller[k] === MEX);
    const front = [...frontierOf(w)].filter(isFront).sort((a, b) => (a % W) - (b % W) || a - b);
    const bw = Math.ceil(W / SECTOR_CELLS);
    const sectorOf = (c: number): number => Math.floor(Math.floor(c / W) / SECTOR_CELLS) * bw + Math.floor((c % W) / SECTOR_CELLS);
    // The front, from the Pacific to the Gulf: more than 30 sectors.
    expect(new Set(front.map(sectorOf)).size).toBeGreaterThan(30);
    // Nobody but twelve American divisions on the twelve front cells nearest the Pacific, or
    // `behind` cells north of them (the nearest American cell on that landmass to the east).
    const land = navOf(w).grid.component;
    const ids = front.slice(0, 12).map((c) => {
      let at = c - behind * W;
      while (w.cells.controller[at] !== USA || land[at] !== land[c]) at++;
      return addDivision(w, USA, (at % W) + 0.5, Math.floor(at / W) + 0.5);
    });
    // Opposite them, six cells into Mexico, as many Mexican divisions (their AI is off): the near
    // end is threatened and holds, and the front stays where it is.
    const foe = front.slice(0, 12).flatMap((c) => {
      const to = c + 6 * W;
      return w.cells.controller[to] === MEX ? [addDivision(w, MEX, (to % W) + 0.5, Math.floor(to / W) + 0.5)] : [];
    });
    expect(foe.length).toBeGreaterThan(6);
    const dist = (x: number, y: number, c: number): number => Math.hypot(x - ((c % W) + 0.5), y - (Math.floor(c / W) + 0.5));
    const fromArmy = (c: number): number => Math.min(...ids.map((id) => dist(f.x[id]!, f.y[id]!, c)));
    // The far end: the front cells that no division is within the range of (a sector's diagonal
    // more: the range is to the sector's centre).
    const slack = SECTOR_CELLS * Math.SQRT2 + 1;
    const farEnd = front.filter((c) => fromArmy(c) > DEPLOY_RANGE_CELLS + slack);
    const nearEnd = front.filter((c) => fromArmy(c) <= DEPLOY_RANGE_CELLS - slack);
    expect(new Set(farEnd.map(sectorOf)).size).toBeGreaterThan(8);
    // Thirty days: the orders to a cell beyond the range or of a sector of the far end (a target
    // a division did not have the hour before), with how far it was and whether the cell was of
    // the front that hour.
    const farSectors = new Set(farEnd.map(sectorOf));
    const last = new Map<number, number>();
    const sent = new Map<number, { target: number; d: number; front: boolean; day: number }[]>();
    let marching = 0;
    s.step(24 * 30, (ww) => {
      ww.out.events.length = 0;
      ww.out.fires.length = 0;
      for (const id of ids) {
        const target = f.moving[id] === 1 ? f.targetCell[id]! : -1;
        const d = target < 0 ? 0 : dist(f.x[id]!, f.y[id]!, target);
        if (target !== last.get(id) && target >= 0 && (d > DEPLOY_RANGE_CELLS + slack || farSectors.has(sectorOf(target)))) {
          sent.set(id, [...(sent.get(id) ?? []), { target, d, front: isFront(target), day: ww.tick / 24 }]);
          if ((last.get(id) ?? -1) >= 0) marching++;
        }
        last.set(id, target);
      }
    });
    // Divisions are on the march to the far end: each given one such order, to a cell of the
    // front and a sector of its own, and is 10 cells nearer it (a cell a day, where the order is
    // of the last ten days).
    const today = w.tick / 24;
    expect(sent.size).toBeGreaterThanOrEqual(2);
    for (const [id, orders] of sent) {
      expect(orders.length, `division ${id}`).toBe(1);
      expect(orders[0]!.front, `division ${id}`).toBe(true);
      expect(f.targetCell[id], `division ${id}`).toBe(orders[0]!.target);
      expect(dist(f.x[id]!, f.y[id]!, orders[0]!.target), `division ${id}`).toBeLessThan(orders[0]!.d - Math.min(10, today - orders[0]!.day));
    }
    expect(new Set([...sent.values()].map((o) => sectorOf(o[0]!.target))).size).toBe(sent.size);
    // The near end is not left: more than half of the army was not sent, and stands within the
    // range of the near end.
    const stayed = ids.filter((id) => !sent.has(id));
    expect(stayed.length).toBeGreaterThan(ids.length / 2);
    for (const id of stayed) expect(Math.min(...nearEnd.map((c) => dist(f.x[id]!, f.y[id]!, c))), `division ${id}`).toBeLessThanOrEqual(DEPLOY_RANGE_CELLS);
    return { marching };
  };

  it('an army at one end of a long front sends what it can spare to the far end, and the near end is not left', () => {
    thirtyDays(0);
  }, 180_000);

  // PLAN 3.10c1d2: on a front that fights nearly every formation is on the march to its sector's
  // cell. Here all twelve are, for the first weeks, and the far end is sent to all the same.
  it('an army that is all on the march to the near end sends what it can spare as well', () => {
    expect(thirtyDays(40).marching).toBeGreaterThan(0);
  }, 180_000);
});

describe('a pocket of open ground (PLAN 3.10c2b, ADR-192)', () => {
  it('divisions walled off from the nearest front by a third nation are ordered to the front they reach, and no order is refused', () => {
    const [USA, MEX, CAN] = ['USA', 'MEX', 'CAN'].map(nationId) as [number, number, number];
    const s = new Sim({ scenario: '1938', seed: 1938, assets: assets1938(W) });
    const w = s.world;
    const f = w.formations.cols;
    for (const n of [USA, MEX]) {
      w.alliances.leave(n);
      w.alliances.guarantees = w.alliances.guarantees.filter((g) => g.guarantor !== n && g.target !== n);
    }
    w.nations.forEach((n) => {
      if (n !== USA) w.nations.cols.aiOff[n] = 1;
    });
    w.nations.cols.aggression[USA] = 0;
    runEvents(s, 1);
    w.wars.start([USA], [MEX], w.tick).fightToDeath = [true, true];
    w.wars.changed();
    for (const id of w.formations.ids()) destroyFormation(w, id);
    const nav = navOf(w);
    const land = nav.grid.component;
    const nb: number[] = [];
    const isFront = (c: number): boolean => w.cells.controller[c] === USA && neighbours4(c, W, H, true, nb).some((k) => w.cells.controller[k] === MEX);
    const front = [...frontierOf(w)].filter(isFront).sort((a, b) => (a % W) - (b % W) || a - b);
    // A front cell in the middle of the front, and two boxes whose edges Canada holds (two cells
    // thick; it is at peace with both, so its ground is closed to the Americans): a small one
    // around that cell, and a large one around it that reaches 26 cells to the west.
    const a = front[Math.floor(front.length / 2)]!;
    const ax = a % W;
    const ay = Math.floor(a / W);
    const small = [ax - 6, ay - 5, ax + 6, ay + 6] as const;
    const large = [ax - 26, ay - 14, ax + 8, ay + 8] as const;
    const within = (c: number, [x0, y0, x1, y1]: readonly [number, number, number, number], inset: number): boolean => {
      const x = c % W;
      const y = Math.floor(c / W);
      return x >= x0 + inset && x <= x1 - inset && y >= y0 + inset && y <= y1 - inset;
    };
    for (const box of [small, large]) {
      for (let y = box[1]; y <= box[3]; y++) {
        for (let x = box[0]; x <= box[2]; x++) {
          const c = y * W + x;
          if (land[c] !== 0 && !within(c, box, 2)) w.setController(c, CAN);
        }
      }
    }
    // Where the six divisions stand: between the two, eight cells north of the small box's front.
    const inPocket = (c: number): boolean => within(c, large, 2) && !within(c, small, 0);
    const ids = Array.from({ length: 6 }, (_, k) => addDivision(w, USA, ax - 1 + (k % 3) + 0.5, ay - 9 + Math.floor(k / 3) + 0.5));
    for (const id of ids) {
      const here = Math.floor(f.y[id]!) * W + Math.floor(f.x[id]!);
      expect(w.cells.controller[here], `division ${id}`).toBe(USA);
      expect(inPocket(here), `division ${id}`).toBe(true);
    }
    // There is front in the small box (the nearest), in the large one beside it, and beyond both.
    const nearFront = front.filter((c) => isFront(c) && within(c, small, 2));
    const pocketFront = front.filter((c) => isFront(c) && inPocket(c));
    expect(nearFront.length).toBeGreaterThan(0);
    expect(pocketFront.length).toBeGreaterThan(0);
    expect(front.filter((c) => isFront(c) && !within(c, large, 0)).length).toBeGreaterThan(0);
    const dist = (id: number, c: number): number => Math.hypot(f.x[id]! - ((c % W) + 0.5), f.y[id]! - (Math.floor(c / W) + 0.5));
    for (const id of ids) expect(Math.min(...nearFront.map((c) => dist(id, c))), `division ${id}`).toBeLessThan(Math.min(...pocketFront.map((c) => dist(id, c))));
    // The provinces do not tell the three apart: by them the divisions reach the small box.
    const pass = passageOf(w, USA);
    const groupOf = (c: number): number => pass.group![nav.graph.nodeOf[c]!]!;
    const stand = Math.floor(f.y[ids[0]!]!) * W + Math.floor(f.x[ids[0]!]!);
    expect(groupOf(stand)).toBeGreaterThan(0);
    expect(nearFront.some((c) => groupOf(c) === groupOf(stand))).toBe(true);
    // To the hour after the Americans' next plan.
    const events: number[][] = [];
    do events.push(...runEvents(s, 1));
    while (w.tick % 6 !== 1 || ((w.tick - 1) / 6 + USA) % STAGGER !== 0);
    expect(eventKinds(events, EventKind.MoveRejected).filter(([, nation]) => nation === USA)).toEqual([]);
    // Every division marches, to the front in its pocket (the front cell or the Mexican one next
    // to it).
    for (const id of ids) {
      expect(f.moving[id], `division ${id}`).toBe(1);
      expect(inPocket(f.targetCell[id]!), `division ${id} to ${f.targetCell[id]! % W},${Math.floor(f.targetCell[id]! / W)}`).toBe(true);
    }
  });

  it('divisions in wide ground are not ordered to a front in a pocket that a third nation walls off (PLAN 3.10c2b2)', () => {
    const [USA, MEX, CAN] = ['USA', 'MEX', 'CAN'].map(nationId) as [number, number, number];
    const s = new Sim({ scenario: '1938', seed: 1938, assets: assets1938(W) });
    const w = s.world;
    const f = w.formations.cols;
    for (const n of [USA, MEX]) {
      w.alliances.leave(n);
      w.alliances.guarantees = w.alliances.guarantees.filter((g) => g.guarantor !== n && g.target !== n);
    }
    w.nations.forEach((n) => {
      if (n !== USA) w.nations.cols.aiOff[n] = 1;
    });
    w.nations.cols.aggression[USA] = 0;
    runEvents(s, 1);
    w.wars.start([USA], [MEX], w.tick).fightToDeath = [true, true];
    w.wars.changed();
    for (const id of w.formations.ids()) destroyFormation(w, id);
    const nav = navOf(w);
    const land = nav.grid.component;
    const nb: number[] = [];
    const isFront = (c: number): boolean => w.cells.controller[c] === USA && neighbours4(c, W, H, true, nb).some((k) => w.cells.controller[k] === MEX);
    const front = [...frontierOf(w)].filter(isFront).sort((a, b) => (a % W) - (b % W) || a - b);
    // The test above with the outer box left out: the small box around a front cell in the
    // middle of the front, its edges Canada's, and the divisions north of it in the open.
    const a = front[Math.floor(front.length / 2)]!;
    const ax = a % W;
    const ay = Math.floor(a / W);
    const small = [ax - 6, ay - 5, ax + 6, ay + 6] as const;
    const within = (c: number, [x0, y0, x1, y1]: readonly [number, number, number, number], inset: number): boolean => {
      const x = c % W;
      const y = Math.floor(c / W);
      return x >= x0 + inset && x <= x1 - inset && y >= y0 + inset && y <= y1 - inset;
    };
    for (let y = small[1]; y <= small[3]; y++) {
      for (let x = small[0]; x <= small[2]; x++) {
        const c = y * W + x;
        if (land[c] !== 0 && !within(c, small, 2)) w.setController(c, CAN);
      }
    }
    const ids = Array.from({ length: 6 }, (_, k) => addDivision(w, USA, ax - 1 + (k % 3) + 0.5, ay - 9 + Math.floor(k / 3) + 0.5));
    for (const id of ids) {
      const here = Math.floor(f.y[id]!) * W + Math.floor(f.x[id]!);
      expect(w.cells.controller[here], `division ${id}`).toBe(USA);
      expect(within(here, small, 0), `division ${id}`).toBe(false);
    }
    // Mexican divisions on the box's front: its sectors are the most threatened, and the
    // allotment's first.
    const foe = neighbours4(a, W, H, true, nb).find((k) => w.cells.controller[k] === MEX)!;
    for (let k = 0; k < 4; k++) addDivision(w, MEX, (foe % W) + 0.5, Math.floor(foe / W) + 0.5);
    // There is front in the box (the nearest) and outside it.
    const nearFront = front.filter((c) => isFront(c) && within(c, small, 2));
    const openFront = front.filter((c) => isFront(c) && !within(c, small, 0));
    expect(nearFront.length).toBeGreaterThan(0);
    expect(openFront.length).toBeGreaterThan(0);
    const dist = (id: number, c: number): number => Math.hypot(f.x[id]! - ((c % W) + 0.5), f.y[id]! - (Math.floor(c / W) + 0.5));
    for (const id of ids) expect(Math.min(...nearFront.map((c) => dist(id, c))), `division ${id}`).toBeLessThan(Math.min(...openFront.map((c) => dist(id, c))));
    // The provinces do not tell the two apart: by them the divisions reach the box.
    const pass = passageOf(w, USA);
    const groupOf = (c: number): number => pass.group![nav.graph.nodeOf[c]!]!;
    const stand = Math.floor(f.y[ids[0]!]!) * W + Math.floor(f.x[ids[0]!]!);
    expect(groupOf(stand)).toBeGreaterThan(0);
    expect(nearFront.some((c) => groupOf(c) === groupOf(stand))).toBe(true);
    // To the hour after the Americans' next plan.
    const events: number[][] = [];
    do events.push(...runEvents(s, 1));
    while (w.tick % 6 !== 1 || ((w.tick - 1) / 6 + USA) % STAGGER !== 0);
    expect(eventKinds(events, EventKind.MoveRejected).filter(([, nation]) => nation === USA)).toEqual([]);
    // Every division marches, to the front outside the box.
    for (const id of ids) {
      expect(f.moving[id], `division ${id}`).toBe(1);
      expect(within(f.targetCell[id]!, small, 0), `division ${id} to ${f.targetCell[id]! % W},${Math.floor(f.targetCell[id]! / W)}`).toBe(false);
    }
  });
});

describe('two wide grounds (PLAN 3.10c2b3a, ADR-193)', () => {
  /**
   * The United States against Mexico, and a wall of Canadian ground two cells thick across the
   * United States twelve cells north of the middle of the front (Canada is at peace with both, so
   * its ground is closed to the Americans), with `gap` cells of it left open. Six American
   * divisions stand three cells north of the wall. Neither side of it is a pocket.
   */
  function walled(gap: number): { s: Sim; w: World; ids: number[]; USA: number; wall: number } {
    const [USA, MEX, CAN] = ['USA', 'MEX', 'CAN'].map(nationId) as [number, number, number];
    const s = new Sim({ scenario: '1938', seed: 1938, assets: assets1938(W) });
    const w = s.world;
    const f = w.formations.cols;
    for (const n of [USA, MEX]) {
      w.alliances.leave(n);
      w.alliances.guarantees = w.alliances.guarantees.filter((g) => g.guarantor !== n && g.target !== n);
    }
    w.nations.forEach((n) => {
      if (n !== USA) w.nations.cols.aiOff[n] = 1;
    });
    w.nations.cols.aggression[USA] = 0;
    runEvents(s, 1);
    w.wars.start([USA], [MEX], w.tick).fightToDeath = [true, true];
    w.wars.changed();
    for (const id of w.formations.ids()) destroyFormation(w, id);
    const nav = navOf(w);
    const nb: number[] = [];
    const isFront = (c: number): boolean => w.cells.controller[c] === USA && neighbours4(c, W, H, true, nb).some((k) => w.cells.controller[k] === MEX);
    const front = [...frontierOf(w)].filter(isFront).sort((a, b) => (a % W) - (b % W) || a - b);
    const a = front[Math.floor(front.length / 2)]!;
    const ax = a % W;
    const ay = Math.floor(a / W);
    const wall = ay - 12;
    // All of the front is south of the wall.
    for (const c of front) expect(Math.floor(c / W)).toBeGreaterThan(wall + 1);
    for (let y = wall; y <= wall + 1; y++) {
      for (let x = 0; x < W; x++) {
        const c = y * W + x;
        if (w.cells.controller[c] === USA && !(x >= ax && x < ax + gap)) w.setController(c, CAN);
      }
    }
    const ids = Array.from({ length: 6 }, (_, k) => addDivision(w, USA, ax - 1 + (k % 3) + 0.5, wall - 4 + Math.floor(k / 3) + 0.5));
    const stand = Math.floor(f.y[ids[0]!]!) * W + Math.floor(f.x[ids[0]!]!);
    for (const id of ids) expect(w.cells.controller[Math.floor(f.y[id]!) * W + Math.floor(f.x[id]!)], `division ${id}`).toBe(USA);
    // The front is within the range of the divisions, and by the provinces they reach it: the
    // wall runs through provinces that have American ground on both sides of it.
    const dist = (id: number, c: number): number => Math.hypot(f.x[id]! - ((c % W) + 0.5), f.y[id]! - (Math.floor(c / W) + 0.5));
    for (const id of ids) expect(dist(id, a), `division ${id}`).toBeLessThan(DEPLOY_RANGE_CELLS / 2);
    const pass = passageOf(w, USA);
    const node = (c: number): number => nav.graph.nodeOf[c]!;
    expect(pass.group![node(stand)]).toBeGreaterThan(0);
    expect(pass.group![node(a)]).toBe(pass.group![node(stand)]);
    // Wide ground on both sides: the provinces of Mexico south of the front, all of them open,
    // and those of the United States north of the wall that the wall does not touch.
    const foe = neighbours4(a, W, H, true, nb).find((k) => w.cells.controller[k] === MEX)!;
    expect(wideNode(nav.graph, pass, node(foe))).toBeTruthy();
    expect(wideNode(nav.graph, pass, node((wall - 30) * W + ax))).toBeTruthy();
    return { s, w, ids, USA, wall };
  }
  /** To the hour after the Americans' next plan: the orders refused in it. */
  function plan(s: Sim, USA: number): number[][] {
    const w = s.world;
    const events: number[][] = [];
    do events.push(...runEvents(s, 1));
    while (w.tick % 6 !== 1 || ((w.tick - 1) / 6 + USA) % STAGGER !== 0);
    return eventKinds(events, EventKind.MoveRejected).filter(([, nation]) => nation === USA);
  }

  it('divisions in wide ground are not ordered to a front in other wide ground that a third nation walls off', () => {
    const { s, w, ids, USA } = walled(0);
    expect(plan(s, USA)).toEqual([]);
    // They reach no front: none marches.
    for (const id of ids) expect(w.formations.cols.moving[id], `division ${id}`).toBe(0);
  });

  it('they are ordered to it when the wall has a gap, though only provinces with closed ground join the two', () => {
    const { s, w, ids, USA, wall } = walled(4);
    expect(plan(s, USA)).toEqual([]);
    const f = w.formations.cols;
    for (const id of ids) {
      expect(f.moving[id], `division ${id}`).toBe(1);
      expect(Math.floor(f.targetCell[id]! / W), `division ${id}`).toBeGreaterThan(wall + 1);
    }
  });
});
