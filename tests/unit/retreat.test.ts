import { describe, expect, it } from 'vitest';
import { Refusal } from '../../src/shared/commands';
import { EventKind } from '../../src/shared/events';
import { operationalAi, STAGGER } from '../../src/sim/ai/operational';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { cellDist, CONTACT_CELLS, destroyFormation } from '../../src/sim/systems/elements';
import { ORG_PER_LOSS, RETREAT_HOURS, RETREAT_ORG, RETREAT_REACH, RETREAT_RETRY_HOURS } from '../../src/sim/systems/retreat';
import { territorySystem } from '../../src/sim/systems/territory';
import { FIRE_STRIDE, type World } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';
import { addDivision, eventKinds, FIELD_X, FIELD_Y, nationId, runEvents } from '../helpers/sim1938';

// PLAN 3.5a: the retreat (SPEC §5.2 step 4). Org is lost to the losses of a battle and is not
// got back in contact; a formation in contact with little org breaks off, marches to ground of
// its side out of the enemy's contact, and is out of battles and of the AI's orders for a day.

const W = SIZE_1938.w;
const [SOV, GER] = ['SOV', 'GER'].map(nationId) as [number, number];

/**
 * A Soviet division on its own ground (30° E, 50° N) and a German one a cell east of it, at
 * war, with no other formation in the world and no AI. The German has no ground of its side.
 */
function duel(): { s: Sim; w: World; sov: number; ger: number } {
  const s = new Sim({ scenario: '1938', seed: 5, assets: assets1938(W) });
  const w = s.world;
  w.settings.aiEnabled = false;
  w.formations.ids().forEach((id) => destroyFormation(w, id));
  w.wars.set(SOV, GER, true);
  const sov = addDivision(w, SOV, FIELD_X + 0.5, FIELD_Y + 0.5);
  const ger = addDivision(w, GER, FIELD_X + 1.5, FIELD_Y + 0.5);
  return { s, w, sov, ger };
}

/** Steps until the formation is on the retreat (at most a retry period and an hour); the events of those hours. */
function untilRetreat(s: Sim, id: number): number[][] {
  const ev: number[][] = [];
  for (let i = 0; i <= RETREAT_RETRY_HOURS && s.world.formations.cols.retreat[id] === 0; i++) ev.push(...runEvents(s, 1));
  return ev;
}

describe('the retreat (PLAN 3.5a)', () => {
  it('org is lost with the losses of a battle: the share of its strength × ORG_PER_LOSS', () => {
    const { s, w, sov, ger } = duel();
    const f = w.formations.cols;
    s.step(1); // contact
    expect(f.engaged[sov]).toBe(1);
    expect(f.engaged[ger]).toBe(1);
    for (let hour = 0; hour < 5; hour++) {
      const before = [sov, ger].map((id) => [f.strength[id]!, f.org[id]!] as const);
      s.step(1);
      [sov, ger].forEach((id, i) => {
        const [strength, org] = before[i]!;
        expect(f.strength[id]!).toBeLessThan(strength);
        expect(f.org[id]).toBe(Math.max(0, org - (ORG_PER_LOSS * (strength - f.strength[id]!)) / strength));
      });
    }
    expect(f.org[sov]!).toBeLessThan(1);
    // A third of its strength lost in battle takes all of it.
    expect(ORG_PER_LOSS).toBeCloseTo(1 / 0.3, 12);
  });

  it('in contact a formation on its network gets no org back; out of contact it does', () => {
    const { s, w, sov, ger } = duel();
    const f = w.formations.cols;
    s.step(1);
    f.org[sov] = 0.5;
    s.step(4);
    expect(f.supply[sov]).toBe(1);
    expect(f.org[sov]!).toBeLessThan(0.5);
    destroyFormation(w, ger);
    f.org[sov] = 0.5;
    s.step(1); // the hour's supply still finds it in contact
    expect(f.engaged[sov]).toBe(0);
    s.step(4);
    expect(f.org[sov]!).toBeGreaterThan(0.5);
  });

  it('a formation in contact with little org breaks off, marches out of contact and is not fired on', () => {
    const { s, w, sov, ger } = duel();
    const f = w.formations.cols;
    s.step(1);
    f.org[sov] = RETREAT_ORG - 0.01;
    const ev = untilRetreat(s, sov);
    expect(f.retreat[sov]).toBe(RETREAT_HOURS);
    expect(f.moving[sov]).toBe(1);
    expect(f.engaged[sov]).toBe(0);
    expect(f.engaged[ger]).toBe(0);
    expect(eventKinds(ev, EventKind.FormationRetreated)).toEqual([[sov, SOV]]);
    // Its target: ground of its own side, out of the German's contact.
    const target = f.targetCell[sov]!;
    expect(w.cells.controller[target]).toBe(SOV);
    expect(cellDist(w, (target % W) + 0.5, Math.floor(target / W) + 0.5, f.x[ger]!, f.y[ger]!)).toBeGreaterThan(CONTACT_CELLS);
    // The day of the retreat: no volley from it or at it, and it goes from the enemy.
    const strength = f.strength[sov]!;
    const from = cellDist(w, f.x[sov]!, f.y[sov]!, f.x[ger]!, f.y[ger]!);
    let fires = 0;
    s.step(RETREAT_HOURS - 1, (world) => {
      fires += world.out.fires.length / FIRE_STRIDE;
      world.out.fires.length = 0;
    });
    expect(fires).toBe(0);
    expect(f.strength[sov]).toBe(strength);
    expect(f.retreat[sov]).toBe(1);
    expect(cellDist(w, f.x[sov]!, f.y[sov]!, f.x[ger]!, f.y[ger]!)).toBeGreaterThan(from);
    // On its network and out of contact it has its order back.
    expect(f.org[sov]!).toBeGreaterThan(0.5);
    s.step(1);
    expect(f.retreat[sov]).toBe(0);
  });

  it('a formation with org enough stays, and one with no ground of its side behind it holds', () => {
    const { s, w, sov, ger } = duel();
    const f = w.formations.cols;
    s.step(1);
    f.org[sov] = 1;
    f.org[ger] = 0; // on Soviet ground, with none of its own within reach
    const ev = runEvents(s, 2 * RETREAT_RETRY_HOURS);
    expect(f.retreat[sov]).toBe(0);
    expect(f.retreat[ger]).toBe(0);
    expect(f.engaged[sov]).toBe(1);
    expect(f.engaged[ger]).toBe(1);
    expect(eventKinds(ev, EventKind.FormationRetreated)).toEqual([]);
  });

  it('with the ground behind it the enemy\'s, it makes for the nearest ground of its side within reach, over the enemy\'s cells', () => {
    const { s, w, sov, ger } = duel();
    const f = w.formations.cols;
    // German ground five and six cells north of the German division; none where it would fall back to, east.
    for (let dy = -6; dy <= -5; dy++) for (let dx = 0; dx <= 2; dx++) w.setController((FIELD_Y + dy) * W + FIELD_X + dx, GER);
    expect(RETREAT_REACH).toBeGreaterThanOrEqual(5);
    s.step(1);
    f.org[sov] = 1;
    f.org[ger] = 0;
    const from = [f.x[ger]!, f.y[ger]!] as const;
    untilRetreat(s, ger);
    expect(f.retreat[ger]).toBe(RETREAT_HOURS);
    expect(f.targetCell[ger]).toBe((FIELD_Y - 5) * W + FIELD_X + 1);
    // A march does not enter a cell the enemy holds; this one does.
    s.step(RETREAT_HOURS - 1);
    expect(f.pathStep[ger]!).toBeGreaterThanOrEqual(1);
    expect(f.y[ger]!).toBeLessThan(from[1] - 1);
    expect(w.cells.controller[Math.floor(f.y[ger]!) * W + Math.floor(f.x[ger]!)]).toBe(SOV);
    expect(f.engaged[sov]).toBe(0);
  });

  it('a formation on the retreat presses no cell', () => {
    const { s, w, sov, ger } = duel();
    const f = w.formations.cols;
    destroyFormation(w, ger);
    s.step(1);
    // The cell east of it is a German one on the front.
    const east = FIELD_Y * W + FIELD_X + 1;
    w.setController(east, GER);
    f.retreat[sov] = 200;
    for (let i = 0; i < 48; i++) territorySystem(w);
    expect(w.cells.controller[east]).toBe(GER);
    f.retreat[sov] = 0;
    for (let i = 0; i < 48 && w.cells.controller[east] === GER; i++) territorySystem(w);
    expect(w.cells.controller[east]).toBe(SOV);
  });

  it('the operational AI gives a formation on the retreat no order', () => {
    const plan = (retreat: number): number => {
      const { w, sov, ger } = duel();
      const f = w.formations.cols;
      // The German far off, east of a front that it holds: the Soviet division is free.
      f.x[ger] = FIELD_X + 6.5;
      for (let dy = -2; dy <= 2; dy++) for (let dx = 3; dx <= 8; dx++) w.setController((FIELD_Y + dy) * W + FIELD_X + dx, GER);
      w.settings.aiEnabled = true;
      f.retreat[sov] = retreat;
      w.tick = 6 * STAGGER * 10 - 6 * (SOV % STAGGER);
      expect((w.tick / 6 + SOV) % STAGGER).toBe(0);
      operationalAi(w);
      return f.moving[sov]!;
    };
    expect(plan(0)).toBe(1);
    expect(plan(RETREAT_HOURS)).toBe(0);
  });

  // PLAN 3.7m (ADR-173): the retreat's march is not held by ground the enemy holds, and the
  // formation is in no battle. An order sent it forward over the enemy's cells for a day.
  it('an order to a formation on the retreat is refused: it does not go over the enemy\'s cells', () => {
    const { s, w, sov } = duel();
    const f = w.formations.cols;
    // The German's ground: its own cell and east of it.
    for (let dy = -1; dy <= 1; dy++) for (let dx = 1; dx <= 6; dx++) w.setController((FIELD_Y + dy) * W + FIELD_X + dx, GER);
    s.step(1);
    f.org[sov] = RETREAT_ORG - 0.01;
    untilRetreat(s, sov);
    expect(f.retreat[sov]).toBe(RETREAT_HOURS);
    const target = f.targetCell[sov]!;
    // Behind the enemy.
    s.command({ kind: 'moveFormation', id: sov, x: FIELD_X + 5.5, y: FIELD_Y + 0.5, nation: SOV });
    const ev = runEvents(s, 1);
    expect(eventKinds(ev, EventKind.CommandRefused).map(([, why]) => why)).toEqual([Refusal.OnRetreat]);
    expect(f.targetCell[sov]).toBe(target);
    let onEnemyGround = 0;
    for (let hour = 1; hour < RETREAT_HOURS; hour++) {
      s.step(1);
      if (w.cells.controller[Math.floor(f.y[sov]!) * W + Math.floor(f.x[sov]!)] === GER && f.engaged[sov] === 0) onEnemyGround++;
    }
    expect(onEnemyGround).toBe(0);
    // With the retreat over it takes the order.
    s.step(1);
    expect(f.retreat[sov]).toBe(0);
    s.command({ kind: 'moveFormation', id: sov, x: FIELD_X + 5.5, y: FIELD_Y + 0.5, nation: SOV });
    expect(eventKinds(runEvents(s, 1), EventKind.CommandRefused)).toEqual([]);
    expect(f.targetCell[sov]).toBe(FIELD_Y * W + FIELD_X + 5);
  });

  it('the retreat is state: a save has it, and the loaded game goes on as the saved one', () => {
    const { s, w, sov } = duel();
    const f = w.formations.cols;
    s.step(1);
    f.org[sov] = RETREAT_ORG - 0.01;
    untilRetreat(s, sov);
    s.step(3);
    const t = new Sim({ scenario: '1938', seed: 99, assets: assets1938(W) });
    t.step(3);
    t.load(s.save());
    expect(t.world.formations.cols.retreat[sov]).toBe(RETREAT_HOURS - 3);
    expect(t.hash()).toBe(s.hash());
    s.step(40);
    t.step(40);
    expect(t.world.formations.cols.retreat[sov]).toBe(0);
    expect(t.hash()).toBe(s.hash());
  });
});
