import { T3_MAX_M } from '../render/units/individuals';

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
 * A sea battle's view (PLAN 4.12a): its two sides may stand a carrier's reach apart, hundreds of
 * km, more than a view under T2's limit holds. It goes out as far as holds both, up to this: in
 * T1 (under T1_MAX_M, 2,000, less the handover's margin), where fleets are markers.
 */
export const SEA_VIEW_MAX_M = 1800;
/** Cells about the pair of fleets a sea battle's row shows (PLAN 7.10b), and a fleet's fight (PLAN 7.126): their blocks and their fire. */
export const SEA_PAIR_MARGIN = 0.6;
/**
 * A formation's fight (PLAN 3.11b): its block and the block of the enemy it faces, which stand
 * up to a cell apart for a formation a line or more behind its side's front. The view holds
 * both blocks' middles with this much ground around the two, the half of a block and its tag
 * on each side, in the FIGHT_VIEW_CLEAR of the view's height that the bars at its top and its
 * bottom leave free (the war banners stood on a block at the view's lower edge), at up to
 * FIGHT_VIEW_MAX_M a pixel: T3's limit, so that figures are what is drawn (in a view of
 * 1400 × 800; a smaller one goes on as a battle's does). 28 before ADR-700: a block 18.8 km north
 * of its enemy's (seed 4242, day 21) was not whole in 800 px at 28; at 30 it is, and the view drawn
 * on arriving cold from 200 m/px has its figures (`T3_MAX_M` is inclusive).
 */
export const FIGHT_PAD_KM = 6;
export const FIGHT_VIEW_CLEAR = 0.7;
export const FIGHT_VIEW_MAX_M = T3_MAX_M;
/**
 * A fight T3 cannot hold (ADR-743, ADR-700 extended): two blocks whose middles stand further apart
 * than the whole view at FIGHT_VIEW_MAX_M less this much (half a block on each side, its tag
 * aside) go out past T3 as a war's battle does, so that both are whole. Two in contact may stand
 * 1.5 cells apart (CONTACT_CELLS, 29 km); a block 25.6 km north of its enemy's (seed 5381, day 21)
 * was cut at 30 m/px in 800 px. The 18.8 km of ADR-700 and the 17 km across water of
 * `warBattle.test.ts` stay at T3.
 */
export const FIGHT_T3_PAD_KM = 5;

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
 *     large enough for the battle's own zoom to be under it, so that figures are drawn still;
 *     further out, as a war's battle, where T3 cannot hold both blocks (FIGHT_T3_PAD_KM).
 *   - Not `fight` (a war's largest battle, PLAN 4.1d1): to BATTLE_VIEW_MAX_M. Two formations
 *     in contact with water between them keep their blocks on their shores, up to the reach of
 *     a contact apart: the view of a battle held one block and a part of the other.
 *   - `maxM` in place of BATTLE_VIEW_MAX_M: a sea battle's, SEA_VIEW_MAX_M (PLAN 4.12a).
 */
export function battleViewM(viewW: number, viewH: number, kmPerCell: number, span?: readonly [number, number], fight = false, maxM = BATTLE_VIEW_MAX_M): number {
  const base = Math.max(BATTLE_VIEW_M, (BATTLE_VIEW_KM * 1000) / Math.max(1, viewW), (BATTLE_VIEW_KM * 500) / Math.max(1, viewH));
  const both = span ? Math.max(((span[0] * kmPerCell + FIGHT_PAD_KM) * 1000) / Math.max(1, viewW), ((span[1] * kmPerCell + FIGHT_PAD_KM) * 1000) / Math.max(1, viewH * FIGHT_VIEW_CLEAR)) : 0;
  const t3Holds = !span || (span[0] * kmPerCell + FIGHT_T3_PAD_KM <= (viewW * FIGHT_VIEW_MAX_M) / 1000 && span[1] * kmPerCell + FIGHT_T3_PAD_KM <= (viewH * FIGHT_VIEW_MAX_M) / 1000);
  return Math.min(maxM, Math.max(base, Math.min(both, fight && base <= FIGHT_VIEW_MAX_M && t3Holds ? FIGHT_VIEW_MAX_M : maxM)));
}
