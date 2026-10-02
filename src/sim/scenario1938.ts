/**
 * The 1938 world (PLAN 1.9a): the map build chain (`buildPoliticalMap`) over the shipped earth
 * assets at the scenario's map size, turned into sim state: cell layers (owner, controller,
 * terrain, province), the nation table (id = index + 1 in nations.json), cities and the
 * starting order of battle. Static facts (names, traits, templates) stay in scenario data and
 * are looked up by id; only what changes during play is state.
 */
import earthMap from '../../data/maps/earth/map.json' with { type: 'json' };
import earthStraits from '../../data/maps/earth/straits.json' with { type: 'json' };
import cities1938 from '../../data/scenarios/1938/cities.json' with { type: 'json' };
import nations1938 from '../../data/scenarios/1938/nations.json' with { type: 'json' };
import oob1938 from '../../data/scenarios/1938/oob.json' with { type: 'json' };
import ownership1938 from '../../data/scenarios/1938/ownership.json' with { type: 'json' };
import scenario1938 from '../../data/scenarios/1938/scenario.json' with { type: 'json' };
import templatesLand from '../../data/templates/land.json' with { type: 'json' };
import unitsLand from '../../data/units/land.json' with { type: 'json' };
import { decodeAdmin1, type Admin1Meta } from '../shared/admin1';
import type { ScenarioAssets } from '../shared/protocol';
import { dayOfIso } from '../shared/calendar';
import type { CityDef } from './data/cities';
import { templateStrength, type OobGroup, type TemplateDef, type UnitTypeLite } from './data/oob';
import type { OwnershipRules } from './data/ownership';
import { buildPoliticalMap } from './data/politicalMap';
import type { NationDef } from './data/schemas';
import type { StraitDef } from './data/terrain';
import { World } from './world';

export const NATIONS_1938 = nations1938.nations as unknown as NationDef[];
export const TEMPLATES_LAND = templatesLand.templates as TemplateDef[];
const sizeId = scenario1938.size ?? earthMap.defaultSize;
const size = earthMap.sizes.find((s) => s.id === sizeId)!;
/** Map size of the 1938 scenario (M by default). */
export const SIZE_1938 = { w: size.w, h: size.h };

function parseColor(hex: string): number {
  return parseInt(hex.slice(1), 16);
}

export function createWorld1938(seed: number, assets: ScenarioAssets): World {
  const { w, h } = SIZE_1938;
  const world = new World(seed, w, h);
  world.startDay = dayOfIso(scenario1938.startDate);
  const tags = NATIONS_1938.map((n) => n.tag);
  const map = buildPoliticalMap({
    w,
    h,
    geo: decodeAdmin1(assets.admin1Geometry),
    meta: JSON.parse(new TextDecoder().decode(assets.admin1Meta)) as Admin1Meta[],
    terrainRaw: assets.terrain,
    straits: earthStraits.straits as unknown as StraitDef[],
    tags,
    rules: ownership1938 as unknown as OwnershipRules,
    cities: cities1938.cities as unknown as CityDef[],
    oob: oob1938.groups as unknown as OobGroup[],
    overlordOf: new Map(NATIONS_1938.flatMap((n) => (n.overlord ? [[n.tag, n.overlord.tag] as const] : []))),
  });
  if (map.unplacedGroups.length) throw new Error(`1938 OOB: ${map.unplacedGroups.length} groups found no land`);
  const c = world.cells;
  c.owner.set(map.owner);
  c.controller.set(map.controller);
  c.terrain.set(map.terrain);
  c.province.set(map.provinceIds);

  const cellsOf = new Uint32Array(tags.length + 1);
  for (const o of map.owner) cellsOf[o]!++;
  world.nations.reserve(NATIONS_1938.length);
  const n = world.nations.cols;
  NATIONS_1938.forEach((def, i) => {
    const id = world.nations.create();
    if (id !== i + 1) throw new Error('nation ids must follow nations.json order');
    n.color[id] = parseColor(def.color);
    n.cells[id] = cellsOf[id]!;
    n.living[id] = def.alive === false ? 0 : 1;
  });

  // Cities keep their index into cities.json (`def`), so names resolve without state.
  world.cities.reserve(map.cities.length);
  const cc = world.cities.cols;
  for (const p of map.cities) {
    const id = world.cities.create();
    cc.def[id] = p.def;
    cc.x[id] = p.x;
    cc.y[id] = p.y;
    cc.cell[id] = p.cell;
    cc.size[id] = p.size;
    cc.capitalOf[id] = p.capitalOf;
    if (p.capitalOf !== 0) {
      n.capitalX[p.capitalOf] = p.x;
      n.capitalY[p.capitalOf] = p.y;
    }
  }

  const types = new Map((unitsLand.types as unknown as UnitTypeLite[]).map((u) => [u.id, u]));
  const templateIndex = new Map(TEMPLATES_LAND.map((t, i) => [t.id, i]));
  const menOf = TEMPLATES_LAND.map((t) => templateStrength(t, types).men);
  world.formations.reserve(map.formations.length);
  const f = world.formations.cols;
  for (const p of map.formations) {
    const id = world.formations.create();
    const ti = templateIndex.get(p.template)!;
    f.nation[id] = p.nation;
    f.x[id] = p.x;
    f.y[id] = p.y;
    f.facing[id] = 0;
    f.template[id] = ti;
    f.strength[id] = menOf[ti]!;
  }
  return world;
}
