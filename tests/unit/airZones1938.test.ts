import { describe, expect, it } from 'vitest';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { AIR_ZONE_KM2, buildAirZones, ISLAND_SHARE } from '../../src/sim/nav/airZones';
import { airOf, navOf, seaOf } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';

// PLAN 5.1a: the map in air zones, the sea zones over water and regions of whole province-graph
// nodes of about AIR_ZONE_KM2 over land; an island under a third of that joins the nearest zone.

describe('air zones (PLAN 5.1a)', () => {
  const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(SIZE_1938.w) });
  const w = s.world;
  const a = airOf(w);
  const { grid, graph } = navOf(w);
  const sea = seaOf(w);

  it('every cell of a province-graph node or a sea zone is in one, and no other; the sea\'s are the sea zones', () => {
    let wrong = 0;
    for (let c = 0; c < a.zoneOf.length; c++) {
      const node = graph.nodeOf[c]!;
      const want = node !== 0 ? a.zoneOfNode[node]! : sea.zoneOf[c] !== 0 ? a.land + sea.zoneOf[c]! : 0;
      if (a.zoneOf[c] !== want || (node !== 0 && want === 0) || (want > a.land) !== (node === 0 && sea.zoneOf[c] !== 0)) wrong++;
    }
    expect(wrong).toBe(0);
    expect(a.count).toBe(a.land + sea.count);
    expect(a.land).toBeGreaterThan(40);
  });

  it('a land zone is of about the target area: within a quarter and three times it, beyond a node over the target', () => {
    // A zone is whole nodes, and since PLAN 7.36b (ADR-560) a province of Siberia, Canada or
    // Australia is several times the target alone: its zone may be three times the target beyond it.
    const area = new Float64Array(graph.nodeCount + 1);
    for (let c = 0; c < graph.nodeOf.length; c++) if (graph.nodeOf[c] !== 0) area[graph.nodeOf[c]!]! += grid.kx[Math.floor(c / grid.w)]! * grid.ky[Math.floor(c / grid.w)]!;
    const biggest = new Float64Array(a.land + 1);
    for (let k = 1; k <= graph.nodeCount; k++) if (a.zoneOfNode[k]! <= a.land) biggest[a.zoneOfNode[k]!] = Math.max(biggest[a.zoneOfNode[k]!]!, area[k]!);
    const out: string[] = [];
    for (let z = 1; z <= a.land; z++) {
      const over = biggest[z]! > AIR_ZONE_KM2 ? biggest[z]! : 0;
      if (a.areaKm2[z]! < AIR_ZONE_KM2 / 4 || a.areaKm2[z]! > 3 * AIR_ZONE_KM2 + over) out.push(`${z}: ${Math.round(a.areaKm2[z]! / 1000)}k km²`);
    }
    expect(out).toEqual([]);
  });

  it('a land zone is in one piece over the graph, but for the islands under a third of the target it took in', () => {
    // The nodes of each zone on its seed's land component are joined by nodes of the zone.
    const area = new Float64Array(graph.nodeCount + 1);
    for (let c = 0; c < graph.nodeOf.length; c++) if (graph.nodeOf[c] !== 0) area[graph.nodeOf[c]!]! += grid.kx[Math.floor(c / grid.w)]! * grid.ky[Math.floor(c / grid.w)]!;
    const comp = new Int32Array(graph.nodeCount + 1).fill(-1);
    const compArea: number[] = [];
    for (let k = 1; k <= graph.nodeCount; k++) {
      if (comp[k] !== -1 || area[k] === 0) continue;
      const id = compArea.length;
      let sum = 0;
      const st = [k];
      comp[k] = id;
      while (st.length) {
        const x = st.pop()!;
        sum += area[x]!;
        for (const y of graph.adj[x] ?? []) {
          if (comp[y] !== -1 || area[y] === 0) continue;
          comp[y] = id;
          st.push(y);
        }
      }
      compArea.push(sum);
    }
    const broken: number[] = [];
    for (let z = 1; z <= a.land; z++) {
      const seed = graph.nodeOf[a.seedCell[z]!]!;
      const seen = new Set([seed]);
      const st = [seed];
      while (st.length) {
        const x = st.pop()!;
        for (const y of graph.adj[x] ?? []) {
          if (seen.has(y) || a.zoneOfNode[y] !== z) continue;
          seen.add(y);
          st.push(y);
        }
      }
      for (let k = 1; k <= graph.nodeCount; k++) {
        if (a.zoneOfNode[k] !== z || seen.has(k)) continue;
        // Not joined to the seed: only an island under ISLAND_SHARE of the target may be.
        if (compArea[comp[k]!]! >= ISLAND_SHARE * AIR_ZONE_KM2) broken.push(z);
      }
    }
    expect([...new Set(broken)]).toEqual([]);
  });

  it('the same zones from the same map: built again, cell for cell', () => {
    const b = buildAirZones(grid, graph, sea);
    expect(b.count).toBe(a.count);
    let diff = 0;
    for (let c = 0; c < a.zoneOf.length; c++) if (a.zoneOf[c] !== b.zoneOf[c]) diff++;
    expect(diff).toBe(0);
  });
});
