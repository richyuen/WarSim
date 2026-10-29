/**
 * The AI's layers and the player's AI assist (the user's decision, ADR-759).
 *
 * Taking control of a nation does not switch its AI off: each layer runs for it while its box
 * is ticked (`World.playerAi`, a mask of `AiLayer`; all but nuclear strikes by default). God
 * Mode's switch of a nation's AI (`aiOff`) still switches every layer off, for any nation.
 *
 * A direct order of the player's to one of its formations (`World.playerOrders`) keeps the AI's
 * hands off that formation until the order is done (`playerOrderSystem`): a march or a fleet's
 * move until it arrives, a wing's rebase until it lands, a wing's mission for a day. The AI then
 * has it back, and may undo the order at once.
 */
import type { World } from '../world';

export const AiLayer = {
  /** Fronts, invasions, merging hollow divisions. */
  army: 1,
  /** Fleets: their stations, battles, lay-up. */
  navy: 2,
  /** Wings: missions and bases. */
  air: 4,
  /** War, peace and alliances. */
  diplomacy: 8,
  /** Building, research, gold. */
  economy: 16,
  /** Nuclear strikes. */
  nukes: 32,
} as const;
export type AiLayer = (typeof AiLayer)[keyof typeof AiLayer];

/** Every layer's bit. */
export const PLAYER_AI_ALL = 63;
/** What a nation taken into control starts with: every layer but nuclear strikes. */
export const PLAYER_AI_DEFAULT = PLAYER_AI_ALL & ~AiLayer.nukes;

/** Whether layer `layer` of the AI acts for nation `n`: its AI is on, and for the player's nation that layer is ticked. */
export function aiRuns(world: World, n: number, layer: AiLayer): boolean {
  return world.nations.cols.aiOff[n] !== 1 && (n !== world.settings.player || n === 0 || (world.playerAi & layer) !== 0);
}

/** Whether formation `id` is on a direct order of the player's, which the AI leaves alone. */
export function playerHeld(world: World, id: number): boolean {
  return world.playerOrders.has(id);
}
