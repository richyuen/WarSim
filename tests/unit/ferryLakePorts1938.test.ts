import { describe, expect, it } from 'vitest';
import { invasionAi } from '../../src/sim/ai/invasion';
import { STAGGER } from '../../src/sim/ai/strategic';
import { EventKind, RejectReason } from '../../src/shared/events';
import { NATIONS_1938, SIZE_1938, TEMPLATES_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { destroyFormation } from '../../src/sim/systems/elements';
import { transportRoom } from '../../src/sim/systems/amphibious';
import { declareWar } from '../../src/sim/systems/war';
import { basinOf, navOf, portSeaOf, seaOf } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';

// PLAN 7.155 (ADR-752): the transports sail to their army's land only for a port in the waters they
// sail. On 1415 year 1 Canada's transports at Iqaluit, its army in Ontario, asked every day for the
// four ports nearest the army, Toronto, Hamilton, Sault Ste. Marie and Detroit, all on the Great Lakes
// (no lane joins them to the sea): each refused for no sea way, and no port on the sea was tried.
// Canada in 1938 at war with Portugal (no land front), its one transport group at Iqaluit's water
// (Baffin Island), its land army only the formations within 12 cells of Toronto. The other AIs off,
// the invasion AI run by hand on Canada's planning days.

const { w: W } = SIZE_1938;
const id = (tag: string): number => NATIONS_1938.findIndex((n) => n.tag === tag) + 1;
const CAN = id('CAN');
const POR = id('POR');

describe('the transports sail for no port on a lake (PLAN 7.155)', () => {
  it("Canada's transports at Iqaluit, its army at Toronto: no sail refused for no sea way, and they sail for a port on the sea", () => {
    const s = new Sim({ scenario: '1938', seed: 4601, assets: assets1938(W) });
    const w = s.world;
    s.command({ kind: 'setSetting', key: 'aiEnabled', value: false });
    s.step(1);
    const c = w.formations.cols;
    const water = portSeaOf(w);
    const zone = seaOf(w).zoneOf;
    const { basin, ocean } = basinOf(w);
    const comp = navOf(w).grid.component;
    const port = (name: string): number => w.ports.findIndex((p) => p.name === name);
    const iq = port('Iqaluit');
    const to = port('Toronto');
    expect(iq).toBeGreaterThanOrEqual(0);
    expect(to).toBeGreaterThanOrEqual(0);
    expect(w.cells.controller[w.ports[iq]!.cell]).toBe(CAN);
    // The case: Toronto's water is a lake's, Iqaluit's the sea's.
    expect(basin[zone[water[to]!]!]).not.toBe(ocean);
    expect(basin[zone[water[iq]!]!]).toBe(ocean);
    expect(declareWar(w, CAN, POR, true)).not.toBeNull();
    for (const [wing] of [...w.wingBase]) if ([CAN, POR].includes(c.nation[wing]!)) destroyFormation(w, wing);
    // One Canadian transport group (Canada has none in 1938), spawned at Iqaluit's water.
    const sea = water[iq]!;
    const before = new Set<number>();
    w.formations.forEach((f) => void before.add(f));
    s.command({ kind: 'spawnFleet', nation: CAN, x: (sea % W) + 0.5, y: Math.floor(sea / W) + 0.5, template: TEMPLATES_1938.findIndex((t) => t.id === 'transport_group') });
    s.step(1);
    const groups: number[] = [];
    w.formations.forEach((f) => {
      if (w.isFleet(f) && c.nation[f] === CAN && transportRoom(w, f) > 0) groups.push(f);
    });
    expect(groups.length).toBe(1);
    const tp = groups[0]!;
    expect(before.has(tp)).toBe(false);
    c.moving[tp] = 0;
    // Canada's land army: only the formations within 12 cells of Toronto.
    const cellOf = (f: number): number => Math.floor(c.y[f]!) * W + Math.floor(c.x[f]!);
    const near = (a: number, b: number, r: number): boolean => Math.abs((a % W) - (b % W)) <= r && Math.abs(Math.floor(a / W) - Math.floor(b / W)) <= r;
    const land: number[] = [];
    w.formations.forEach((f) => {
      if (c.nation[f] === CAN && !w.isFleet(f) && !w.isWing(f)) land.push(f);
    });
    const kept = land.filter((f) => near(cellOf(f), w.ports[to]!.cell, 12));
    expect(kept.length).toBeGreaterThan(0);
    for (const f of land) if (!kept.includes(f)) destroyFormation(w, f);
    // Over 30 days of Canada's planning: no sail of its refused for no sea way, and the group under
    // way for a Canadian port on the army's land whose water is the sea's.
    let refused = 0;
    let sailedFor = -1;
    s.step(24 - (w.tick % 24));
    for (let d = 0; d < 30; d++) {
      w.out.events.length = 0;
      if ((w.tick / 24 + CAN) % STAGGER === 0) {
        w.settings.aiEnabled = true;
        invasionAi(w);
        w.settings.aiEnabled = false;
      }
      const ev = w.out.events;
      for (let i = 0; i < ev.length; i += 6) if (ev[i + 1] === EventKind.MoveRejected && ev[i + 4] === RejectReason.NoSeaWay && c.nation[ev[i + 2]!] === CAN) refused++;
      if (sailedFor < 0 && c.moving[tp] === 1) {
        const p = w.paths.get(tp);
        if (p) sailedFor = p[p.length - 1]!;
      }
      s.step(24);
    }
    expect(refused).toBe(0);
    expect(sailedFor).toBeGreaterThanOrEqual(0);
    expect(basin[zone[sailedFor]!]).toBe(ocean);
    const at = w.ports.findIndex((p, k) => water[k] === sailedFor && w.cells.controller[p.cell] === CAN);
    expect(at).toBeGreaterThanOrEqual(0);
    expect(comp[w.ports[at]!.cell]).toBe(comp[w.ports[to]!.cell]);
  });
});
