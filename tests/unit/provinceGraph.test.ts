import { describe, expect, it } from 'vitest';
import { encodeRuns } from '../../src/shared/mapImport';
import { Terrain } from '../../src/shared/terrain';
import { Mobility, type Passage } from '../../src/sim/nav/grid';
import { findRoute, mayReach, nodeGroups } from '../../src/sim/nav/provinceGraph';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { orderMove, passageOf } from '../../src/sim/systems/movement';
import { navOf, type World } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';
import { addDivision, nationId } from '../helpers/sim1938';

// PLAN 3.7j (ADR-170): a walkable cell that no province has is a node of the province graph, so
// the groups of provinces with open ground (`Passage.group`) are joined wherever cells are.

const W = SIZE_1938.w;
const at = (x: number, y: number): number => y * W + x;
const world1938 = (): World => new Sim({ scenario: '1938', seed: 99, assets: assets1938(W) }).world;

/** A passage with every holder open. */
function allOpen(world: World): Passage {
  const graph = navOf(world).graph;
  const open = new Uint8Array(graph.nodeCount).fill(1);
  return { ok: new Uint8Array(world.nations.highWater + 1).fill(1), holder: world.cells.controller, open, group: nodeGroups(graph, open) };
}

describe('a land cell with no province joins the provinces about it (PLAN 3.7j)', () => {
  it('a Japanese division is ordered from Honshu to Kyushu over the forest cell that no province has, and back', () => {
    const world = world1938();
    const JAP = nationId('JAP');
    const { grid, graph } = navOf(world);
    const [from, between, to] = [at(1769, 395), at(1768, 396), at(1766, 397)];
    // The ground of the case: both ends Japan's, on one landmass, and the cell between them of no province.
    expect([world.cells.controller[from], world.cells.controller[to]]).toEqual([JAP, JAP]);
    expect(grid.component[from]).toBe(grid.component[to]);
    expect(world.cells.province[between]).toBe(0);
    expect(grid.component[between]).toBe(grid.component[from]);
    const pass = passageOf(world, JAP);
    expect(mayReach(grid, graph, from, to, pass)).toBe(true);
    expect(mayReach(grid, graph, to, from, pass)).toBe(true);
    const there = addDivision(world, JAP, 1769.5, 395.5);
    expect(orderMove(world, there, 1766.5, 397.5)).toBe(true);
    const back = addDivision(world, JAP, 1766.5, 397.5);
    expect(orderMove(world, back, 1769.5, 395.5)).toBe(true);
  });

  it('on the 1938 map every walkable cell has a node, and with every holder open no landmass falls into two groups', () => {
    const world = world1938();
    const { grid, graph } = navOf(world);
    const group = allOpen(world).group!;
    const groupOf = new Map<number, number>();
    const split = new Set<number>();
    let noNode = 0;
    for (let c = 0; c < grid.component.length; c++) {
      const land = grid.component[c]!;
      if (land === 0) continue;
      const node = graph.nodeOf[c]!;
      if (node === 0) {
        noNode++;
        continue;
      }
      const g = group[node]!;
      if (!groupOf.has(land)) groupOf.set(land, g);
      else if (groupOf.get(land) !== g) split.add(land);
    }
    expect(noNode).toBe(0);
    expect([...split]).toEqual([]);
  });

  it('land that a map import puts between two landmasses joins their provinces', () => {
    const sim = new Sim({ scenario: '1938', seed: 99, assets: assets1938(W) });
    const world = sim.world;
    const { terrain, province } = world.cells;
    const before = navOf(world);
    // The first water cell with land of a province on its left and on its right, of two landmasses.
    let c = 1;
    for (; c < terrain.length - 1; c++) {
      const [l, r] = [before.grid.component[c - 1]!, before.grid.component[c + 1]!];
      if (terrain[c] === Terrain.Water && c % W !== 0 && c % W !== W - 1 && l !== 0 && r !== 0 && l !== r && province[c - 1] !== 0 && province[c + 1] !== 0) break;
    }
    expect(c).toBeLessThan(terrain.length - 1);
    expect(findRoute(before.grid, before.graph, Mobility.foot, c - 1, c + 1, allOpen(world))).toBeNull();
    const values = Uint16Array.from(terrain);
    values[c] = Terrain.Plains;
    sim.command({ kind: 'importLayer', layer: 'terrain', runs: encodeRuns(values) });
    sim.applyNow();
    expect(world.cells.terrain[c]).toBe(Terrain.Plains);
    expect(world.cells.province[c]).toBe(0);
    const { grid, graph } = navOf(world);
    const pass = allOpen(world);
    expect(graph.nodeOf[c]).not.toBe(0);
    expect(pass.group![graph.nodeOf[c - 1]!]).toBe(pass.group![graph.nodeOf[c + 1]!]);
    expect(mayReach(grid, graph, c - 1, c + 1, pass)).toBe(true);
    expect(findRoute(grid, graph, Mobility.foot, c - 1, c + 1, pass)?.cells).toEqual([c - 1, c, c + 1]);
  });

  it('a long route whose only way is over land of no province is found in its corridor', () => {
    const world = world1938();
    const { grid, graph } = navOf(world);
    // The reader's pair on Japan's landmass: 120 cells apart by the way, more than 500 km.
    const [from, to] = [at(1831, 319), at(1766, 397)];
    expect(grid.component[from]).toBe(grid.component[to]);
    expect(findRoute(grid, graph, Mobility.foot, from, to, allOpen(world))).not.toBeNull();
    expect(findRoute(grid, graph, Mobility.foot, from, to, passageOf(world, nationId('JAP')))).not.toBeNull();
  });
});
