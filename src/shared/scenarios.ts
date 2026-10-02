/**
 * Scenario map geometry known to both the sim and the main thread (the view needs the map
 * size before the first snapshot). Read from `data/scenarios/<id>/scenario.json` and its map's
 * `data/maps/<id>/map.json` (PLAN 1.1; both validated by tests/unit/data-schemas.test.ts).
 */
import { dayOfIso } from './calendar';
import type { ScenarioId } from './protocol';
import toyMap from '../../data/maps/toy/map.json' with { type: 'json' };
import toyScenario from '../../data/scenarios/toy/scenario.json' with { type: 'json' };
import earthMap from '../../data/maps/earth/map.json' with { type: 'json' };
import scenario1938 from '../../data/scenarios/1938/scenario.json' with { type: 'json' };

export interface ScenarioGeometry {
  w: number;
  h: number;
  kmPerCell: number;
  wrapX: boolean;
}

/** What the main thread needs about a scenario before the first snapshot. */
export interface ScenarioInfo {
  geometry: ScenarioGeometry;
  /** Start date as days since 1970-01-01 (shared/calendar). */
  startDay: number;
}

interface MapJson {
  widthKm: number;
  sizes: { id: string; w: number; h: number }[];
  defaultSize: string;
}
interface ScenarioJson {
  size?: string;
  startDate: string;
  settings: { loopingMap: boolean };
}

function geometry(map: MapJson, scenario: ScenarioJson): ScenarioGeometry {
  const sizeId = scenario.size ?? map.defaultSize;
  const size = map.sizes.find((s) => s.id === sizeId);
  if (!size) throw new Error(`map has no size '${sizeId}'`);
  return { w: size.w, h: size.h, kmPerCell: map.widthKm / size.w, wrapX: scenario.settings.loopingMap };
}

export const SCENARIO_GEOMETRY: Record<ScenarioId, ScenarioGeometry> = {
  toy: geometry(toyMap, toyScenario),
  '1938': geometry(earthMap, scenario1938),
};

export const SCENARIO_INFO: Record<ScenarioId, ScenarioInfo> = {
  toy: { geometry: SCENARIO_GEOMETRY.toy, startDay: dayOfIso(toyScenario.startDate) },
  '1938': { geometry: SCENARIO_GEOMETRY['1938'], startDay: dayOfIso(scenario1938.startDate) },
};
