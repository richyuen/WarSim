/** Editor panel settings (PLAN 1.35), shared by the HUD and the panel. */
export interface EditorState {
  /** Paint tools (PLAN 1.35) and scenario tools (PLAN 1.36). */
  tool: 'brush' | 'line' | 'bucket' | 'city' | 'removeCity' | 'capital' | 'core' | 'uncore';
  layer: 'nation' | 'terrain';
  /** Nation id (0 = unowned) or land terrain class. */
  nation: number;
  terrain: number;
  r: number;
  mask: 'none' | 'terrain' | 'nation';
  /** The mask's terrain class or nation. */
  maskTerrain: number;
  maskNation: number;
  /** New city name and size (city tool). */
  cityName: string;
  citySize: number;
}
