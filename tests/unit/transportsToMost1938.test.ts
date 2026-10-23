import { describe, expect, it } from 'vitest';
import { invasionAi } from '../../src/sim/ai/invasion';
import { STAGGER } from '../../src/sim/ai/strategic';
import { NATIONS_1938, SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { destroyFormation } from '../../src/sim/systems/elements';
import { transportRoom } from '../../src/sim/systems/amphibious';
import { declareWar } from '../../src/sim/systems/war';
import { navOf, portSeaOf } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';

// PLAN 7.97 (ADR-662): a transport group that finds nobody to ship where it stands sails for the land
// where most of its nation's free army stands. Before, the landing's group (the most room) at Pearl
// Harbor found nobody on Hawaii and gave no order, every week, while 32–36 US divisions stood at
// Washington (seed 822 year 5). The USA in 1938 at war with Portugal alone (no land front), its one
// transport group at Pearl Harbor, no US army on Hawaii: on its first planning day the group is under
// way for a US port on the land of the most US land formations. The other AIs off, the invasion AI
// run by hand on the USA's planning days.

const { w: W } = SIZE_1938;
const id = (tag: string): number => NATIONS_1938.findIndex((n) => n.tag === tag) + 1;
const USA = id('USA');
const POR = id('POR');

describe('the transports go where most of the army stands (PLAN 7.97)', () => {
  it('a transport group at Pearl Harbor with nobody on Hawaii sails for a US port on the mainland', () => {
    const s = new Sim({ scenario: '1938', seed: 4603, assets: assets1938(W) });
    const w = s.world;
    s.command({ kind: 'setSetting', key: 'aiEnabled', value: false });
    s.step(1);
    const c = w.formations.cols;
    const water = portSeaOf(w);
    const comp = navOf(w).grid.component;
    const ph = w.ports.findIndex((p) => p.name === 'Pearl Harbor');
    expect(ph).toBeGreaterThanOrEqual(0);
    const port = w.ports[ph]!;
    const sea = water[ph]!;
    expect(w.cells.controller[port.cell]).toBe(USA);
    expect(sea).toBeGreaterThanOrEqual(0);
    expect(declareWar(w, USA, POR, true)).not.toBeNull();
    for (const [wing] of [...w.wingBase]) if ([USA, POR].includes(c.nation[wing]!)) destroyFormation(w, wing);
    // One US transport group, at Pearl Harbor's water.
    const groups: number[] = [];
    w.formations.forEach((f) => {
      if (w.isFleet(f) && c.nation[f] === USA && transportRoom(w, f) > 0) groups.push(f);
    });
    expect(groups.length).toBeGreaterThan(0);
    const [tp, ...rest] = groups;
    for (const f of rest) destroyFormation(w, f);
    [c.x[tp!], c.y[tp!]] = [(sea % W) + 0.5, Math.floor(sea / W) + 0.5];
    c.moving[tp!] = 0;
    // No US land formation on Hawaii; the land of the most US land formations by men.
    const cellOf = (f: number): number => Math.floor(c.y[f]!) * W + Math.floor(c.x[f]!);
    const land: number[] = [];
    w.formations.forEach((f) => {
      if (c.nation[f] === USA && !w.isFleet(f) && !w.isWing(f)) land.push(f);
    });
    for (const f of land) if (comp[cellOf(f)] === comp[port.cell]) destroyFormation(w, f);
    const men = new Map<number, number>();
    w.formations.forEach((f) => {
      if (c.nation[f] !== USA || w.isFleet(f) || w.isWing(f)) return;
      const l = comp[cellOf(f)]!;
      men.set(l, (men.get(l) ?? 0) + c.strength[f]!);
    });
    const most = [...men].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]![0];
    expect(most).not.toBe(comp[port.cell]);
    // On its first planning day the group is under way, for a US port on that land.
    s.step(24 - (w.tick % 24));
    let sailedFor = -1;
    for (let d = 0; d < STAGGER && sailedFor < 0; d++) {
      if ((w.tick / 24 + USA) % STAGGER === 0) {
        w.settings.aiEnabled = true;
        invasionAi(w);
        w.settings.aiEnabled = false;
        if (c.moving[tp!] === 1) {
          const p = w.paths.get(tp!);
          if (p) sailedFor = p[p.length - 1]!;
        }
        break;
      }
      s.step(24);
    }
    expect(sailedFor).toBeGreaterThanOrEqual(0);
    const near = (a: number, b: number, r: number): boolean => Math.abs((a % W) - (b % W)) <= r && Math.abs(Math.floor(a / W) - Math.floor(b / W)) <= r;
    const at = w.ports.findIndex((p, k) => k !== ph && water[k]! >= 0 && near(water[k]!, sailedFor, 3) && w.cells.controller[p.cell] === USA);
    expect(at).toBeGreaterThanOrEqual(0);
    expect(comp[w.ports[at]!.cell]).toBe(most);
  });
});
