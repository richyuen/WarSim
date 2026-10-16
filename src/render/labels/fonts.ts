/**
 * The map's font (PLAN 7.4e, ADR-444): Lato (SIL OFL 1.1, `@fontsource/lato`, bundled), as AoC's
 * names and panels have it. Before it has loaded, and where it cannot, the system's sans-serif.
 */
export const MAP_FONT = 'Lato, system-ui, "Segoe UI", Roboto, sans-serif';

/** The weight of the nation names: Lato's Black, AoC's heavy names. */
export const NAME_WEIGHT = 900;
/** The weight of the city names. */
export const CITY_WEIGHT = 700;

/**
 * Loads the faces the canvases draw with: a canvas asks for no font of its own, and text drawn and
 * measured before the face is there is the fallback's. Resolves when both are in (or failed).
 */
export function loadMapFonts(): Promise<void> {
  const fonts = typeof document !== 'undefined' ? document.fonts : undefined;
  if (!fonts?.load) return Promise.resolve();
  return Promise.all([fonts.load(`${NAME_WEIGHT} 32px Lato`), fonts.load(`${CITY_WEIGHT} 12px Lato`)]).then(
    () => undefined,
    () => undefined,
  );
}
