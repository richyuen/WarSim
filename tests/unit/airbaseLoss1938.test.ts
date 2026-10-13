import { describe, expect, it } from 'vitest';
import { EventKind } from '../../src/shared/events';
import { airbaseRoom } from '../../src/sim/data/airbases';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { airSystem, basePlace, wingAircraft } from '../../src/sim/systems/air';
import { seaKm } from '../../src/sim/systems/navalCombat';
import type { World } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';
import { nationId } from '../helpers/sim1938';

// PLAN 5.8m: who holds the cell holds the base. A wing whose airbase a nation not of its side
// took falls back to its nation's nearest airbase with room, its mission ended; with none, it is
// lost.

const [GER, POL] = ['GER', 'POL'].map(nationId) as [number, number];
const sim = (): World => new Sim({ scenario: '1938', seed: 1, assets: assets1938(SIZE_1938.w) }).world;
const wingsAt = (w: World, base: number): number[] => [...w.wingBase].filter(([, b]) => b === base).map(([id]) => id).sort((a, b) => a - b);

describe('a wing whose airbase was taken (PLAN 5.8m)', () => {
  it('falls back to its nation\'s nearest airbase with room, its mission and sortie ended', () => {
    const w = sim();
    const c = w.formations.cols;
    const base = [...new Set(w.wingBase.values())].filter((b) => b > 0 && w.cells.controller[w.airbases[b - 1]!.cell] === GER).sort((a, b) => a - b)[0]!;
    const wings = wingsAt(w, base);
    expect(wings.length).toBeGreaterThan(0);
    const [wing] = wings as [number];
    const [bx, by] = basePlace(w, base)!;
    w.wingMission.set(wing, { kind: 'patrol', x: bx, y: by });
    w.cells.controller[w.airbases[base - 1]!.cell] = POL;
    airSystem(w);
    for (const id of wings) {
      const to = w.wingBase.get(id)!;
      expect(to).toBeGreaterThan(0);
      expect(to).not.toBe(base);
      expect(w.cells.controller[w.airbases[to - 1]!.cell]).toBe(GER);
      expect([c.x[id], c.y[id]]).toEqual(basePlace(w, to));
    }
    expect(w.wingMission.has(wing)).toBe(false);
    // The nearest of Germany's with room for the first of them, as the wings stood before it.
    const used = new Map<number, number>();
    for (const [o, b] of w.wingBase) if (b > 0 && !wings.includes(o)) used.set(b, (used.get(b) ?? 0) + wingAircraft(w, c.template[o]!));
    const need = wingAircraft(w, c.template[wing]!);
    const km = (i: number): number => seaKm(w, bx, by, ...w.cellPoint(w.airbases[i]!.cell));
    const fits = w.airbases.map((_, i) => i).filter((i) => i + 1 !== base && w.cells.controller[w.airbases[i]!.cell] === GER && (used.get(i + 1) ?? 0) + need <= airbaseRoom(w.airbases[i]!));
    const nearest = Math.min(...fits.map(km));
    expect(km(w.wingBase.get(wing)! - 1)).toBe(nearest);
  });

  it('is lost with no airbase of its nation\'s left with room', () => {
    const w = sim();
    w.airbases.forEach((b) => {
      if (w.cells.controller[b.cell] === GER) w.cells.controller[b.cell] = POL;
    });
    const wings = [...w.wingBase].filter(([id, b]) => b > 0 && w.formations.cols.nation[id] === GER).map(([id]) => id);
    expect(wings.length).toBeGreaterThan(0);
    w.out.events.length = 0;
    airSystem(w);
    for (const id of wings) {
      expect(w.formations.has(id)).toBe(false);
      expect(w.wingBase.has(id)).toBe(false);
    }
    const lost: number[] = [];
    for (let i = 0; i < w.out.events.length; i += 6) if (w.out.events[i + 1] === EventKind.FormationDestroyed) lost.push(w.out.events[i + 2]!);
    expect(lost.sort((a, b) => a - b)).toEqual(wings.sort((a, b) => a - b));
  });

  it('an airbase held by a nation fighting beside it is no loss', () => {
    const w = sim();
    const ITA = nationId('ITA');
    const [id, base] = [...w.wingBase].find(([o, b]) => b > 0 && w.formations.cols.nation[o] === GER)!;
    w.wars.start([GER, ITA], [POL], 0);
    expect(w.wars.sameSide(GER, ITA)).toBe(true);
    w.cells.controller[w.airbases[base - 1]!.cell] = ITA;
    airSystem(w);
    expect(w.wingBase.get(id)).toBe(base);
  });
});
