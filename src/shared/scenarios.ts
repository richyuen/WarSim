/**
 * Scenario map geometry known to both the sim and the main thread (the view needs the map
 * size before the first snapshot). Real scenarios load this from data/ (PLAN 1.1).
 */
import type { ScenarioId } from './protocol';

export interface ScenarioGeometry {
  w: number;
  h: number;
  kmPerCell: number;
  wrapX: boolean;
}

export const SCENARIO_GEOMETRY: Record<ScenarioId, ScenarioGeometry> = {
  toy: { w: 256, h: 128, kmPerCell: 40075 / 256, wrapX: true },
};
