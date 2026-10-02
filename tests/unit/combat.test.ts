import { writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { EventKind } from '../../src/shared/events';
import { Terrain } from '../../src/shared/terrain';
import { cellOf } from '../../src/sim/data/terrain';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { combatSystem, findBattles } from '../../src/sim/systems/combat';
import { destroyFormation, elementIndex } from '../../src/sim/systems/elements';
import { FIRE_STRIDE, type World } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';
import { addDivision, nationId } from '../helpers/sim1938';

// PLAN 1.13 engagement + element combat v1. AT: Lanchester sanity (2:1 force wins with the
// expected loss ratio ±20%); terrain defence matters; FireEvents carry valid ids.

const W = SIZE_1938.w;
const H = SIZE_1938.h;
const GER = nationId('GER');
const POL = nationId('POL');

/** A 1938 sim with every starting formation removed, GER and POL at war. */
function emptyWar(seed = 1): Sim {
  const s = new Sim({ scenario: '1938', seed, assets: assets1938(W) });
  s.world.formations.ids().forEach((id) => destroyFormation(s.world, id));
  s.world.out.events.length = 0;
  s.world.wars.set(GER, POL, true);
  return s;
}

const spawn = (world: World, nation: number, x: number, y: number): number => addDivision(world, nation, x, y);

/** Paints a 7×7 block of cells around (x, y) with one terrain. */
function paint(world: World, x: number, y: number, t: number): void {
  for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) world.cells.terrain[(Math.floor(y) + dy) * W + Math.floor(x) + dx] = t;
}

/** Runs only the combat system for up to `hours` (isolates it from supply and movement). */
function fight(world: World, hours: number, until?: () => boolean): number {
  let h = 0;
  for (; h < hours && !(until?.() ?? false); h++) {
    combatSystem(world);
    world.tick++;
    world.out.fires.length = 0;
  }
  return h;
}

const [X0, Y0] = cellOf(30.0, 50.0, W, H).map(Math.floor) as [number, number]; // Ukrainian plains
const men = (world: World, ids: number[]): number => ids.reduce((s, id) => s + (world.formations.has(id) ? world.formations.cols.strength[id]! : 0), 0);

describe('engagement + element combat v1 (PLAN 1.13)', () => {
  it('a 2:1 force wins with the Lanchester square-law loss ratio (±20%)', () => {
    const s = emptyWar(11);
    const w = s.world;
    paint(w, X0, Y0, Terrain.Plains);
    const a = [spawn(w, GER, X0 + 0.5, Y0 + 0.2), spawn(w, GER, X0 + 0.5, Y0 + 0.8)];
    const b = [spawn(w, POL, X0 + 1.5, Y0 + 0.5)];
    const a0 = men(w, a);
    const b0 = men(w, b);
    expect(a0).toBe(2 * b0);
    const hours = fight(w, 24 * 90, () => !w.formations.has(b[0]!));
    expect(w.formations.has(b[0]!)).toBe(false); // the weaker side is destroyed
    const lossA = a0 - men(w, a);
    // Square law: A ends with sqrt(A² − B²); A loses (2 − √3)·B ≈ 0.268·B.
    const expected = 2 - Math.sqrt(3);
    expect(lossA / b0).toBeGreaterThan(expected * 0.8);
    expect(lossA / b0).toBeLessThan(expected * 1.2);
    if (process.env['COMBAT_LOG']) writeFileSync(process.env['COMBAT_LOG'], `lossA/B0 ${lossA / b0} expected ${expected} hours ${hours}`);
    expect(hours).toBeGreaterThan(24 * 5); // a battle of days, not hours
    expect(hours).toBeLessThan(24 * 60);
  });

  it('terrain defence matters: a holding division on hills loses less than on plains', () => {
    const lossOn = (t: number): number => {
      const s = emptyWar(5);
      const w = s.world;
      paint(w, X0, Y0, t);
      const att = spawn(w, GER, X0 + 0.5, Y0 + 0.5);
      w.formations.cols.moving[att] = 1; // attacking: no terrain defence for it
      const def = spawn(w, POL, X0 + 1.5, Y0 + 0.5);
      const d0 = men(w, [def]);
      fight(w, 48);
      return d0 - men(w, [def]);
    };
    const plains = lossOn(Terrain.Plains);
    const hills = lossOn(Terrain.Hills);
    const mountains = lossOn(Terrain.Mountains);
    expect(plains).toBeGreaterThan(0);
    expect(hills / plains).toBeGreaterThan(0.6);
    expect(hills / plains).toBeLessThan(0.9); // ÷1.3
    expect(mountains).toBeLessThan(hills);
  });

  it('fire events carry valid, hostile shooter and target ids and in-battle positions', () => {
    const s = emptyWar(3);
    const w = s.world;
    const a = spawn(w, GER, X0 + 0.5, Y0 + 0.5);
    const b = spawn(w, POL, X0 + 1.5, Y0 + 0.5);
    combatSystem(w);
    const fr = w.out.fires;
    expect(fr.length % FIRE_STRIDE).toBe(0);
    const n = fr.length / FIRE_STRIDE;
    expect(n).toBe(2 * 28); // every element of both 28-element divisions fired once
    const idx = elementIndex(w);
    const sideOf = (el: number): number => (idx.get(a)!.includes(el) ? a : idx.get(b)!.includes(el) ? b : 0);
    for (let i = 0; i < n; i++) {
      const [tick, sub, shooter, target, , dmg, x0, y0, x1, y1] = fr.slice(i * FIRE_STRIDE, (i + 1) * FIRE_STRIDE) as number[];
      expect(tick).toBe(w.tick);
      expect(sub).toBeGreaterThanOrEqual(0);
      expect(sub).toBeLessThan(60);
      expect(w.elements.has(shooter!)).toBe(true);
      expect(w.elements.has(target!)).toBe(true);
      expect(sideOf(shooter!)).not.toBe(0);
      expect(sideOf(target!)).not.toBe(0);
      expect(sideOf(shooter!)).not.toBe(sideOf(target!));
      expect(dmg).toBeGreaterThan(0);
      for (const [x, y] of [
        [x0!, y0!],
        [x1!, y1!],
      ] as const) {
        expect(Math.abs(x - (X0 + 1))).toBeLessThan(1.5);
        expect(Math.abs(y - (Y0 + 0.5))).toBeLessThan(1);
      }
    }
  });

  it('only nations at war engage; contact pauses a march; the battle runs in the full sim', () => {
    const s = emptyWar(4);
    const w = s.world;
    const a = spawn(w, GER, X0 + 0.5, Y0 + 0.5);
    const neutral = spawn(w, nationId('SWE'), X0 + 1.5, Y0 + 0.5);
    expect(findBattles(w)).toEqual([]);
    destroyFormation(w, neutral);
    w.out.events.length = 0; // that removal is setup, not battle
    const b = spawn(w, POL, X0 + 1.5, Y0 + 0.5);
    w.formations.cols.moving[a] = 1; // pretend it was marching
    const ax = w.formations.cols.x[a];
    const a0 = w.formations.cols.strength[a]!;
    expect(findBattles(w)).toEqual([[Math.min(a, b), Math.max(a, b)]]); // ascending ids (ids are reused)
    let destroyed = 0;
    s.step(24, (wd) => {
      for (let i = 0; i < wd.out.events.length; i += 6) if (wd.out.events[i + 1] === EventKind.FormationDestroyed) destroyed++;
      wd.out.events.length = 0;
      wd.out.fires.length = 0;
    });
    expect(w.formations.cols.engaged[a]).toBe(1);
    expect(w.formations.cols.x[a]).toBe(ax); // held position
    expect(w.formations.cols.strength[a]).toBeLessThan(a0);
    expect(destroyed).toBe(0);
  });

  it('a battle is deterministic across save/load, even into a live sim', () => {
    const run = (split: boolean): number => {
      const s = emptyWar(8);
      spawn(s.world, GER, X0 + 0.5, Y0 + 0.5);
      spawn(s.world, POL, X0 + 1.5, Y0 + 0.5);
      s.step(30);
      if (!split) {
        s.step(50);
        return s.hash();
      }
      const t = new Sim({ scenario: '1938', seed: 99, assets: assets1938(W) });
      t.step(3); // a live sim with its own caches loads the save
      t.load(s.save());
      t.step(50);
      return t.hash();
    };
    expect(run(true)).toBe(run(false));
  });

  it('the 1938 start seeds the Spanish and Sino-Japanese wars and equips every division', () => {
    const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
    expect(s.world.wars.atWar(nationId('NSP'), nationId('REP'))).toBe(true);
    expect(s.world.wars.atWar(nationId('JAP'), nationId('CHI'))).toBe(true);
    expect(s.world.wars.atWar(nationId('GER'), nationId('POL'))).toBe(false);
    const idx = elementIndex(s.world);
    s.world.formations.forEach((id) => expect(idx.get(id)?.length ?? 0).toBeGreaterThan(0));
    expect(H).toBe(SIZE_1938.h);
  });
});
