import { describe, expect, it } from 'vitest';
import { RejectReason } from '../../src/shared/events';
import { cellOf } from '../../src/sim/data/terrain';
import { NATIONS_1938, PORTS_1938, SIZE_1938, TEMPLATES_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { tryLanding, transportsPort } from '../../src/sim/systems/amphibious';
import { bombIndustry, MAX_DAMAGE, PORT_SHUT, PORT_TONS, portShut, repairSystem } from '../../src/sim/systems/bombing';
import { shipyard } from '../../src/sim/systems/production';
import type { World } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';
import { addDivision } from '../helpers/sim1938';

// PLAN 5.5b: a bombed port is damaged by its level and repaired as industry is; damaged by a
// half or more, its transports embark no one and its yard delivers no fleet.

const { w: W, h: H } = SIZE_1938;
const id = (tag: string): number => NATIONS_1938.findIndex((n) => n.tag === tag) + 1;
const [ENG, FRA, SOV] = [id('ENG'), id('FRA'), id('SOV')];
const sim = (): Sim => {
  const s = new Sim({ scenario: '1938', seed: 4501, assets: assets1938(W) });
  s.world.settings.aiEnabled = false;
  return s;
};
const portIndex = (w: World, name: string): number => w.ports.findIndex((p) => p.def >= 0 && PORTS_1938.ports[p.def]!.name === name);
const calais = cellOf(1.86, 50.95, W, H).map((v) => Math.floor(v) + 0.5) as [number, number];
const bomber = (w: World, nation: number): number =>
  [...w.wingBase].find(([g, b]) => w.formations.cols.nation[g] === nation && b > 0 && TEMPLATES_1938[w.formations.cols.template[g]!]!.id === 'strategic_bomber_group')![0];
/** A British division at Portsmouth, and a French strategic bomber group, at war. */
function setup(): { s: Sim; w: World; div: number; port: number; wing: number } {
  const s = sim();
  const w = s.world;
  const port = portIndex(w, 'Portsmouth');
  const [x, y] = w.cellPoint(w.ports[port]!.cell);
  const div = addDivision(w, ENG, x, y);
  w.wars.start([FRA], [ENG], 0);
  return { s, w, div, port, wing: bomber(w, FRA) };
}

describe('ports bombed (PLAN 5.5b)', () => {
  it('a raid damages a port by its tons over PORT_TONS a level; a level-1 port is shut by one strategic group', () => {
    const { w, port, wing } = setup();
    const p = w.ports[port]!;
    const [x, y] = w.cellPoint(p.cell);
    bombIndustry(w, wing, x, y);
    expect(w.portDamage.get(port)).toBeCloseTo(Math.min(MAX_DAMAGE, 60 / (PORT_TONS * p.port)), 12);
    // Only Britain's ports are touched.
    for (const [k] of w.portDamage) expect(w.cells.controller[w.ports[k]!.cell]).toBe(ENG);
    // A wing of a nation at peace with Britain, the Soviet Union's, bombs no British port.
    const v = setup();
    bombIndustry(v.w, bomber(v.w, SOV), x, y);
    expect(v.w.portDamage.size).toBe(0);
  });

  it('shut, its transports embark no one: the division at Portsmouth is refused for want of a port; repaired under a half, it embarks', () => {
    const before = setup();
    expect(tryLanding(before.w, before.div, ...calais)).toBe(0);
    const { w, div, port } = setup();
    expect(transportsPort(w, div)).toBe(port);
    w.portDamage.set(port, PORT_SHUT);
    expect(portShut(w, port)).toBe(true);
    expect(transportsPort(w, div)).not.toBe(port);
    expect(tryLanding(w, div, ...calais)).toBe(RejectReason.NoPort);
    expect(w.embarked.has(div)).toBe(false);
    // A day's repair takes it under a half.
    w.tick = 24;
    repairSystem(w);
    expect(portShut(w, port)).toBe(false);
    expect(tryLanding(w, div, ...calais)).toBe(0);
  });

  it('shut, its yard delivers no fleet: Britain\'s yard moves to another port; saved, the same game', () => {
    const { s, w } = setup();
    const yard = shipyard(w, ENG);
    expect(yard).toBeGreaterThanOrEqual(0);
    w.portDamage.set(yard, 0.6);
    const other = shipyard(w, ENG);
    expect(other).toBeGreaterThanOrEqual(0);
    expect(other).not.toBe(yard);
    const u = sim();
    u.load(s.save());
    expect(u.hash()).toBe(s.hash());
    expect([...u.world.portDamage]).toEqual([[yard, 0.6]]);
  });
});
