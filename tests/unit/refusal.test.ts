import { describe, expect, it } from 'vitest';
import { MAX_PAINT_R, Refusal, type Command } from '../../src/shared/commands';
import { EventKind } from '../../src/shared/events';
import type { FromWorker } from '../../src/shared/protocol';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { navOf } from '../../src/sim/world';
import { SimServer } from '../../src/worker/server';
import { assets1938 } from '../helpers/earth';
import { INF_DIV, nationId, runEvents } from '../helpers/sim1938';

// PLAN 2.17a (the critic's R2-B8): a command that is not carried out says why. It was applied as
// nothing, with a `CommandApplied` event before it; and a command naming a dead nation, or
// carrying a NaN, was carried out (PLAN 2.16Ra, the sixth read).

/** The toy world with its nation 2 killed: nation 1 lives, 2 is dead, 99 was never there. */
function toyWithDead(): Sim {
  const s = new Sim({ scenario: 'toy', seed: 7 });
  s.command({ kind: 'collapseNation', nation: 2 });
  s.step(1);
  expect(s.world.nations.cols.living[2]).toBe(0);
  expect(s.world.nations.cols.living[1]).toBe(1);
  return s;
}

/** Sends `cmd`, steps a tick and returns [applied, refused reasons] of the command events. */
function send(s: Sim, cmd: Command): { applied: number; refused: number[] } {
  s.command(cmd);
  const ev = runEvents(s, 1);
  return { applied: ev.filter((e) => e[1] === EventKind.CommandApplied).length, refused: ev.filter((e) => e[1] === EventKind.CommandRefused).map((e) => e[3]!) };
}

describe('a command that is not carried out says why (PLAN 2.17a)', () => {
  it('a command that is carried out has `CommandApplied` and no refusal', () => {
    const s = toyWithDead();
    expect(send(s, { kind: 'setIncomeBonus', nation: 1, value: 10 })).toEqual({ applied: 1, refused: [] });
    expect(s.world.nations.cols.incomeBonus[1]).toBe(10);
  });

  it('a dead nation is given no formation, no control, no land and no membership', () => {
    const s = toyWithDead();
    const { w, h, owner, controller } = s.world.cells;
    const cell = owner.findIndex((o) => o === 1);
    const [x, y] = [(cell % w) + 0.5, Math.floor(cell / w) + 0.5];
    expect(y).toBeLessThan(h);
    const formations = s.world.formations.count;
    expect(send(s, { kind: 'spawnFormation', nation: 2, x, y, strength: 900 })).toEqual({ applied: 0, refused: [Refusal.DeadNation] });
    expect(s.world.formations.count).toBe(formations);
    expect(send(s, { kind: 'paintControl', nation: 2, x, y, r: 2 })).toEqual({ applied: 0, refused: [Refusal.DeadNation] });
    expect(controller[cell]).toBe(1);
    expect(send(s, { kind: 'editPaint', layer: 'nation', tool: 'brush', x, y, x2: x, y2: y, r: 2, value: 2, mask: null })).toEqual({ applied: 0, refused: [Refusal.DeadNation] });
    expect(owner[cell]).toBe(1);
    expect(send(s, { kind: 'createAlliance', leader: 1, members: [2], nameKey: 'alliance.defensive' })).toEqual({ applied: 0, refused: [Refusal.DeadNation] });
    expect(s.world.alliances.list).toHaveLength(0);
    expect(send(s, { kind: 'declareWar', attacker: 1, defender: 2 }).refused).toEqual([Refusal.DeadNation]);
    expect(send(s, { kind: 'createPuppet', overlord: 1, subject: 2, autonomy: 50 }).refused).toEqual([Refusal.DeadNation]);
    expect(s.world.nations.cols.overlord[2]).toBe(0);
  });

  it('control is painted for no nation 0 and for no nation that is not there', () => {
    const s = toyWithDead();
    const { w, owner, controller } = s.world.cells;
    const cell = owner.findIndex((o) => o === 1);
    const [x, y] = [(cell % w) + 0.5, Math.floor(cell / w) + 0.5];
    expect(send(s, { kind: 'paintControl', nation: 0, x, y, r: 2 }).refused).toEqual([Refusal.NoNation]);
    expect(send(s, { kind: 'paintControl', nation: 99, x, y, r: 2 }).refused).toEqual([Refusal.NoNation]);
    expect(controller[cell]).toBe(1);
  });

  it('a NaN goes into no state', () => {
    const s = toyWithDead();
    const nc = s.world.nations.cols;
    const [ce, sup] = [nc.efficiency[1]!, nc.suppression[1]!];
    expect(send(s, { kind: 'setEfficiency', nation: 1, value: NaN }).refused).toEqual([Refusal.NotANumber]);
    expect(send(s, { kind: 'setSuppression', nation: 1, level: NaN }).refused).toEqual([Refusal.NotANumber]);
    expect(send(s, { kind: 'setUnrest', province: 1, value: NaN }).refused).toEqual([Refusal.NotANumber]);
    expect(send(s, { kind: 'spawnFormation', nation: 1, x: NaN, y: 3, strength: 900 }).refused).toEqual([Refusal.NotANumber]);
    expect(send(s, { kind: 'setGold', nation: 1, value: Infinity }).refused).toEqual([Refusal.NotANumber]);
    expect(nc.efficiency[1]).toBe(ce);
    expect(nc.suppression[1]).toBe(sup);
    expect(Number.isFinite(nc.gold[1]!)).toBe(true);
    const f = s.world.formations;
    f.forEach((id) => expect(Number.isFinite(f.cols.x[id]!)).toBe(true));
  });

  it('war, alliance and puppet: the reason is the one that holds', () => {
    const s = new Sim({ scenario: 'toy', seed: 7 });
    expect(send(s, { kind: 'declareWar', attacker: 1, defender: 1 }).refused).toEqual([Refusal.SameNation]);
    expect(send(s, { kind: 'declareWar', attacker: 1, defender: 99 }).refused).toEqual([Refusal.NoNation]);
    expect(send(s, { kind: 'leaveAlliance', nation: 1 }).refused).toEqual([Refusal.NoAlliance]);
    expect(send(s, { kind: 'joinAlliance', nation: 1, alliance: 77 }).refused).toEqual([Refusal.NoSuch]);
    expect(send(s, { kind: 'forcePeace', war: 77 }).refused).toEqual([Refusal.NoSuch]);
    expect(send(s, { kind: 'createAlliance', leader: 1, members: [2], nameKey: 'alliance.defensive' })).toEqual({ applied: 1, refused: [] });
    const a = s.world.alliances.list[0]!;
    expect(send(s, { kind: 'declareWar', attacker: 1, defender: 2 }).refused).toEqual([Refusal.Allied]);
    expect(send(s, { kind: 'joinAlliance', nation: 2, alliance: a.id }).refused).toEqual([Refusal.InAlliance]);
    expect(send(s, { kind: 'createAlliance', leader: 2, members: [1], nameKey: 'alliance.defensive' }).refused).toEqual([Refusal.InAlliance]);
    expect(s.world.alliances.list).toHaveLength(1);
    expect(send(s, { kind: 'leaveAlliance', nation: 2 })).toEqual({ applied: 1, refused: [] });
    expect(send(s, { kind: 'createPuppet', overlord: 1, subject: 2, autonomy: 50 })).toEqual({ applied: 1, refused: [] });
    expect(send(s, { kind: 'createPuppet', overlord: 2, subject: 1, autonomy: 50 }).refused).toEqual([Refusal.Subject]);
    expect(send(s, { kind: 'declareWar', attacker: 2, defender: 1 }).refused).toEqual([Refusal.Subject]);
  });

  // PLAN 2.17c (ADR-119): the Kill of the only living nation moved nothing and said nothing, and
  // the dead nation kept all its land.
  it('the Kill of the last living nation is refused: it lives and keeps its land', () => {
    const s = toyWithDead();
    const { owner, controller } = s.world.cells;
    const [owners, controllers] = [owner.slice(), controller.slice()];
    expect(send(s, { kind: 'collapseNation', nation: 1 })).toEqual({ applied: 0, refused: [Refusal.LastNation] });
    expect(s.world.nations.cols.living[1]).toBe(1);
    expect(owner).toEqual(owners);
    expect(controller).toEqual(controllers);
    // A dead nation is refused as dead, whoever else lives.
    expect(send(s, { kind: 'collapseNation', nation: 2 }).refused).toEqual([Refusal.DeadNation]);
  });

  // PLAN 2.17e1: the toy world's nations have no name but the one in `world.names` (ADR-109).
  // The empty rename deleted it, and the nation read "Free state 1".
  it('the empty rename of a nation with no other name is refused: it keeps its name', () => {
    const s = new Sim({ scenario: 'toy', seed: 7 });
    expect(s.world.names.get(1)).toBe('West');
    expect(send(s, { kind: 'renameNation', nation: 1, name: '   ' })).toEqual({ applied: 0, refused: [Refusal.NoOtherName] });
    expect(s.world.names.get(1)).toBe('West');
    // A name of its own is taken, and the empty one after it is refused still: "West" is gone.
    expect(send(s, { kind: 'renameNation', nation: 1, name: 'Occident' }).refused).toEqual([]);
    expect(send(s, { kind: 'renameNation', nation: 1, name: '' }).refused).toEqual([Refusal.NoOtherName]);
    expect(s.world.names.get(1)).toBe('Occident');
  });

  it('the random world: refused for a nation of the start, carried out for one a Kill founded', () => {
    const s = new Sim({ scenario: 'random', seed: 7, options: { nations: 12 }, assets: assets1938(SIZE_1938.w) });
    const given = s.world.names.get(1);
    expect(given).toBeTruthy();
    expect(send(s, { kind: 'renameNation', nation: 1, name: '' }).refused).toEqual([Refusal.NoOtherName]);
    expect(s.world.names.get(1)).toBe(given);
    // A nation founded in the game is named after the province of its capital (ADR-100): it has a name to go back to.
    const before = s.world.nations.count;
    expect(send(s, { kind: 'collapseNation', nation: 1 }).refused).toEqual([]);
    const nc = s.world.nations.cols;
    let founded = 0;
    s.world.nations.forEach((n) => {
      if (founded === 0 && n > before && nc.living[n] === 1 && nc.origin[n] !== 0) founded = n;
    });
    expect(founded).toBeGreaterThan(0);
    expect(send(s, { kind: 'renameNation', nation: founded, name: 'Lyonesse' }).refused).toEqual([]);
    expect(send(s, { kind: 'renameNation', nation: founded, name: '' })).toEqual({ applied: 1, refused: [] });
    expect(s.world.names.has(founded)).toBe(false);
  });

  // PLAN 3.12Rq (ADR-228): `standPoint` gave the middle of a cell that is all water, and the
  // formation stood where no route begins.
  it('a formation is spawned on no cell at sea, and off the map', () => {
    const s = new Sim({ scenario: 'toy', seed: 7 });
    const { w, h } = s.world.cells;
    const sea = navOf(s.world).grid.component.findIndex((c) => c === 0);
    expect(sea).toBeGreaterThanOrEqual(0);
    const formations = s.world.formations.count;
    expect(send(s, { kind: 'spawnFormation', nation: 1, x: (sea % w) + 0.5, y: Math.floor(sea / w) + 0.5, strength: 900 })).toEqual({ applied: 0, refused: [Refusal.AtSea] });
    expect(send(s, { kind: 'spawnFormation', nation: 1, x: 3, y: h + 2, strength: 900 }).refused).toEqual([Refusal.AtSea]);
    expect(send(s, { kind: 'spawnFormation', nation: 1, x: -2, y: 3, strength: 900 }).refused).toEqual([Refusal.AtSea]);
    expect(s.world.formations.count).toBe(formations);
    // The nation is asked first: a dead one at sea is refused as dead.
    const dead = toyWithDead();
    expect(send(dead, { kind: 'spawnFormation', nation: 2, x: (sea % w) + 0.5, y: Math.floor(sea / w) + 0.5, strength: 900 }).refused).toEqual([Refusal.DeadNation]);
  });

  it('a formation spawned on the water of a coastal cell stands on its land, as before', () => {
    const s = new Sim({ scenario: '1938', seed: 5, assets: assets1938(SIZE_1938.w) });
    const world = s.world;
    const { w, h, controller } = world.cells;
    const comp = navOf(world).grid.component;
    const GER = nationId('GER');
    // Germany's first cell with water in it by the fine mask, and a place on that water.
    let at: [number, number] | null = null;
    for (let cell = 0; cell < w * h && !at; cell++) {
      if (comp[cell] === 0 || controller[cell] !== GER) continue;
      for (let i = 0; i < 16 && !at; i++) {
        const [x, y] = [(cell % w) + ((i % 4) + 0.5) / 4, Math.floor(cell / w) + (Math.floor(i / 4) + 0.5) / 4];
        if (!world.onLand(x, y) && world.onLand(...world.cellPoint(cell))) at = [x, y];
      }
    }
    expect(at).not.toBeNull();
    const [x, y] = at!;
    const before = new Set(world.formations.ids());
    expect(send(s, { kind: 'spawnFormation', nation: GER, x, y, strength: 0, template: INF_DIV })).toEqual({ applied: 1, refused: [] });
    const made = world.formations.ids().filter((id) => !before.has(id));
    expect(made).toHaveLength(1);
    const fc = world.formations.cols;
    const [fx, fy] = [fc.x[made[0]!]!, fc.y[made[0]!]!];
    expect([Math.floor(fx), Math.floor(fy)]).toEqual([Math.floor(x), Math.floor(y)]);
    expect([fx, fy]).not.toEqual([x, y]);
    expect(world.onLand(fx, fy)).toBe(true);
  });

  it('a refused command is in the command log: a replay refuses it again', () => {
    const s = toyWithDead();
    const before = s.world.commandLog.length;
    send(s, { kind: 'spawnFormation', nation: 2, x: 3, y: 3, strength: 900 });
    expect(s.world.commandLog).toHaveLength(before + 1);
  });

  it('the worker tells the page at once, whatever the page looks at', () => {
    const got: FromWorker[] = [];
    const server = new SimServer((msg) => got.push(msg));
    server.handle({ type: 'init', reqId: 1, init: { scenario: 'toy', seed: 7 } }, 0);
    server.handle({ type: 'cmd', cmd: { kind: 'declareWar', attacker: 1, defender: 1 }, now: true }, 0);
    expect(got.filter((m) => m.type === 'refused')).toEqual([{ type: 'refused', reason: Refusal.SameNation }]);
    server.handle({ type: 'cmd', cmd: { kind: 'setIncomeBonus', nation: 1, value: 10 }, now: true }, 0);
    expect(got.filter((m) => m.type === 'refused')).toHaveLength(1);
  });
});

// PLAN 7.2c (the sixth and seventh reads, ADR-426): commands the page never sends were applied
// with numbers that are finite and out of range. Each is refused and changes nothing.
describe('a command with a number out of its range is refused (PLAN 7.2c)', () => {
  /** A land cell of nation 1 in the toy world, at its centre. */
  function landOf1(s: Sim): [number, number, number] {
    const { w, owner } = s.world.cells;
    const cell = owner.findIndex((o) => o === 1);
    return [(cell % w) + 0.5, Math.floor(cell / w) + 0.5, cell];
  }

  it('a formation of strength -5 is not spawned; one of 0 is', () => {
    const s = new Sim({ scenario: 'toy', seed: 7 });
    const [x, y] = landOf1(s);
    const n = s.world.formations.count;
    expect(send(s, { kind: 'spawnFormation', nation: 1, x, y, strength: -5 }).refused).toEqual([Refusal.OutOfRange]);
    expect(s.world.formations.count).toBe(n);
    expect(send(s, { kind: 'spawnFormation', nation: 1, x, y, strength: 0 }).refused).toEqual([]);
  });

  it('a march, a strike and a Major Battle to 1e9 are refused', () => {
    const s = new Sim({ scenario: 'toy', seed: 7 });
    let id = 0;
    s.world.formations.forEach((f) => {
      if (id === 0 && s.world.formations.cols.nation[f] === 1) id = f;
    });
    expect(id).toBeGreaterThan(0);
    expect(send(s, { kind: 'moveFormation', id, x: 1e9, y: 3 }).refused).toEqual([Refusal.OutOfRange]);
    expect(send(s, { kind: 'moveFormation', id, x: 3, y: -1e9 }).refused).toEqual([Refusal.OutOfRange]);
    expect(send(s, { kind: 'godNuke', x: 1e9, y: 3, thermonuclear: false }).refused).toEqual([Refusal.OutOfRange]);
    const battles = s.world.battles.history.length;
    expect(send(s, { kind: 'forceBreakthrough', nation: 1, x: 3, y: 3, toX: 1e9, toY: 3 }).refused).toEqual([Refusal.OutOfRange]);
    expect(s.world.battles.history).toHaveLength(battles);
    const fc = s.world.formations.cols;
    expect(fc.x[id]!).toBeLessThan(s.world.cells.w);
  });

  it('an alliance with a member twice, or its leader among its members, is not made', () => {
    const s = new Sim({ scenario: 'toy', seed: 7 });
    expect(send(s, { kind: 'createAlliance', leader: 1, members: [2, 2], nameKey: 'alliance.defensive' }).refused).toEqual([Refusal.OutOfRange]);
    expect(send(s, { kind: 'createAlliance', leader: 1, members: [1, 2], nameKey: 'alliance.defensive' }).refused).toEqual([Refusal.OutOfRange]);
    expect(s.world.alliances.list).toHaveLength(0);
    expect(send(s, { kind: 'createAlliance', leader: 1, members: [2], nameKey: 'alliance.defensive' }).refused).toEqual([]);
  });

  it('"to death" of side 5 writes no slot of the war', () => {
    const s = new Sim({ scenario: 'toy', seed: 7 });
    expect(send(s, { kind: 'declareWar', attacker: 1, defender: 2 }).refused).toEqual([]);
    const war = s.world.wars.list[0]!;
    expect(send(s, { kind: 'setWarFightToDeath', war: war.id, side: 5, value: true } as unknown as Command).refused).toEqual([Refusal.OutOfRange]);
    expect(war.fightToDeath).toEqual([false, false]);
    expect(send(s, { kind: 'setWarFightToDeath', war: war.id, side: 1, value: true }).refused).toEqual([]);
    expect(war.fightToDeath).toEqual([false, true]);
  });

  it('province 1.5, nation 1.5 and a nation of -1 are no province and no nation', () => {
    const s = new Sim({ scenario: 'toy', seed: 7 });
    expect(send(s, { kind: 'setUnrest', province: 1.5, value: 50 }).refused).toEqual([Refusal.OutOfRange]);
    expect(send(s, { kind: 'spawnRevolt', province: 1.5 }).refused).toEqual([Refusal.OutOfRange]);
    expect(send(s, { kind: 'setCore', province: 1.5, nation: 1, on: true }).refused).toEqual([Refusal.OutOfRange]);
    const bonus = s.world.nations.cols.incomeBonus[1];
    expect(send(s, { kind: 'setIncomeBonus', nation: 1.5, value: 10 }).refused).toEqual([Refusal.OutOfRange]);
    expect(send(s, { kind: 'setGold', nation: -1, value: 10 }).refused).toEqual([Refusal.OutOfRange]);
    expect(s.world.nations.cols.incomeBonus[1]).toBe(bonus);
  });

  it('a paint line to 1e9 is refused at once; a radius past the editor\'s too', () => {
    const s = new Sim({ scenario: 'toy', seed: 7 });
    const [x, y, cell] = landOf1(s);
    const owners = s.world.cells.owner.slice();
    const t0 = performance.now();
    expect(send(s, { kind: 'editPaint', layer: 'nation', tool: 'line', x, y, x2: 1e9, y2: 1e9, r: 2, value: 2, mask: null }).refused).toEqual([Refusal.OutOfRange]);
    expect(performance.now() - t0).toBeLessThan(1000);
    expect(send(s, { kind: 'editPaint', layer: 'nation', tool: 'brush', x, y, x2: x, y2: y, r: MAX_PAINT_R + 1, value: 2, mask: null }).refused).toEqual([Refusal.OutOfRange]);
    expect(send(s, { kind: 'editPaint', layer: 'nation', tool: 'brush', x, y, x2: x, y2: y, r: 2, value: 1.5, mask: null }).refused).toEqual([Refusal.OutOfRange]);
    expect(send(s, { kind: 'paintControl', nation: 2, x, y, r: 1e6 }).refused).toEqual([Refusal.OutOfRange]);
    expect(s.world.cells.owner).toEqual(owners);
    expect(s.world.cells.controller[cell]).toBe(1);
  });

  it('a drag off the map\'s edge and across the seam, as the page sends it, still paints', () => {
    const s = new Sim({ scenario: 'toy', seed: 7 });
    const { w, owner } = s.world.cells;
    // Raw world cells of a stroke that runs from above the top row and back over the seam.
    expect(send(s, { kind: 'editPaint', layer: 'nation', tool: 'line', x: 10, y: -3, x2: -20, y2: 4, r: 3, value: 1, mask: null }).refused).toEqual([]);
    expect(send(s, { kind: 'editPaint', layer: 'nation', tool: 'brush', x: w + 30, y: 2, x2: w + 30, y2: 2, r: MAX_PAINT_R, value: 2, mask: null }).refused).toEqual([]);
    expect(owner.some((o) => o === 2)).toBe(true);
  });
});

describe('Recolor and Donate of God Mode (PLAN 7.4f16)', () => {
  it('a nation takes the colour given; a dead one is refused', () => {
    const s = new Sim({ scenario: 'toy', seed: 7 });
    expect(send(s, { kind: 'recolorNation', nation: 1, color: 0x12ab34 })).toEqual({ applied: 1, refused: [] });
    expect(s.world.nations.cols.color[1]).toBe(0x12ab34);
    const d = toyWithDead();
    expect(send(d, { kind: 'recolorNation', nation: 2, color: 0x123456 }).refused).toEqual([Refusal.DeadNation]);
  });

  it('gold goes from one nation to the other, no more than the giver has; to itself is refused', () => {
    // Beside a twin that gives nothing: the tick's own income and upkeep are the same in both.
    const twin = (gold1: number, amount?: number): [number, number] => {
      const w = new Sim({ scenario: 'toy', seed: 7 });
      const g = w.world.nations.cols.gold;
      g[1] = gold1;
      g[2] = 100;
      if (amount !== undefined) w.command({ kind: 'donateGold', from: 1, to: 2, amount });
      w.step(1);
      return [g[1]!, g[2]!];
    };
    const base = twin(500);
    const gave = twin(500, 200);
    expect(gave[0]).toBeCloseTo(base[0] - 200, 6);
    expect(gave[1]).toBeCloseTo(base[1] + 200, 6);
    // More than it has: what it has.
    const all = twin(50, 1e9);
    const none = twin(50);
    expect(all[1] - none[1]).toBeCloseTo(50, 6);
    expect(send(new Sim({ scenario: 'toy', seed: 7 }), { kind: 'donateGold', from: 1, to: 1, amount: 10 }).refused).toEqual([Refusal.SameNation]);
    // Out of range: a negative gift, a colour that is not one.
    expect(send(new Sim({ scenario: 'toy', seed: 7 }), { kind: 'donateGold', from: 1, to: 2, amount: -5 }).refused).toEqual([Refusal.OutOfRange]);
    expect(send(new Sim({ scenario: 'toy', seed: 7 }), { kind: 'recolorNation', nation: 1, color: 0x1000000 }).refused).toEqual([Refusal.OutOfRange]);
  });
});

describe("God Mode's Breakthrough (PLAN 7.165)", () => {
  it('for a nation at war with no one: refused with its reason, no corridor; at war: done', () => {
    const s = new Sim({ scenario: 'toy', seed: 7 });
    expect(s.world.wars.nations().has(1)).toBe(false);
    const corridors = s.world.battles.corridors.length;
    expect(send(s, { kind: 'forceBreakthrough', nation: 1, x: 3, y: 3, toX: 9, toY: 3 }).refused).toEqual([Refusal.AtPeace]);
    expect(s.world.battles.corridors).toHaveLength(corridors);
    s.world.wars.set(1, 2, true);
    expect(send(s, { kind: 'forceBreakthrough', nation: 1, x: 3, y: 3, toX: 9, toY: 3 }).refused).toEqual([]);
    expect(s.world.battles.corridors).toHaveLength(corridors + 1);
  });
});
