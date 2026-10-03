/** Editor panel settings (PLAN 1.35), shared by the HUD and the panel. */
export interface EditorState {
  tool: 'brush' | 'line' | 'bucket';
  layer: 'nation' | 'terrain';
  /** Nation id (0 = unowned) or land terrain class. */
  nation: number;
  terrain: number;
  r: number;
  mask: 'none' | 'terrain' | 'nation';
  /** The mask's terrain class or nation. */
  maskTerrain: number;
  maskNation: number;
}
