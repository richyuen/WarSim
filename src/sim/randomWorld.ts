/**
 * The random world (PLAN 2.16a, ADR-108): the earth map of the 1938 scenario with nations made
 * by the seed instead of read from a file. Capitals are drawn from the map's cities and kept
 * apart; every nation takes the provinces nearest its capital over the province graph, each at
 * a speed of its own, so that they differ in size; land no road reaches (an island without a
 * crossing) goes to the nearest capital. A nation is called after the province of its capital,
 * has a colour of its own and an army its income carries. No alliances, no wars, no puppets:
 * the world makes them.
 *
 * Everything drawn here comes from `hash32(seed, …)`: the same seed and count give the same
 * world, and none of the world's own streams is touched.
 */
import earthStraits from '../../data/maps/earth/straits.json' with { type: 'json' };
import cities1938 from '../../data/scenarios/1938/cities.json' with { type: 'json' };
import scenarioRandom from '../../data/scenarios/random/scenario.json' with { type: 'json' };
import { decodeAdmin1, type Admin1Meta } from '../shared/admin1';
import { dayOfIso } from '../shared/calendar';
import { addIslet } from '../shared/landMask';
import { provinceLabel } from '../shared/nationNames';
import type { ScenarioAssets } from '../shared/protocol';
import { RANDOM_NATIONS } from '../shared/scenarios';
import { Terrain } from '../shared/terrain';
import { hash32, hashToUnit } from './core/hash';
import { CITY_SNAP_CELLS, placeCities, type CityDef } from './data/cities';
import { placeOob, type OobGroup } from './data/oob';
import { nearestCellWhere, reconcileIslands } from './data/ownership';
import { buildProvinceRaster } from './data/provinces';
import { cellOf, loadTerrain, type StraitDef } from './data/terrain';
import { addCities, addFormations, applyScenarioSettings, ECONOMY_TABLES_1938, fillEconomy, RULES_1938, SIZE_1938, startTreasury, TEMPLATES_LAND } from './scenario1938';
import { MARGIN } from './ai/economic';
import { monthlyAccounts } from './systems/economy';
import { staticCe } from './systems/efficiency';
import { initProvinceCores } from './systems/revolts';
import { navOf, World } from './world';

/** The count a random world is built with (`RANDOM_NATIONS`, shared/scenarios) for the count asked for (none, a fraction, out of range). */
export function randomNationCount(asked: number | undefined): number {
  if (asked === undefined || !Number.isFinite(asked)) return RANDOM_NATIONS.default;
  return Math.max(RANDOM_NATIONS.min, Math.min(RANDOM_NATIONS.max, Math.round(asked)));
}

/** Cities tried for each capital; the one farthest from the capitals there are is taken. */
const CAPITAL_TRIES = 12;
/** No capital on a piece of land of fewer cells than this (an islet makes a nation of one cell). */
const HOME_CELLS = 12;
/** A nation's cost of a kilometre when it takes land: between these, by the seed. */
const SLOW_MIN = 0.6;
const SLOW_MAX = 1.8;
/** The share of its income a nation's army of the start costs, at most. */
const ARMY_SHARE = 0.5;
/** The formations of the start, all nations together, at most (the 1938 world has 1,054). */
const ARMY_TOTAL = 900;
/** The cities a nation's army is spread over, at most; and one for so many formations. */
const ARMY_ANCHORS = 6;
const ARMY_PER_ANCHOR = 3;

const SALT_CAPITAL = 0x52434150;
const SALT_SLOW = 0x52534c4f;
const SALT_COLOR = 0x52434f4c;
const SALT_AGGR = 0x52414752;

const CITIES = cities1938.cities as unknown as CityDef[];
const tagOf = (id: number): string => `R${id}`;

/** A colour for nation `id`: hues a golden angle apart, so that neighbours in the order differ. */
function colorOf(seed: number, id: number): number {
  const hue = (hashToUnit(hash32(seed, SALT_COLOR)) + id * 0.618033988749895) % 1;
  const sat = 0.45 + 0.35 * hashToUnit(hash32(seed, SALT_COLOR, id, 1));
  const light = 0.42 + 0.22 * hashToUnit(hash32(seed, SALT_COLOR, id, 2));
  const a = sat * Math.min(light, 1 - light);
  const f = (n: number): number => {
    const k = (n + hue * 12) % 12;
    return Math.round(255 * (light - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return (f(0) << 16) | (f(8) << 8) | f(4);
}

/** A binary heap of (cost, node), the lower cost first and the lower node on a tie. */
class Heap {
  private readonly cost: number[] = [];
  private readonly node: number[] = [];
  get size(): number {
    return this.cost.length;
  }
  private less(i: number, j: number): boolean {
    return this.cost[i]! < this.cost[j]! || (this.cost[i] === this.cost[j] && this.node[i]! < this.node[j]!);
  }
  private swap(i: number, j: number): void {
    [this.cost[i], this.cost[j]] = [this.cost[j]!, this.cost[i]!];
    [this.node[i], this.node[j]] = [this.node[j]!, this.node[i]!];
  }
  push(cost: number, node: number): void {
    let i = this.cost.length;
    this.cost.push(cost);
    this.node.push(node);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!this.less(i, p)) break;
      this.swap(i, p);
      i = p;
    }
  }
  pop(): [number, number] {
    const top: [number, number] = [this.cost[0]!, this.node[0]!];
    const last = this.cost.length - 1;
    this.swap(0, last);
    this.cost.pop();
    this.node.pop();
    for (let i = 0; ; ) {
      const l = 2 * i + 1;
      const r = l + 1;
      let m = i;
      if (l < last && this.less(l, m)) m = l;
      if (r < last && this.less(r, m)) m = r;
      if (m === i) break;
      this.swap(i, m);
      i = m;
    }
    return top;
  }
}

export function createRandomWorld(seed: number, asked: number | undefined, assets: ScenarioAssets): World {
  const { w, h } = SIZE_1938;
  const world = new World(seed, w, h);
  world.landMask = assets.landMask ?? null;
  world.startDay = dayOfIso(scenarioRandom.startDate);
  const set = scenarioRandom.settings;
  applyScenarioSettings(world, set);
  // The rules of 1938 without its nation table: a nation here has the name it was given (ADR-108).
  world.rules = { ...RULES_1938, namedNations: 0 };

  // The map of the 1938 world: provinces, terrain, crossings, the islands and their islets.
  const meta = JSON.parse(new TextDecoder().decode(assets.admin1Meta)) as Admin1Meta[];
  const pr = buildProvinceRaster(decodeAdmin1(assets.admin1Geometry), meta, w, h);
  const { terrain } = loadTerrain(assets.terrain, w, h, earthStraits.straits as unknown as StraitDef[]);
  const islands = reconcileIslands(terrain, pr.ids, meta, w, h);
  if (world.landMask) for (const cell of islands.cells) addIslet(world.landMask, w, cell % w, Math.floor(cell / w));
  const c = world.cells;
  c.terrain.set(terrain);
  c.province.set(pr.ids);
  const { province } = c;
  const { grid, graph } = navOf(world);
  const isLand = (cell: number): boolean => terrain[cell]! >= Terrain.Plains && province[cell]! > 0;

  /** Kilometres between two cells, the short way round. */
  const km = (a: number, b: number): number => {
    const ya = Math.floor(a / w);
    const yb = Math.floor(b / w);
    let dx = Math.abs((a % w) - (b % w));
    if (grid.wrapX && dx > w / 2) dx = w - dx;
    const kx = (grid.kx[ya]! + grid.kx[yb]!) / 2;
    const ky = (grid.ky[ya]! + grid.ky[yb]!) / 2;
    return Math.sqrt(dx * kx * (dx * kx) + (ya - yb) * ky * ((ya - yb) * ky));
  };

  // Capitals: of CAPITAL_TRIES cities drawn, the one farthest from the capitals there are. The
  // cities are where people live, so the nations are many where the land is full and few where
  // it is empty; the distance keeps them from sitting on one another. One capital to a province,
  // and none on an islet.
  const cityCell = CITIES.map((d) => {
    const [x, y] = cellOf(d.lonLat[0], d.lonLat[1], w, h);
    return nearestCellWhere(isLand, x, y, w, h, CITY_SNAP_CELLS);
  });
  const pieceCells = new Map<number, number>();
  for (let cell = 0; cell < w * h; cell++) if (isLand(cell)) pieceCells.set(grid.component[cell]!, (pieceCells.get(grid.component[cell]!) ?? 0) + 1);
  const count = randomNationCount(asked);
  const capitalCity: number[] = [];
  const taken = new Set<number>();
  const free = (ci: number): boolean => cityCell[ci]! >= 0 && !taken.has(province[cityCell[ci]!]!) && pieceCells.get(grid.component[cityCell[ci]!]!)! >= HOME_CELLS;
  for (let n = 1; n <= count; n++) {
    let best = -1;
    let bestD = -1;
    for (let k = 0; k < CAPITAL_TRIES; k++) {
      const ci = Math.floor(hashToUnit(hash32(seed, SALT_CAPITAL, n, k)) * CITIES.length);
      if (!free(ci)) continue;
      let d = Infinity;
      for (const other of capitalCity) d = Math.min(d, km(cityCell[ci]!, cityCell[other]!));
      if (d > bestD) {
        bestD = d;
        best = ci;
      }
    }
    // Every city drawn was taken: the first free one after the first drawn.
    for (let k = 0, ci = Math.floor(hashToUnit(hash32(seed, SALT_CAPITAL, n, 0)) * CITIES.length); best < 0 && k < CITIES.length; k++, ci = (ci + 1) % CITIES.length) {
      if (free(ci)) best = ci;
    }
    if (best < 0) break; // no province is left without a capital
    capitalCity.push(best);
    taken.add(province[cityCell[best]!]!);
  }
  const nations = capitalCity.length;

  // Land: each province to the nation that reaches it first over the province graph (the
  // crossings are nodes of it), a nation's kilometre costing `slow` of its own.
  const slow = [0, ...capitalCity.map((_, i) => SLOW_MIN + (SLOW_MAX - SLOW_MIN) * hashToUnit(hash32(seed, SALT_SLOW, i + 1)))];
  const nationOf = new Uint16Array(graph.nodeCount);
  const reached = new Float64Array(graph.nodeCount).fill(Infinity);
  const heap = new Heap();
  capitalCity.forEach((ci, i) => {
    const node = province[cityCell[ci]!]!;
    reached[node] = 0;
    nationOf[node] = i + 1;
    heap.push(0, node);
  });
  while (heap.size > 0) {
    const [cost, node] = heap.pop();
    if (cost > reached[node]!) continue;
    const n = nationOf[node]!;
    for (const next of graph.adj[node] ?? []) {
      const a = graph.centre[node] ?? -1;
      const b = graph.centre[next] ?? -1;
      if (a < 0 || b < 0) continue;
      const to = cost + slow[n]! * km(a, b);
      if (to < reached[next]!) {
        reached[next] = to;
        nationOf[next] = n;
        heap.push(to, next);
      }
    }
  }
  // What no road reaches: to the capital nearest by the same measure.
  const maxProvince = meta.length;
  for (let p = 1; p <= maxProvince; p++) {
    const at = graph.centre[p] ?? -1;
    if (nationOf[p] !== 0 || at < 0) continue;
    let best = 0;
    let bestD = Infinity;
    capitalCity.forEach((ci, i) => {
      const d = slow[i + 1]! * km(at, cityCell[ci]!);
      if (d < bestD) {
        bestD = d;
        best = i + 1;
      }
    });
    nationOf[p] = best;
  }
  const cellsOf = new Uint32Array(nations + 1);
  for (let cell = 0; cell < w * h; cell++) {
    if (!isLand(cell)) continue;
    const n = nationOf[province[cell]!]!;
    c.owner[cell] = n;
    c.controller[cell] = n;
    cellsOf[n]!++;
  }

  // Cities, with the capitals drawn above: the list of the 1938 file in its order, so that a
  // city's `def` names it as it does there.
  const tags = capitalCity.map((_, i) => tagOf(i + 1));
  const capitalOf = new Map(capitalCity.map((ci, i) => [ci, tagOf(i + 1)]));
  const cities = placeCities(
    CITIES.map((d, ci) => ({ name: d.name, lonLat: d.lonLat, size: d.size, ...(capitalOf.has(ci) ? { capitalOf: capitalOf.get(ci)! } : {}) })),
    tags,
    c.owner,
    w,
    h,
  );
  fillEconomy(world, meta, cities);

  world.nations.reserve(nations);
  const nc = world.nations.cols;
  for (let i = 0; i < nations; i++) {
    const id = world.nations.create();
    nc.color[id] = colorOf(seed, id);
    nc.cells[id] = cellsOf[id]!;
    nc.living[id] = 1;
    nc.incomeMult[id] = 1;
    nc.manpowerMult[id] = 1;
    nc.aggression[id] = 15 + Math.floor(hashToUnit(hash32(seed, SALT_AGGR, id)) * 71);
    nc.ceStatic[id] = staticCe(nc.aggression[id]!);
    nc.efficiency[id] = 1;
    nc.revivalsLeft[id] = set.revival.maxPerNation;
  }
  addCities(world, cities);
  const labels = meta.map(provinceLabel);
  // The name is state, as one given in God Mode is: no table of the scenario holds it.
  for (const p of cities) if (p.capitalOf !== 0) world.names.set(p.capitalOf, labels[province[p.cell]! - 1] || p.name);

  // Armies: infantry for ARMY_SHARE of the income, one division in four motorised or armoured
  // where there are eight; all of them together not above ARMY_TOTAL. They stand around the
  // nation's largest cities, the capital first.
  const { gross } = monthlyAccounts(world, ECONOMY_TABLES_1938);
  const template = (id: string): number => TEMPLATES_LAND.findIndex((t) => t.id === id);
  const infantry = template('infantry_div');
  const upkeep = ECONOMY_TABLES_1938.templateUpkeep[infantry]!;
  const want = new Float64Array(nations + 1);
  let total = 0;
  for (let id = 1; id <= nations; id++) {
    want[id] = Math.max(1, (ARMY_SHARE * (1 - MARGIN) * Math.max(0, gross[id]!)) / upkeep);
    total += want[id]!;
  }
  const scale = Math.min(1, ARMY_TOTAL / total);
  const citiesOf: number[][] = Array.from({ length: nations + 1 }, () => []);
  cities.forEach((p, i) => citiesOf[p.owner]?.push(i));
  const groups: OobGroup[] = [];
  for (let id = 1; id <= nations; id++) {
    const formations = Math.max(1, Math.floor(want[id]! * scale));
    const anchors = citiesOf[id]!
      .slice()
      .sort((a, b) => Number(cities[b]!.capitalOf === id) - Number(cities[a]!.capitalOf === id) || cities[b]!.size - cities[a]!.size || a - b)
      .slice(0, Math.max(1, Math.min(ARMY_ANCHORS, Math.ceil(formations / ARMY_PER_ANCHOR))));
    const byGroup = new Map<string, OobGroup>();
    for (let k = 0; k < formations; k++) {
      const at = CITIES[cities[anchors[k % anchors.length]!]!.def]!.lonLat;
      const kind = formations >= 8 && k % 8 === 7 ? 'panzer_div' : formations >= 8 && k % 8 === 3 ? 'motorised_div' : 'infantry_div';
      const key = `${k % anchors.length}:${kind}`;
      const g = byGroup.get(key);
      if (g) g.count++;
      else byGroup.set(key, { nation: tagOf(id), template: kind, count: 1, at });
    }
    groups.push(...byGroup.values());
  }
  const oob = placeOob({ w, h, owner: c.owner, controller: c.controller, terrain, tags, overlordOf: new Map(), groups });
  if (oob.unplaced.length) throw new Error(`random world: ${oob.unplaced.length} groups found no land`);
  addFormations(world, oob.formations);

  initProvinceCores(world);
  startTreasury(world);
  return world;
}
