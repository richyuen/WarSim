import { describe, expect, it } from 'vitest';
import { EventKind } from '../../src/shared/events';
import { cellOf } from '../../src/sim/data/terrain';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { combatSystem } from '../../src/sim/systems/combat';
import { destroyFormation } from '../../src/sim/systems/elements';
import { FIRE_STRIDE, navOf } from '../../src/sim/world';
import { GARRISON_CELLS } from '../../src/sim/systems/revolts';
import { assets1938 } from '../helpers/earth';
import { addDivision, eventKinds, nationId, runEvents } from '../helpers/sim1938';

// PLAN 1.21: buffs/debuffs with timers. AT: the buff applies and expires exactly at expiresTick.

const W = SIZE_1938.w;
const H = SIZE_1938.h;
const [GER, POL] = ['GER', 'POL'].map(nationId) as [number, number];
const JAN = 24 * 31; // 00:00 on 1 February 1938

describe('buffs and debuffs (PLAN 1.21)', () => {
  it('an income buff applies from its grant and expires exactly at expiresTick', () => {
    const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
    const twin = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
    s.command({ kind: 'grantBuff', targetKind: 'nation', target: GER, buff: 'income', magnitude: 0.5, hours: JAN, nameKey: 'buff.war_bonds' });
    const ev0 = runEvents(s, 1); // tick 0 = 1 January: the grant applies before the economy
    runEvents(twin, 1);
    const [id] = eventKinds(ev0, EventKind.BuffGranted)[0]!;
    expect(s.world.buffs.list[0]!.expiresTick).toBe(JAN);
    expect(s.world.nations.cols.income[GER]).toBeCloseTo(1.5 * twin.world.nations.cols.income[GER]!, 9);

    // Still active on the last tick before expiry …
    runEvents(s, JAN - 1); // processes ticks 1 … JAN − 1
    runEvents(twin, JAN - 1);
    expect(s.world.tick).toBe(JAN);
    expect(s.world.buffs.sum('income', 'nation', GER)).toBe(0.5);
    // … and gone on tick JAN, before the 1 February economy runs.
    const ev = runEvents(s, 1);
    runEvents(twin, 1);
    expect(eventKinds(ev, EventKind.BuffExpired)).toEqual([[id, GER]]);
    expect(ev.find((e) => e[1] === EventKind.BuffExpired)![0]).toBe(JAN);
    expect(s.world.buffs.sum('income', 'nation', GER)).toBe(0);
    expect(s.world.nations.cols.income[GER]).toBe(twin.world.nations.cols.income[GER]);
  });

  it('an attack buff scales damage dealt and a defense buff divides damage taken', () => {
    const fire = (buffs: [string, number][]): number => {
      const s = new Sim({ scenario: '1938', seed: 4, assets: assets1938(W) });
      const w = s.world;
      w.formations.ids().forEach((f) => destroyFormation(w, f));
      w.wars.set(GER, POL, true);
      const [x, y] = cellOf(30, 50, W, H).map(Math.floor) as [number, number];
      const a = addDivision(w, GER, x + 0.5, y + 0.5);
      addDivision(w, POL, x + 1.5, y + 0.5);
      for (const [kind, m] of buffs) w.buffs.add({ targetKind: kind === 'attack' ? 'formation' : 'nation', target: kind === 'attack' ? a : POL, kind: kind as 'attack', magnitude: m, expiresTick: 99, nameKey: 'buff.test' });
      combatSystem(w);
      let dealt = 0;
      const fr = w.out.fires;
      for (let i = 0; i < fr.length; i += FIRE_STRIDE) if (w.elements.cols.formation[fr[i + 2]!] === a) dealt += fr[i + 5]!;
      return dealt;
    };
    const base = fire([]);
    expect(fire([['attack', 0.25]]) / base).toBeCloseTo(1.25, 9);
    expect(fire([['defense', 0.25]]) / base).toBeCloseTo(1 / 1.25, 9);
  });

  it('a speed buff shortens a march; an unrest buff raises province unrest', () => {
    const march = (speed: number): number => {
      const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
      s.world.settings.aiEnabled = false; // isolate the march from the AI (a war would re-order or engage the division)
      const [x, y] = cellOf(21.0, 52.23, W, H);
      const id = addDivision(s.world, POL, Math.floor(x) + 0.5, Math.floor(y) + 0.5);
      if (speed) s.command({ kind: 'grantBuff', targetKind: 'formation', target: id, buff: 'speed', magnitude: speed, hours: 24 * 60, nameKey: 'buff.test' });
      const [tx, ty] = cellOf(16.92, 52.41, W, H);
      s.command({ kind: 'moveFormation', id, x: tx, y: ty });
      for (let h = 1; h < 24 * 40; h++) if (eventKinds(runEvents(s, 1), EventKind.FormationArrived).some(([f]) => f === id)) return h;
      return Infinity;
    };
    const slow = march(0);
    const fast = march(1); // double speed
    expect(fast).toBeLessThan(slow * 0.55);
    expect(fast).toBeGreaterThan(slow * 0.45);

    const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
    // A core province of its holder with no garrison nearby (PLAN 1.40 added garrisons, which
    // lower unrest by 3): only the buff and the decay act on it. Province 200 has a garrison.
    const g = navOf(s.world).graph;
    const near = (c: number, n: number): boolean => {
      let hit = false;
      s.world.formations.forEach((f) => {
        const fc = s.world.formations.cols;
        if (fc.nation[f] === n && Math.abs(fc.x[f]! - (c % W)) <= 2 * GARRISON_CELLS && Math.abs(fc.y[f]! - Math.floor(c / W)) <= 2 * GARRISON_CELLS) hit = true;
      });
      return hit;
    };
    let p = 200;
    for (let q = 200; q < s.world.provinces.count; q++) {
      const c = g.centre[q] ?? -1;
      const o = c >= 0 ? s.world.cells.owner[c]! : 0;
      if (o !== 0 && s.world.cells.controller[c] === o && s.world.provinces.core[q] === o && !near(c, o)) {
        p = q;
        break;
      }
    }
    s.command({ kind: 'grantBuff', targetKind: 'province', target: p, buff: 'unrest', magnitude: 0.5, hours: 24 * 400, nameKey: 'buff.harsh_winter' });
    runEvents(s, 1);
    expect(s.world.provinces.unrest[p]).toBe(Math.max(0, 5 - 2)); // +10 × 0.5, −2 decay
  });

  it('removeBuff ends a buff early; buffs survive save/load', () => {
    const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
    s.command({ kind: 'grantBuff', targetKind: 'nation', target: GER, buff: 'manpower', magnitude: -0.3, hours: 500, nameKey: 'buff.losses' });
    s.command({ kind: 'grantBuff', targetKind: 'nation', target: POL, buff: 'income', magnitude: 0.1, hours: 900, nameKey: 'buff.aid' });
    runEvents(s, 3);
    const t = new Sim({ scenario: '1938', seed: 2, assets: assets1938(W) });
    t.load(s.save());
    expect(t.world.buffs.list).toEqual(s.world.buffs.list);
    s.command({ kind: 'removeBuff', id: 1 });
    t.command({ kind: 'removeBuff', id: 1 });
    expect(eventKinds(runEvents(s, 1), EventKind.BuffExpired)).toEqual([[1, GER]]);
    runEvents(t, 1);
    runEvents(s, 1200);
    runEvents(t, 1200);
    expect(s.world.buffs.list).toEqual([]);
    expect(t.hash()).toBe(s.hash());
  });
});
