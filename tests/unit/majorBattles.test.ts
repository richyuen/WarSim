import { describe, expect, it } from 'vitest';
import { EventKind } from '../../src/shared/events';
import { Terrain } from '../../src/shared/terrain';
import { cellOf } from '../../src/sim/data/terrain';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { combatSystem } from '../../src/sim/systems/combat';
import { destroyFormation } from '../../src/sim/systems/elements';
import { CORRIDOR_DAYS, inCorridor, MAJOR_LOSS_MULT, MAJOR_MEN } from '../../src/sim/systems/majorBattles';
import { territorySystem } from '../../src/sim/systems/territory';
import { FIRE_STRIDE, type World } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';
import { addDivision, nationId } from '../helpers/sim1938';

// PLAN 1.23: Major Battles + breakthrough corridor. AT: a concentration test triggers a Major
// Battle; the corridor flips cells faster for D days; history entry.

const W = SIZE_1938.w;
const H = SIZE_1938.h;
const [GER, POL] = ['GER', 'POL'].map(nationId) as [number, number];
const [X0, Y0] = cellOf(30, 50, W, H).map(Math.floor) as [number, number];

function emptyWar(seed = 1): Sim {
  const s = new Sim({ scenario: '1938', seed, assets: assets1938(W) });
  s.world.formations.ids().forEach((f) => destroyFormation(s.world, f));
  s.world.out.events.length = 0;
  s.world.wars.set(GER, POL, true);
  return s;
}

/** `n` divisions a side, stacked on two neighbouring plains cells. */
function clash(w: World, n: number): { ger: number[]; pol: number[] } {
  for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 4; dx++) w.cells.terrain[(Y0 + dy) * W + X0 + dx] = Terrain.Plains;
  const ger = Array.from({ length: n }, () => addDivision(w, GER, X0 + 0.5, Y0 + 0.5));
  const pol = Array.from({ length: n }, () => addDivision(w, POL, X0 + 1.5, Y0 + 0.5));
  return { ger, pol };
}

const ofKind = (w: World, k: number): number[][] => {
  const out: number[][] = [];
  for (let i = 0; i < w.out.events.length; i += 6) if (w.out.events[i + 1] === k) out.push(w.out.events.slice(i + 2, i + 6));
  return out;
};

/** Damage of German infantry shots at infantry in one hour (the per-shot value). */
function gerInfantryShot(w: World): number {
  const fr = w.out.fires;
  const inf = w.rules!.units.findIndex((u) => u.cls === 'inf');
  for (let i = 0; i < fr.length; i += FIRE_STRIDE) {
    const shooter = fr[i + 2]!;
    const target = fr[i + 3]!;
    if (w.formations.cols.nation[w.elements.cols.formation[shooter]!] === GER && w.elements.cols.unit[shooter] === inf && w.elements.cols.unit[target] === inf) return fr[i + 5]!;
  }
  return NaN;
}

describe('Major Battles (PLAN 1.23)', () => {
  it(`a concentration of ≥ ${MAJOR_MEN} men triggers a Major Battle with amplified losses; a small one does not`, () => {
    const small = emptyWar();
    clash(small.world, 1);
    combatSystem(small.world);
    expect(ofKind(small.world, EventKind.MajorBattleStarted)).toEqual([]);
    const smallShot = gerInfantryShot(small.world);

    const big = emptyWar();
    clash(big.world, 5);
    combatSystem(big.world);
    const started = ofKind(big.world, EventKind.MajorBattleStarted);
    expect(started.length).toBe(1);
    expect(started[0]![1]).toBeGreaterThan(0); // named after its nearest city
    expect(big.world.battles.history.map((h) => h.kind)).toEqual([EventKind.MajorBattleStarted]);
    expect(gerInfantryShot(big.world) / smallShot).toBeCloseTo(MAJOR_LOSS_MULT, 9);
  });

  it('when the battle dissolves the winner gets a corridor toward the loser, logged in the history', () => {
    const s = emptyWar();
    const w = s.world;
    const { pol } = clash(w, 5);
    for (let h = 0; h < 6; h++) {
      combatSystem(w);
      w.tick++;
    }
    for (const id of pol) destroyFormation(w, id); // Poland's army is gone
    w.out.events.length = 0;
    combatSystem(w);
    expect(ofKind(w, EventKind.MajorBattleEnded).map((e) => e[1])).toEqual([GER]);
    expect(w.battles.history.map((h) => h.kind)).toEqual([EventKind.MajorBattleStarted, EventKind.MajorBattleEnded]);
    const c = w.battles.corridors[0]!;
    expect(c.nation).toBe(GER);
    expect(c.dx).toBeGreaterThan(0.9); // pointing east, at the Polish side
    expect(c.untilTick).toBe(w.tick + CORRIDOR_DAYS * 24);
  });

  it(`the corridor flips cells faster for ${CORRIDOR_DAYS} days, then expires`, () => {
    const setup = (corridor: boolean): Sim => {
      const s = emptyWar(2);
      const w = s.world;
      const split = X0 + 2;
      for (let y = Y0 - 4; y <= Y0 + 4; y++) {
        for (let x = X0 - 6; x <= X0 + 14; x++) {
          w.cells.terrain[y * W + x] = Terrain.Plains;
          w.setController(y * W + x, x < split ? GER : POL);
        }
      }
      addDivision(w, GER, split - 0.5, Y0 + 0.5);
      if (corridor) s.command({ kind: 'forceBreakthrough', nation: GER, x: split - 0.5, y: Y0 + 0.5, toX: split + 8, toY: Y0 + 0.5 });
      s.step(1, () => {}); // applies the command at tick 0 (systems run too)
      return s;
    };
    const flips = (s: Sim, hours: number): number => {
      const w = s.world;
      const before = new Uint16Array(w.cells.controller);
      for (let h = 0; h < hours; h++) {
        territorySystem(w);
        w.tick++;
      }
      let n = 0;
      for (let c = 0; c < before.length; c++) if (before[c] !== w.cells.controller[c]) n++;
      return n;
    };
    const plain = setup(false);
    const fast = setup(true);
    const cell = Y0 * W + X0 + 3; // just inside Poland, on the corridor axis
    expect(inCorridor(fast.world, GER, cell)).toBe(true);
    // Time to the first flip on the axis: the hold time (16 h) vs a quarter of it.
    const firstFlip = (s: Sim): number => {
      for (let h = 1; h <= 48; h++) if (flips(s, 1) > 0 && s.world.cells.controller[cell] === GER) return h;
      return Infinity;
    };
    const tPlain = firstFlip(plain);
    const tFast = firstFlip(fast);
    expect(tFast * 3).toBeLessThanOrEqual(tPlain);
    // Over the same 12 hours, the corridor has flipped cells where the plain front has not yet.
    const p2 = setup(false);
    const f2 = setup(true);
    expect(flips(p2, 12)).toBe(0);
    expect(flips(f2, 12)).toBeGreaterThanOrEqual(3);
    // Expiry: active until untilTick, gone at it.
    const until = fast.world.battles.corridors[0]!.untilTick;
    fast.world.tick = until - 1;
    expect(inCorridor(fast.world, GER, cell)).toBe(true);
    fast.world.tick = until;
    expect(inCorridor(fast.world, GER, cell)).toBe(false);
  });

  it('Major Battle state survives save/load into a live sim', () => {
    const run = (split: boolean): number => {
      const s = emptyWar(3);
      clash(s.world, 5);
      s.step(10);
      if (!split) {
        s.step(30);
        return s.hash();
      }
      const t = new Sim({ scenario: '1938', seed: 9, assets: assets1938(W) });
      t.step(2);
      t.load(s.save());
      expect(t.world.battles.majors.length).toBe(1);
      t.step(30);
      return t.hash();
    };
    expect(run(true)).toBe(run(false));
  });
});
