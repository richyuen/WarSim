import { describe, expect, it } from 'vitest';
import { Refusal, type Command } from '../../src/shared/commands';
import { EventKind } from '../../src/shared/events';
import type { FromWorker } from '../../src/shared/protocol';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { SimServer } from '../../src/worker/server';
import { assets1938 } from '../helpers/earth';
import { runEvents } from '../helpers/sim1938';

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
