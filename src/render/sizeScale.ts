/**
 * The game's cells to a cell of its map's default size (ADR-417, PLAN 7.1b5), for what the view
 * draws at a size given in cells (an element's sprite, a figure's footprint, a marker's stand-in,
 * a shot's scatter, a sortie's orbit): those sizes are cells of the default size, so a thing is
 * as many metres at every map size. One view a page: it sets the scale for its game.
 */
export let sizeScale = 1;

/** Sets the scale for the view's game (`ScenarioGeometry.scale`). */
export function setSizeScale(scale: number): void {
  sizeScale = scale;
}
