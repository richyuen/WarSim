/**
 * Air zones (PLAN 5.1a, SPEC §6.3): the map in zones an hour's air war is reckoned by. Over water
 * they are the sea zones as they are (PLAN 4.1a); over land, regions of whole nodes of the
 * province graph (a province, a strait's body, a run of land no province has) of about
 * `AIR_ZONE_KM2` each.
 *
 * The land's regions: seeds on a lattice of `sqrt(AIR_ZONE_KM2)` km by the grid's km per cell,
 * each the node of the cell it falls on, on a land component (nodes joined by the graph's
 * neighbours) of at least `ISLAND_SHARE` of the target; such a component that no seed falls on is
 * seeded at its lowest node. Every node of those goes to the seed that reaches it first over the
 * graph, by the km between the nodes' centres (a search from all the seeds at once, ties by the
 * lower seed): each such region is joined by its own nodes. A smaller component (an island, a
 * cape cut off at the map's scale) goes whole to the zone of the seed nearest its lowest node by
 * straight km: the air does not ask for land between. A region under a quarter of the target
 * joins its neighbour of least area (ADR-560). Zones 1…`land` are the land's, in the order of
 * their seeds' cells; `land + s` is sea zone s. Derived, not saved, not hashed.
 */
import { sqrt } from '../core/dmath';
import { Heap, type NavGrid } from './grid';
import type { ProvinceGraph } from './provinceGraph';
import type { SeaZones } from './seaZones';

/**
 * The area a land air zone is meant to have, km² (PLAN 7.36b, ADR-560: 1.5 M before, `ZONE_KM2`,
 * the sea's still; London, Paris and Berlin were one zone 4,000 km across). A province over it is
 * a zone alone: a zone is whole nodes.
 */
export const AIR_ZONE_KM2 = 300_000;
/** A land component under this share of `AIR_ZONE_KM2` has no seed: it joins the nearest zone. */
export const ISLAND_SHARE = 1 / 3;

export interface AirZones {
  /** Zone per cell, 1…count (0: none, water too small for a sea zone). */
  zoneOf: Uint16Array;
  /** Zone per node of the province graph (0 for node 0). */
  zoneOfNode: Uint16Array;
  count: number;
  /** Zones 1…land are the land's; the rest the sea zones'. */
  land: number;
  /** Per zone (index 0 unused): its area, km², and its seed's cell. */
  areaKm2: Float64Array;
  seedCell: Int32Array;
}

export function buildAirZones(g: NavGrid, graph: ProvinceGraph, sea: SeaZones, targetKm2 = AIR_ZONE_KM2): AirZones {
  const { w, h, kx, ky } = g;
  const n = w * h;
  const nodes = graph.nodeCount + 1;
  const nodeOf = graph.nodeOf;
  // Each node's area and its centre's place.
  const area = new Float64Array(nodes);
  for (let c = 0; c < n; c++) {
    const k = nodeOf[c]!;
    if (k !== 0) area[k]! += kx[Math.floor(c / w)]! * ky[Math.floor(c / w)]!;
  }
  // Land components and their areas.
  const comp = new Int32Array(nodes).fill(-1);
  const compArea: number[] = [];
  const compFirst: number[] = [];
  for (let k = 1; k < nodes; k++) {
    if (comp[k] !== -1 || area[k] === 0) continue;
    const id = compArea.length;
    let sum = 0;
    const stack = [k];
    comp[k] = id;
    while (stack.length > 0) {
      const a = stack.pop()!;
      sum += area[a]!;
      for (const b of graph.adj[a] ?? []) {
        if (comp[b] !== -1 || area[b] === 0) continue;
        comp[b] = id;
        stack.push(b);
      }
    }
    compArea.push(sum);
    compFirst.push(k);
  }
  const big = (k: number): boolean => compArea[comp[k]!]! >= ISLAND_SHARE * targetKm2;
  // Seeds on the lattice, row by row in km, on the large components.
  const side = sqrt(targetKm2);
  const seedNodes: number[] = [];
  const isSeed = new Uint8Array(nodes);
  const hasSeed = new Uint8Array(compArea.length);
  let yKm = side / 2;
  let rowKm = 0;
  for (let y = 0; y < h; y++) {
    const top = rowKm;
    rowKm += ky[y]!;
    if (!(top <= yKm && yKm < rowKm)) continue;
    yKm += side;
    const step = Math.max(1, Math.round(side / Math.max(1e-6, kx[y]!)));
    for (let x = Math.floor(step / 2); x < w; x += step) {
      const k = nodeOf[y * w + x]!;
      if (k !== 0 && isSeed[k] === 0 && area[k]! > 0 && big(k)) {
        isSeed[k] = 1;
        hasSeed[comp[k]!] = 1;
        seedNodes.push(k);
      }
    }
  }
  // A large component no seed fell on: seeded at its lowest node.
  compFirst.forEach((k, id) => {
    if (hasSeed[id] === 0 && big(k)) {
      isSeed[k] = 1;
      hasSeed[id] = 1;
      seedNodes.push(k);
    }
  });
  // Zones in the order of their seeds' cells.
  seedNodes.sort((a, b) => graph.centre[a]! - graph.centre[b]!);
  const zoneOfNode = new Uint16Array(nodes);
  const dist = new Float64Array(nodes).fill(Infinity);
  const heap = new Heap();
  const cx = (k: number): number => graph.centre[k]! % w;
  const cy = (k: number): number => Math.floor(graph.centre[k]! / w);
  const km = (a: number, b: number): number => {
    let dx = Math.abs(cx(a) - cx(b));
    if (g.wrapX && dx > w / 2) dx = w - dx;
    const yy = Math.min(cy(a), cy(b));
    const ex = dx * kx[yy]!;
    const ey = (cy(a) - cy(b)) * ky[yy]!;
    return sqrt(ex * ex + ey * ey);
  };
  seedNodes.forEach((k, i) => {
    zoneOfNode[k] = i + 1;
    dist[k] = 0;
    heap.push(0, k);
  });
  while (heap.size > 0) {
    const a = heap.pop();
    const da = dist[a]!;
    for (const b of graph.adj[a] ?? []) {
      if (area[b] === 0) continue;
      const d = da + km(a, b);
      if (d < dist[b]! || (d === dist[b]! && zoneOfNode[a]! < zoneOfNode[b]!)) {
        dist[b] = d;
        zoneOfNode[b] = zoneOfNode[a]!;
        heap.push(d, b);
      }
    }
  }
  // The small components: whole, to the zone of the seed nearest their lowest node.
  compFirst.forEach((k, id) => {
    if (hasSeed[id] === 1) return;
    let best = 0;
    let bd = Infinity;
    for (const sd of seedNodes) {
      const d = km(k, sd);
      if (d < bd) {
        bd = d;
        best = zoneOfNode[sd]!;
      }
    }
    for (let a = 1; a < nodes; a++) if (comp[a] === id) zoneOfNode[a] = best;
  });
  // A zone under a quarter of the target (a seed on a small node hemmed in by others' growth)
  // joins the neighbouring zone over the graph with the least area, the smallest first (PLAN
  // 7.36b, ADR-560); the zones left are numbered again in the order of their seeds.
  const zArea = new Float64Array(seedNodes.length + 1);
  for (let k = 1; k < nodes; k++) zArea[zoneOfNode[k]!]! += area[k]!;
  const into = Int32Array.from({ length: seedNodes.length + 1 }, (_, i) => i);
  const find = (z: number): number => {
    while (into[z] !== z) z = into[z]!;
    return z;
  };
  const kept = new Uint8Array(seedNodes.length + 1);
  for (;;) {
    let small = 0;
    for (let z = 1; z <= seedNodes.length; z++) {
      if (find(z) === z && kept[z] === 0 && zArea[z]! < targetKm2 / 4 && (small === 0 || zArea[z]! < zArea[small]!)) small = z;
    }
    if (small === 0) break;
    let best = 0;
    for (let k = 1; k < nodes; k++) {
      if (find(zoneOfNode[k]!) !== small) continue;
      for (const b of graph.adj[k] ?? []) {
        const zb = find(zoneOfNode[b]!);
        if (area[b] === 0 || zb === 0 || zb === small) continue;
        if (best === 0 || zArea[zb]! < zArea[best]! || (zArea[zb] === zArea[best] && zb < best)) best = zb;
      }
    }
    if (best === 0) kept[small] = 1;
    else {
      into[small] = best;
      zArea[best]! += zArea[small]!;
    }
  }
  const renumber = new Uint16Array(seedNodes.length + 1);
  const seeds: number[] = [];
  seedNodes.forEach((k, i) => {
    if (find(i + 1) === i + 1) {
      seeds.push(k);
      renumber[i + 1] = seeds.length;
    }
  });
  for (let k = 1; k < nodes; k++) zoneOfNode[k] = renumber[find(zoneOfNode[k]!)]!;
  const land = seeds.length;
  const count = land + sea.count;
  const zoneOf = new Uint16Array(n);
  const areaKm2 = new Float64Array(count + 1);
  const seedCell = new Int32Array(count + 1).fill(-1);
  for (let c = 0; c < n; c++) {
    const k = nodeOf[c]!;
    const z = k !== 0 ? zoneOfNode[k]! : sea.zoneOf[c] !== 0 ? land + sea.zoneOf[c]! : 0;
    zoneOf[c] = z;
    if (z !== 0) areaKm2[z]! += kx[Math.floor(c / w)]! * ky[Math.floor(c / w)]!;
  }
  seeds.forEach((k, i) => (seedCell[i + 1] = graph.centre[k]!));
  for (let s = 1; s <= sea.count; s++) seedCell[land + s] = sea.seedCell[s]!;
  return { zoneOf, zoneOfNode, count, land, areaKm2, seedCell };
}
