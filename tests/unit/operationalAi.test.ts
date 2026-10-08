import { writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DEPLOY_RANGE_CELLS, SECTOR_CELLS, STAGGER } from '../../src/sim/ai/operational';
import { SIZE_1938, TEMPLATES_LAND } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { frontierOf } from '../../src/sim/systems/territory';
import { passageOf } from '../../src/sim/systems/movement';
import { neighbours4 } from '../../src/sim/nav/grid';
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
