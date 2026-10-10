import { describe, expect, it } from 'vitest';
import { EventKind } from '../../src/shared/events';
import { cellOf } from '../../src/sim/data/terrain';
import { NATIONS_1938, PORTS_1938, SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { seaControlOf } from '../../src/sim/systems/seaControl';
import { declareWar } from '../../src/sim/systems/war';
import { navOf, seaOf, type World } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';
import { addDivision, runEvents } from '../helpers/sim1938';

// PLAN 4.5b: the sea a landing needs. AT (PLAN 4.5's): a scripted invasion lands and takes the
// coastal cells; it fails without sea control. Two British divisions at Portsmouth, at war
// with Belgium, are ordered to Ostend.

const { w: W, h: H } = SIZE_1938;
const id = (tag: string): number => NATIONS_1938.findIndex((n) => n.tag === tag) + 1;
const ENG = id('ENG');
const BEL = id('BEL');
const sim = (): Sim => {
  const s = new Sim({ scenario: '1938', seed: 4502, assets: assets1938(W) });
  s.world.settings.aiEnabled = false;
  return s;
};
const portCell = (w: World, name: string): number => w.ports.find((p) => p.def >= 0 && PORTS_1938.ports[p.def]!.name === name)!.cell;
const [CX, CY] = cellOf(2.92, 51.22, W, H).map((v) => Math.floor(v) + 0.5) as [number, number];
const comp = (w: World, x: number, y: number): number => navOf(w).grid.component[Math.floor(y) * W + Math.floor(x)]!;
/** Cells within `r` of Ostend that `nation` controls. */
const heldNear = (w: World, nation: number, r: number): number => {
  let n = 0;
  for (let y = Math.floor(CY) - r; y <= Math.floor(CY) + r; y++) for (let x = Math.floor(CX) - r; x <= Math.floor(CX) + r; x++) if (w.cells.controller[y * W + x] === nation && comp(w, x, y) === comp(w, CX, CY)) n++;
  return n;
};

/** At war with Belgium after the first day's sea control, two divisions at Portsmouth (one a transport group) ordered to Ostend: their ids. */
function invade(s: Sim, beforeOrder?: (w: World) => void): number[] {
  const w = s.world;
  expect(declareWar(w, ENG, BEL, true)).not.toBeNull();
  s.step(1);
  beforeOrder?.(w);
  const [px, py] = w.cellPoint(portCell(w, 'Portsmouth'));
  const divs = [0, 1].map(() => addDivision(w, ENG, px, py));
  for (const d of divs) s.command({ kind: 'moveFormation', id: d, x: CX, y: CY });
  s.applyNow();
  for (const d of divs) expect(w.embarked.has(d)).toBe(true);
  return divs;
}

describe('the sea a landing needs (PLAN 4.5b)', () => {
  it('the AT: the invasion lands, takes its beachheads, and the front spreads from them', () => {
    const s = sim();
    const w = s.world;
    expect(heldNear(w, ENG, 8)).toBe(0);
    const divs = invade(s);
    const landed = new Set<number>();
    for (let h = 0; h < 48 && landed.size < divs.length; h++) for (const e of runEvents(s, 1)) if (e[1] === EventKind.FormationLanded) landed.add(e[2]!);
    expect(landed.size).toBe(2);
    for (const d of divs) {
      const cell = Math.floor(w.formations.cols.y[d]!) * W + Math.floor(w.formations.cols.x[d]!);
      expect(comp(w, w.formations.cols.x[d]!, w.formations.cols.y[d]!)).toBe(comp(w, CX, CY));
      void cell;
    }
    const beach = heldNear(w, ENG, 8);
    expect(beach).toBeGreaterThan(0);
    s.step(10 * 24);
    const after = heldNear(w, ENG, 8);
    expect(after).toBeGreaterThan(beach);
    process.stderr.write(`Ostend: ${beach} British cells within 8 at the landing, ${after} ten days later\n`);
  });

  it('with the sea about Ostend held by Belgium the landing is thrown back: home with the transports, nothing taken', () => {
    const s = sim();
    const w = s.world;
    const divs = invade(s, (world) => {
      const sc = seaControlOf(world);
      // Belgium holds every zone within 8 cells of Ostend until the next day's sea control.
      const z = seaOf(world);
      for (let y = Math.floor(CY) - 8; y <= Math.floor(CY) + 8; y++) for (let x = Math.floor(CX) - 8; x <= Math.floor(CX) + 8; x++) if (z.zoneOf[y * W + x]! > 0) sc.holder[z.zoneOf[y * W + x]!] = BEL;
    });
    const repulsed = new Set<number>();
    for (let h = 0; h < 22; h++) for (const e of runEvents(s, 1)) if (e[1] === EventKind.LandingRepulsed) repulsed.add(e[2]!);
    expect(repulsed.size).toBe(2);
    expect(heldNear(w, ENG, 8)).toBe(0);
    // Ashore again in Britain when the transports stand at a British port.
    s.step(3 * 24);
    const home = comp(w, ...w.cellPoint(portCell(w, 'Portsmouth')));
    for (const d of divs) {
      expect(w.formations.has(d)).toBe(true);
      expect(w.embarked.has(d)).toBe(false);
      expect(comp(w, w.formations.cols.x[d]!, w.formations.cols.y[d]!)).toBe(home);
    }
    expect(heldNear(w, ENG, 8)).toBe(0);
  });

  it('at peace a landing takes no cell', () => {
    const s = sim();
    const w = s.world;
    s.step(1);
    const [px, py] = w.cellPoint(portCell(w, 'Portsmouth'));
    const d = addDivision(w, ENG, px, py);
    s.command({ kind: 'moveFormation', id: d, x: CX, y: CY });
    s.applyNow();
    expect(w.embarked.has(d)).toBe(true);
    s.step(24);
    expect(w.embarked.has(d)).toBe(false);
    expect(heldNear(w, ENG, 8)).toBe(0);
  });
});
