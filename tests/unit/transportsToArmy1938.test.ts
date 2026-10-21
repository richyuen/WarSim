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

// PLAN 7.54b (ADR-595): after a landing the transports sail for their nation's nearest port, which
// may be an exclave (seed 4513 year 10: Germany's at Kotor; 7247 and 8693: Annaba): the army could
// not march there across neutral ground, and the invasion AI sent nobody, every week. The
// transports now sail to the army. Germany in 1938 at war with Portugal (no land front), its one
// transport group at Königsberg (East Prussia, the Polish corridor between it and the Reich), no
// German army in East Prussia: the group sails for a German port its army can reach, and a division
// goes aboard there. The other AIs off (Germany's 1938 army is on the march under them), the
// invasion AI run by hand on Germany's planning days.

const { w: W } = SIZE_1938;
const id = (tag: string): number => NATIONS_1938.findIndex((n) => n.tag === tag) + 1;
const GER = id('GER');
const POR = id('POR');

describe('the transports go to the army (PLAN 7.54b)', () => {
  it('a transport group in an exclave sails for a port of the Reich, and a division boards there', () => {
    const s = new Sim({ scenario: '1938', seed: 4601, assets: assets1938(W) });
    const w = s.world;
    s.command({ kind: 'setSetting', key: 'aiEnabled', value: false });
    s.step(1);
    const c = w.formations.cols;
    const water = portSeaOf(w);
    const comp = navOf(w).grid.component;
    const kb = w.ports.findIndex((p) => p.name === 'Königsberg');
    expect(kb).toBeGreaterThanOrEqual(0);
    const port = w.ports[kb]!;
    const sea = water[kb]!;
    expect(w.cells.controller[port.cell]).toBe(GER);
    expect(sea).toBeGreaterThanOrEqual(0);
    expect(declareWar(w, GER, POR, true)).not.toBeNull();
    for (const [wing] of [...w.wingBase]) if ([GER, POR].includes(c.nation[wing]!)) destroyFormation(w, wing);
    // One German transport group, at Königsberg's water.
    const groups: number[] = [];
    w.formations.forEach((f) => {
      if (w.isFleet(f) && c.nation[f] === GER && transportRoom(w, f) > 0) groups.push(f);
    });
    expect(groups.length).toBeGreaterThan(0);
    const [tp, ...rest] = groups;
    for (const f of rest) destroyFormation(w, f);
    [c.x[tp!], c.y[tp!]] = [(sea % W) + 0.5, Math.floor(sea / W) + 0.5];
    c.moving[tp!] = 0;
    // No German land formation in East Prussia (within 40 cells of Königsberg).
    const cellOf = (f: number): number => Math.floor(c.y[f]!) * W + Math.floor(c.x[f]!);
    const near = (a: number, b: number, r: number): boolean => Math.abs((a % W) - (b % W)) <= r && Math.abs(Math.floor(a / W) - Math.floor(b / W)) <= r;
    const land: number[] = [];
    w.formations.forEach((f) => {
      if (c.nation[f] === GER && !w.isFleet(f) && !w.isWing(f)) land.push(f);
    });
    for (const f of land) if (near(cellOf(f), port.cell, 40)) destroyFormation(w, f);
    // On its first planning day the group is under way for a German port on the Reich's land, and
    // within 60 days a division is aboard.
    let sailedFor = -1;
    let boarded = false;
    s.step(24 - (w.tick % 24));
    for (let d = 0; d < 60 && !boarded; d++) {
      if ((w.tick / 24 + GER) % STAGGER === 0) {
        w.settings.aiEnabled = true;
        invasionAi(w);
        w.settings.aiEnabled = false;
      }
      s.step(24);
      if (sailedFor < 0 && c.moving[tp!] === 1) {
        const p = w.paths.get(tp!);
        if (p) sailedFor = p[p.length - 1]!;
      }
      for (const f of w.embarked.keys()) if (c.nation[f] === GER) boarded = true;
    }
    expect(sailedFor).toBeGreaterThanOrEqual(0);
    const at = w.ports.findIndex((p, k) => k !== kb && water[k]! >= 0 && near(water[k]!, sailedFor, 3) && w.cells.controller[p.cell] === GER);
    expect(at).toBeGreaterThanOrEqual(0);
    expect(comp[w.ports[at]!.cell]).toBe(comp[port.cell]);
    expect(boarded).toBe(true);
  });
});
