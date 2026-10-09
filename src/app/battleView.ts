/**
 * How far in the camera goes for a battle (`MapView.showBattle`), as one function of the view's
 * size and of how far apart the two blocks stand: the map view takes its zoom from here, and a
 * test that asks whether two blocks are whole in the view the camera takes asks the same.
 */

/**
 * Where the camera goes for a battle (PLAN 2.14e): 20 m/px, the zoom at which two divisions
 * deployed against each other are whole in a view of 1400 × 800 (PLAN 2.14c1). A smaller view
 * keeps 28 km of ground across and 14 down at more metres a pixel, up to 250: under T2's limit
 * (T1_MIN_M less the hysteresis), so that elements are what is drawn.
 */
export const BATTLE_VIEW_M = 20;
export const BATTLE_VIEW_KM = 28;
export const BATTLE_VIEW_MAX_M = 250;
/**
 * A formation's fight (PLAN 3.11b): its block and the block of the enemy it faces, which stand
 * up to a cell apart for a formation a line or more behind its side's front. The view holds
 * both blocks' middles with this much ground around the two, the half of a block and its tag
 * on each side, in the FIGHT_VIEW_CLEAR of the view's height that the bars at its top and its
 * bottom leave free (the war banners stood on a block at the view's lower edge), at up to
 * FIGHT_VIEW_MAX_M a pixel: under T3's limit, so that figures are what is drawn (in a view of
 * 1400 × 800; a smaller one goes on as a battle's does).
 */
export const FIGHT_PAD_KM = 6;
export const FIGHT_VIEW_CLEAR = 0.7;
export const FIGHT_VIEW_MAX_M = 28;

/**
 * Metres a CSS pixel of the view the camera takes for a battle, in a view `viewW` × `viewH`
 * px of a map with `kmPerCell`.
 *
 * - Without `span`: BATTLE_VIEW_M, or more in a small view (BATTLE_VIEW_KM across and half of
 *   it down), up to BATTLE_VIEW_MAX_M.
 * - With `span` (the two blocks' middles that far apart in cells, east-west and north-south):
 *   as far out as holds both with FIGHT_PAD_KM around them, in the FIGHT_VIEW_CLEAR of the
 *   view's height.
 *   - `fight` (a formation's fight, PLAN 3.11b): to FIGHT_VIEW_MAX_M at most where the view is
 *     large enough for the battle's own zoom to be under it, so that figures are drawn still.
 *   - Not `fight` (a war's largest battle, PLAN 4.1d1): to BATTLE_VIEW_MAX_M. Two formations
 *     in contact with water between them keep their blocks on their shores, up to the reach of
 *     a contact apart: the view of a battle held one block and a part of the other.
 */
export function battleViewM(viewW: number, viewH: number, kmPerCell: number, span?: readonly [number, number], fight = false): number {
  const base = Math.max(BATTLE_VIEW_M, (BATTLE_VIEW_KM * 1000) / Math.max(1, viewW), (BATTLE_VIEW_KM * 500) / Math.max(1, viewH));
  const both = span ? Math.max(((span[0] * kmPerCell + FIGHT_PAD_KM) * 1000) / Math.max(1, viewW), ((span[1] * kmPerCell + FIGHT_PAD_KM) * 1000) / Math.max(1, viewH * FIGHT_VIEW_CLEAR)) : 0;
  return Math.min(BATTLE_VIEW_MAX_M, Math.max(base, Math.min(both, fight && base <= FIGHT_VIEW_MAX_M ? FIGHT_VIEW_MAX_M : BATTLE_VIEW_MAX_M)));
}
