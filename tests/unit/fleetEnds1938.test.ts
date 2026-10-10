import { describe, expect, it } from 'vitest';
import { encodeRuns } from '../../src/shared/mapImport';
import { isLand, Terrain } from '../../src/shared/terrain';
import { cellOf } from '../../src/sim/data/terrain';
import { NATIONS_1938, PORTS_1938, SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { sailStepKm, seaNeighbours } from '../../src/sim/nav/sailRoute';
import { passageBank, passageShut, seaLinked } from '../../src/sim/systems/seaSupply';
import { declareWar } from '../../src/sim/systems/war';
import { laneOf, navOf, portSeaOf, type World } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';

// PLAN 4.4e: a fleet's loose ends. AT: a fleet at a base taken by an enemy sails for another of
// its nation's ports; a fleet is refused a passage whose bank an enemy holds. And a fleet in a
// canal's step is not removed by a map import.

const { w: W } = SIZE_1938;
const id = (tag: string): number => NATIONS_1938.findIndex((n) => n.tag === tag) + 1;
const GER = id('GER');
const ENG = id('ENG');
const sim = (): Sim => {
  const s = new Sim({ scenario: '1938', seed: 4405, assets: assets1938(W) });
  s.world.settings.aiEnabled = false;
  return s;
};
const portIndex = (w: World, name: string): number => w.ports.findIndex((p) => p.def >= 0 && PORTS_1938.ports[p.def]!.name === name);
const cellAt = (w: World, f: number): number => Math.floor(w.formations.cols.y[f]!) * W + Math.floor(w.formations.cols.x[f]!);
/** The fleets of `nation` within 3 cells of cell `at`. */
const fleetsNear = (w: World, nation: number, at: number): number[] => {
  const out: number[] = [];
  w.formations.forEach((f) => {
    const c = cellAt(w, f);
    if (w.afloat(f) && w.formations.cols.nation[f] === nation && Math.abs((c % W) - (at % W)) <= 3 && Math.abs(Math.floor(c / W) - Math.floor(at / W)) <= 3) out.push(f);
  });
  return out;
};
const suez = (w: World): number => w.seaPassages.findIndex((p) => p.id === 'suez');

describe('a fleet\'s loose ends (PLAN 4.4e)', () => {
  it('the AT: the fleets at Gibraltar, taken by Germany at war with the United Kingdom, sail at the next day\'s start for another British port', () => {
    const s = sim();
    const w = s.world;
    expect(declareWar(w, GER, ENG, true)).not.toBeNull();
    const gib = portIndex(w, 'Gibraltar');
    const water = portSeaOf(w)[gib]!;
    const fleets = fleetsNear(w, ENG, water);
    expect(fleets.length).toBeGreaterThan(0);
    s.step(1); // the first day's start: Gibraltar is still British, they stand
    for (const f of fleets) expect(w.formations.cols.moving[f]).toBe(0);
    w.setController(w.ports[gib]!.cell, GER);
    s.step(24);
    const targets = new Set<number>();
    for (const f of fleets) {
      expect(w.formations.cols.moving[f], `fleet ${f}`).toBe(1);
      targets.add(w.formations.cols.targetCell[f]!);
    }
    // To the water of a port the United Kingdom holds, not Gibraltar's.
    for (const t of targets) {
      expect(t).not.toBe(water);
      expect(w.ports.some((p, i) => portSeaOf(w)[i] === t && w.cells.controller[p.cell] === ENG)).toBe(true);
    }
  });

  it('a base taken by a nation at peace with the fleet\'s, or a fleet with a port of its own beside it, stays', () => {
    const s = sim();
    const w = s.world;
    const gib = portIndex(w, 'Gibraltar');
    const fleets = fleetsNear(w, ENG, portSeaOf(w)[gib]!);
    w.setController(w.ports[gib]!.cell, GER); // at peace
    s.step(25);
    for (const f of fleets) expect(w.formations.cols.moving[f]).toBe(0);
  });

  it('the AT: the Suez canal is shut to a British fleet when Germany, at war with it, holds its bank: the way to the Gulf of Suez goes round Africa', () => {
    const s = sim();
    const w = s.world;
    const i = suez(w);
    expect(i).toBeGreaterThanOrEqual(0);
    const bank = passageBank(w, i);
    expect(isLand(w.cells.terrain[bank]!)).toBe(true);
    const gib = portIndex(w, 'Gibraltar');
    const fleet = fleetsNear(w, ENG, portSeaOf(w)[gib]!)[0]!;
    const lanes = laneOf(w);
    const edge = lanes.edges.find((e) => e.passage === i)!;
    const south = edge.cells[edge.landAt]!;
    const order = (): void => {
      w.formations.cols.moving[fleet] = 0;
      w.paths.delete(fleet);
      s.command({ kind: 'moveFormation', id: fleet, x: (south % W) + 0.5, y: Math.floor(south / W) + 0.5 });
      s.applyNow();
    };
    const jumps = (): number => {
      const p = w.paths.get(fleet)!;
      let n = 0;
      for (let k = 1; k < p.length; k++) if (!seaNeighbours(navOf(w).grid, p[k - 1]!, p[k]!)) n++;
      return n;
    };
    const km = (): number => {
      const p = w.paths.get(fleet)!;
      let sum = 0;
      for (let k = 1; k < p.length; k++) sum += sailStepKm(navOf(w).grid, p[k - 1]!, p[k]!);
      return sum;
    };
    order();
    expect(jumps()).toBe(1);
    const through = km();
    // Germany at war with the United Kingdom holds the bank.
    expect(declareWar(w, GER, ENG, true)).not.toBeNull();
    w.setController(bank, GER);
    expect(passageShut(w, i, ENG)).toBe(true);
    expect(passageShut(w, i, id('FRA'))).toBe(false);
    order();
    expect(w.formations.cols.moving[fleet]).toBe(1);
    expect(jumps()).toBe(0);
    expect(km()).toBeGreaterThan(2 * through);
    process.stderr.write(`Gibraltar to the Gulf of Suez: ${through.toFixed(0)} km through the canal, ${km().toFixed(0)} km round the Cape with its bank held\n`);
  });

  it('a passage shut to a bloc is no way of its supply by sea', () => {
    const s = sim();
    const w = s.world;
    s.step(1);
    expect(declareWar(w, GER, ENG, true)).not.toBeNull();
    const before = seaLinked(w, ENG);
    for (let i = 0; i < w.seaPassages.length; i++) {
      const bank = passageBank(w, i);
      if (bank >= 0) w.setController(bank, GER);
    }
    // Every passage shut: no land is joined by a way that only a passage made.
    const after = seaLinked(w, ENG);
    for (const c of after) expect(before).toContain(c);
    for (let i = 0; i < w.seaPassages.length; i++) expect(passageShut(w, i, ENG), w.seaPassages[i]!.id).toBe(passageBank(w, i) >= 0);
  });

  it('a fleet in the canal\'s step is not removed by a map import', () => {
    const s = sim();
    const w = s.world;
    const gib = portIndex(w, 'Gibraltar');
    const fleet = fleetsNear(w, ENG, portSeaOf(w)[gib]!)[0]!;
    const lanes = laneOf(w);
    const edge = lanes.edges.find((e) => e.passage === suez(w))!;
    const south = edge.cells[edge.landAt]!;
    s.command({ kind: 'moveFormation', id: fleet, x: (south % W) + 0.5, y: Math.floor(south / W) + 0.5 });
    s.applyNow();
    const path = w.paths.get(fleet)!;
    // Sail until it is in the canal's step, on its land.
    let hours = 0;
    while (hours < 400) {
      s.step(1);
      hours++;
      const at = w.formations.cols.pathStep[fleet]!;
      if (at < path.length - 1 && !seaNeighbours(navOf(w).grid, path[at]!, path[at + 1]!) && w.formations.cols.stepFrac[fleet]! > 0 && isLand(w.cells.terrain[cellAt(w, fleet)]!)) break;
    }
    expect(isLand(w.cells.terrain[cellAt(w, fleet)]!)).toBe(true);
    // An import that changes one land cell far off (an import that changes nothing does nothing).
    const values = Uint16Array.from(w.cells.terrain);
    const far = cellOf(100, 60, W, SIZE_1938.h).map(Math.floor).reduce((x, y) => y * W + x);
    expect(isLand(values[far]!)).toBe(true);
    values[far] = values[far] === Terrain.Forest ? Terrain.Plains : Terrain.Forest;
    s.command({ kind: 'importLayer', layer: 'terrain', runs: encodeRuns(values) });
    const before = w.edits.undo.length;
    s.applyNow();
    expect(w.edits.undo.length).toBeGreaterThan(before);
    expect(w.formations.has(fleet)).toBe(true);
    // It goes on, through.
    s.step(12);
    expect(w.formations.has(fleet)).toBe(true);
    expect(isLand(w.cells.terrain[cellAt(w, fleet)]!)).toBe(false);
    process.stderr.write(`in the canal at hour ${hours}; kept by the import\n`);
  });
});
