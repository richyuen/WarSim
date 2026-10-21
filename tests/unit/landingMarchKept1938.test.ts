import { describe, expect, it } from 'vitest';
import { operationalAi } from '../../src/sim/ai/operational';
import { NATIONS_1938, SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { destroyFormation } from '../../src/sim/systems/elements';
import { marchingToPort, transportPorts, transportRoom } from '../../src/sim/systems/amphibious';
import { orderMove } from '../../src/sim/systems/movement';
import { declareWar } from '../../src/sim/systems/war';
import { portSeaOf } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';

// PLAN 7.56a (ADR-596): the invasion AI sends a formation to the port where its nation's transports
// stand (`sendToPort`), and the operational AI took it back on the way for a sector of the fronts
// (seed 1129 year 20: Britain's division sent to Adana, 18 days off, re-ordered after 5 for
// Germany's front, an ally's; the next one sent the same, every week). Germany in 1938 at war with
// Poland, its transports at Kiel, its division nearest the front
// ordered to that port: the operational AI, run by hand every 6 hours for 4 days, leaves the march.

const { w: W } = SIZE_1938;
const id = (tag: string): number => NATIONS_1938.findIndex((n) => n.tag === tag) + 1;
const GER = id('GER');
const POL = id('POL');

describe("the landing's march is the invasion AI's (PLAN 7.56a)", () => {
  it('a division on the march to its transports’ port is not re-ordered to the front', () => {
    const s = new Sim({ scenario: '1938', seed: 4601, assets: assets1938(W) });
    const w = s.world;
    s.command({ kind: 'setSetting', key: 'aiEnabled', value: false });
    s.step(1);
    const c = w.formations.cols;
    const ctl = w.cells.controller;
    const water = portSeaOf(w);
    expect(declareWar(w, GER, POL, true)).not.toBeNull();
    const cellOf = (f: number): number => Math.floor(c.y[f]!) * W + Math.floor(c.x[f]!);
    const dist = (a: number, b: number): number => Math.max(Math.abs((a % W) - (b % W)), Math.abs(Math.floor(a / W) - Math.floor(b / W)));
    // Germany's front with Poland.
    const front: number[] = [];
    for (let k = 0; k < ctl.length; k++) {
      if (ctl[k] !== GER) continue;
      if ([k - 1, k + 1, k - W, k + W].some((q) => q >= 0 && q < ctl.length && ctl[q] === POL)) front.push(k);
    }
    expect(front.length).toBeGreaterThan(0);
    const toFront = (k: number): number => Math.min(...front.map((q) => dist(k, q)));
    // Kiel, its transports there: of the Reich's ports the nearest the front (32 cells; Königsberg,
    // 8, is in East Prussia, beyond the Polish corridor).
    const pi = w.ports.findIndex((p) => p.name === 'Kiel');
    expect(pi).toBeGreaterThanOrEqual(0);
    expect(ctl[w.ports[pi]!.cell]).toBe(GER);
    expect(water[pi]).toBeGreaterThanOrEqual(0);
    expect(toFront(w.ports[pi]!.cell)).toBeLessThan(60);
    const port = w.ports[pi]!;
    const sea = water[pi]!;
    const groups: number[] = [];
    w.formations.forEach((f) => {
      if (w.isFleet(f) && c.nation[f] === GER) groups.push(f);
    });
    const tp = groups.find((f) => transportRoom(w, f) > 0);
    expect(tp).toBeDefined();
    [c.x[tp!], c.y[tp!]] = [(sea % W) + 0.5, Math.floor(sea / W) + 0.5];
    c.moving[tp!] = 0;
    for (const f of groups) if (f !== tp) destroyFormation(w, f);
    expect(transportPorts(w, [tp!])).toEqual([port.cell]);
    // Its division nearest the front 15 to 40 cells from the port (in the Reich), ordered there.
    let div = -1;
    w.formations.forEach((f) => {
      if (c.nation[f] !== GER || w.offLand(f) || dist(cellOf(f), port.cell) < 15 || dist(cellOf(f), port.cell) > 40) return;
      if (div < 0 || toFront(cellOf(f)) < toFront(cellOf(div))) div = f;
    });
    expect(div).toBeGreaterThan(0);
    const [px, py] = w.cellPoint(port.cell);
    expect(orderMove(w, div, px, py)).toBe(true);
    const target = c.targetCell[div]!;
    expect(w.paths.get(div)!.every((k) => ctl[k] === GER)).toBe(true);
    expect(marchingToPort(w, div, [port.cell])).toBe(true);
    // Four days of the operational AI, every 6 hours; the march goes on.
    for (let t = 0; t < 96; t++) {
      w.settings.aiEnabled = true;
      operationalAi(w);
      w.settings.aiEnabled = false;
      s.step(1);
      if (c.moving[div] !== 1) break;
      expect(c.targetCell[div]).toBe(target);
    }
    // Still on the march there, or at the port.
    expect((c.moving[div] === 1 && c.targetCell[div] === target) || dist(cellOf(div), port.cell) <= 3).toBe(true);
  });
});
