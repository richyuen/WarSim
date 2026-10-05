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
import scenarioRandom from '../../data/scenarios/random/scenario.json' with { type: 'json' };
import nations1938 from '../../data/scenarios/1938/nations.json' with { type: 'json' };

/** How many nations the random world starts with when no number is asked for (PLAN 2.16). */
export const RANDOM_NATIONS_DEFAULT = 60;

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
  /** i18n keys of the scenario's name and description, and of its map's name (title screen, PLAN 1.43). */
  nameKey: string;
  descKey: string;
  mapNameKey: string;
  /** Nations alive at the start. */
  nations: number;
  /** Not offered on the title screen: it opens by its URL only (`?scenario=<id>`). */
  hidden: boolean;
  /**
   * The tags of the scenario's nation table by nation id - 1; none where the nations are made in
   * code (the toy world) or by the seed (the random world). A nation with a tag has the name and
   * the flag its scenario gives it (PLAN 2.16b).
   */
  nationTags: readonly string[];
}

interface MapJson {
  nameKey: string;
  widthKm: number;
  sizes: { id: string; w: number; h: number }[];
  defaultSize: string;
}
interface ScenarioJson {
  nameKey: string;
  descKey: string;
  hidden?: boolean;
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
  random: geometry(earthMap, scenarioRandom),
};

function info(id: ScenarioId, map: MapJson, scenario: ScenarioJson, nations: number, nationTags: readonly string[] = []): ScenarioInfo {
  return {
    geometry: SCENARIO_GEOMETRY[id],
    startDay: dayOfIso(scenario.startDate),
    nameKey: scenario.nameKey,
    descKey: scenario.descKey,
    mapNameKey: map.nameKey,
    nations,
    hidden: scenario.hidden === true,
    nationTags,
  };
}

export const SCENARIO_INFO: Record<ScenarioId, ScenarioInfo> = {
  // The toy world's two nations are code (src/sim/toy.ts), not a nations file.
  toy: info('toy', toyMap, toyScenario, 2),
  '1938': info('1938', earthMap, scenario1938, (nations1938.nations as { alive?: boolean }[]).filter((n) => n.alive !== false).length, nations1938.nations.map((n) => n.tag)),
  // Its nations are made by the seed (src/sim/randomWorld.ts); this is how many when none is asked for.
  random: info('random', earthMap, scenarioRandom, RANDOM_NATIONS_DEFAULT),
};

/** The scenarios the title screen offers, in its order (PLAN 1.43). */
export const LISTED_SCENARIOS: readonly ScenarioId[] = (['1938', 'toy'] as const).filter((id) => !SCENARIO_INFO[id].hidden);

/**
 * Where a listed scenario's preview image is served, relative to the page (PLAN 1.43c): the
 * political map of its start, made by `npm run data -- --previews` (tools/data/preview.ts).
 */
export function scenarioPreviewPath(id: ScenarioId): string {
  return `data/scenarios/${id}/preview.png`;
}

/** A `?scenario=` value as a scenario id; null for none or an unknown one (the title screen). */
export function scenarioIdOf(value: string | null): ScenarioId | null {
  return value !== null && Object.hasOwn(SCENARIO_INFO, value) ? (value as ScenarioId) : null;
}
