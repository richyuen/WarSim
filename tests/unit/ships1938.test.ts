import { describe, expect, it } from 'vitest';
import { EventKind } from '../../src/shared/events';
import { NATIONS_1938, PORTS_1938, RULES_1938, SIZE_1938, TEMPLATES_1938, ECONOMY_TABLES_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { elementIndex } from '../../src/sim/systems/elements';
import { dockPoint, queueFormation, shipyard } from '../../src/sim/systems/production';
import { laneOf, portSeaOf, seaOf, type World } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';

// PLAN 4.2e: ships are built. AT: a queued flotilla appears at a port's water after its days; a
// nation with no port is refused.

const { w: W } = SIZE_1938;
const id = (tag: string): number => NATIONS_1938.findIndex((n) => n.tag === tag) + 1;
const template = (t: string): number => TEMPLATES_1938.findIndex((x) => x.id === t);
const FLOTILLA = template('destroyer_flotilla');
const sim1938 = (): Sim => {
  const s = new Sim({ scenario: '1938', seed: 1938, assets: assets1938(W) });
  s.world.settings.aiEnabled = false;
  return s;
};
const portName = (w: World, i: number): string => (w.ports[i]!.def >= 0 ? PORTS_1938.ports[w.ports[i]!.def]!.name : w.ports[i]!.name);

/** Events of `kind` emitted while stepping `n` ticks. */
function stepCollect(sim: Sim, n: number, kind: number): number[][] {
  const out: number[][] = [];
  sim.step(n, (w) => {
    const ev = w.out.events;
    for (let i = 0; i < ev.length; i += 6) if (ev[i + 1] === kind) out.push(ev.slice(i, i + 6));
    w.out.events.length = 0;
  });
  return out;
}

describe('ships are built (PLAN 4.2e)', () => {
  it('the AT: a destroyer flotilla queued by the United Kingdom costs its gold and men at once and is at its shipyard\'s water after 180 days, with its eight destroyers', () => {
    const sim = sim1938();
    const twin = sim1938();
    const w = sim.world;
    const ENG = id('ENG');
    const rule = RULES_1938.templates[FLOTILLA]!;
    // The destroyer's own 180 days, not the land's three times them.
    expect(rule.days).toBe(180);
    const yard = shipyard(w, ENG);
    expect(yard).toBeGreaterThanOrEqual(0);
    const lanes = laneOf(w);
    const water = lanes.cell[lanes.portNode[yard]!]!;
    const formations = w.formations.count;
    sim.command({ kind: 'queueFormation', nation: ENG, template: FLOTILLA });
    expect(stepCollect(sim, 1, EventKind.ProductionQueued)).toHaveLength(1);
    twin.step(1);
    expect(twin.world.nations.cols.gold[ENG]! - w.nations.cols.gold[ENG]!).toBeCloseTo(rule.gold, 6);
    expect(twin.world.nations.cols.manpower[ENG]! - w.nations.cols.manpower[ENG]!).toBeCloseTo(rule.manpower, 6);

    expect(stepCollect(sim, rule.days * 24 - 1, EventKind.FormationSpawned)).toEqual([]);
    const spawned = stepCollect(sim, 1, EventKind.FormationSpawned);
    expect(spawned).toHaveLength(1);
    expect(spawned[0]![0]).toBe(rule.days * 24);
    expect(w.formations.count).toBe(formations + 1);
    const fid = spawned[0]![2]!;
    const fc = w.formations.cols;
    expect([fc.nation[fid], fc.template[fid]]).toEqual([ENG, FLOTILLA]);
    expect(w.afloat(fid)).toBe(true);
    expect(Math.floor(fc.y[fid]!) * W + Math.floor(fc.x[fid]!)).toBe(water);
    expect([fc.x[fid], fc.y[fid]]).toEqual(w.seaPoint(water));
    expect(fc.strength[fid]).toBe(ECONOMY_TABLES_1938.templateStrength[FLOTILLA]);
    expect(elementIndex(w).get(fid)?.length).toBe(8);
    // And it sails: an order to Gibraltar is taken.
    const gib = w.ports.find((p) => p.def >= 0 && PORTS_1938.ports[p.def]!.name === 'Gibraltar')!;
    w.out.events.length = 0;
    sim.command({ kind: 'moveFormation', id: fid, x: (gib.cell % W) + 0.5, y: Math.floor(gib.cell / W) + 0.5 });
    sim.step(1);
    expect(fc.moving[fid]).toBe(1);
    process.stderr.write(`the United Kingdom's shipyard: ${portName(w, yard)} (naval base ${w.ports[yard]!.navalBase}); a flotilla ${rule.gold} gold, ${rule.manpower} men, ${rule.days} days\n`);
  });

  it('a nation with no port a ship reaches is refused, and pays nothing', () => {
    const w = sim1938().world;
    const nc = w.nations.cols;
    const refused: string[] = [];
    for (const tag of ['SWI', 'HUN', 'AFG', 'BOL', 'PAR']) {
      const n = id(tag);
      expect(n, tag).toBeGreaterThan(0);
      if (nc.living[n] !== 1) continue;
      expect(shipyard(w, n), tag).toBe(-1);
      expect(dockPoint(w, n), tag).toBeNull();
      nc.gold[n] = 1e7;
      nc.manpower[n] = 1e7;
      w.out.events.length = 0;
      expect(queueFormation(w, n, FLOTILLA), tag).toBe(0);
      expect(w.out.events.filter((v, i) => i % 6 === 1 && v === EventKind.ProductionRejected), tag).toHaveLength(1);
      expect([nc.gold[n], nc.manpower[n]], tag).toEqual([1e7, 1e7]);
      // A land template it builds as before.
      expect(queueFormation(w, n, template('infantry_div')), tag).toBeGreaterThan(0);
      refused.push(tag);
    }
    expect(refused.length).toBeGreaterThanOrEqual(4);
  });

  it('the shipyard is the highest naval base the nation holds, then the nearest to its capital; every naval nation of 1938 has one on the seas', () => {
    const w = sim1938().world;
    const lanes = laneOf(w);
    const sea = seaOf(w);
    const yards: string[] = [];
    for (const tag of ['ENG', 'USA', 'JAP', 'FRA', 'ITA', 'GER', 'SOV']) {
      const n = id(tag);
      const yard = shipyard(w, n);
      expect(yard, tag).toBeGreaterThanOrEqual(0);
      const p = w.ports[yard]!;
      expect(w.cells.controller[p.cell], tag).toBe(n);
      // No port it holds has a higher naval base.
      w.ports.forEach((q, i) => {
        if (w.cells.controller[q.cell] === n && lanes.portNode[i]! >= 0 && sea.closed[sea.zoneOf[lanes.cell[lanes.portNode[i]!]!]!] === 0) expect(q.navalBase, `${tag}: ${portName(w, i)}`).toBeLessThanOrEqual(p.navalBase);
      });
      expect(p.navalBase, tag).toBe(3);
      yards.push(`${tag} ${portName(w, yard)}`);
    }
    // The ports' water by the zones alone (PLAN 4.2f) is the cell of each port's node of the lanes.
    expect([...portSeaOf(w)]).toEqual([...lanes.portNode].map((n) => (n < 0 ? -1 : lanes.cell[n]!)));
    // Norfolk and not Pearl Harbor or San Diego: the nearest of the three to Washington.
    expect(yards).toEqual(['ENG Portsmouth', 'USA Norfolk', 'JAP Yokosuka', 'FRA Brest', 'ITA La Spezia', 'GER Kiel', 'SOV Kronstadt']);
  });

  it('an order waits while the nation holds no port, and is delivered at the next it holds; a port in the ice is none', () => {
    const sim = sim1938();
    const w = sim.world;
    const POL = id('POL');
    const ctl = w.cells.controller;
    const lanes = laneOf(w);
    const own = w.ports.map((_, i) => i).filter((i) => ctl[w.ports[i]!.cell] === POL && lanes.portNode[i]! >= 0);
    expect(own.length).toBeGreaterThan(0);
    const nc = w.nations.cols;
    nc.gold[POL] = 1e7;
    nc.manpower[POL] = 1e7;
    const order = queueFormation(w, POL, template('submarine_flotilla'));
    expect(order).toBeGreaterThan(0);
    const ready = w.production.cols.readyDay[order]!;
    // Every Polish port taken by Germany before the day.
    const GER = id('GER');
    for (const i of own) ctl[w.ports[i]!.cell] = GER;
    expect(shipyard(w, POL)).toBe(-1);
    expect(stepCollect(sim, (ready + 3) * 24 - w.tick, EventKind.FormationSpawned)).toEqual([]);
    expect(w.production.has(order)).toBe(true);
    // One back: it is delivered there at the next day's start.
    const back = own[own.length - 1]!;
    ctl[w.ports[back]!.cell] = POL;
    expect(shipyard(w, POL)).toBe(back);
    const spawned = stepCollect(sim, 24, EventKind.FormationSpawned);
    expect(spawned).toHaveLength(1);
    const fid = spawned[0]![2]!;
    expect(Math.floor(w.formations.cols.y[fid]!) * W + Math.floor(w.formations.cols.x[fid]!)).toBe(lanes.cell[lanes.portNode[back]!]!);

    // A nation whose only port is in the ice has no shipyard: Tiksi given to Poland alone.
    const sea = seaOf(w);
    const iced = w.ports.findIndex((_, i) => lanes.portNode[i]! >= 0 && sea.closed[sea.zoneOf[lanes.cell[lanes.portNode[i]!]!]!] === 1);
    expect(iced).toBeGreaterThanOrEqual(0);
    ctl[w.ports[back]!.cell] = GER;
    ctl[w.ports[iced]!.cell] = POL;
    expect(shipyard(w, POL)).toBe(-1);
    expect(queueFormation(w, POL, FLOTILLA)).toBe(0);
  });

  it('every fleet template takes its slowest ship\'s days: a battle squadron 900 (two and a half years), a transport group 90', () => {
    const days = Object.fromEntries(['battle_squadron', 'carrier_group', 'cruiser_squadron', 'destroyer_flotilla', 'submarine_flotilla', 'transport_group'].map((t) => [t, RULES_1938.templates[template(t)]!.days]));
    expect(days).toEqual({ battle_squadron: 900, carrier_group: 800, cruiser_squadron: 400, destroyer_flotilla: 180, submarine_flotilla: 150, transport_group: 90 });
    // The land's are as they were.
    expect(RULES_1938.templates[template('infantry_div')]!.days).toBe(90);
    expect(RULES_1938.templates[template('panzer_div')]!.days).toBe(225);
  });
});
