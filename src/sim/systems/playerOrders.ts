/**
 * The player's direct orders (ADR-759, `World.playerOrders`): what the AI leaves alone, and when
 * that ends. Hourly, after the fights are found (`combatSystem` sets `engaged`), before the next
 * hour's AI and march:
 * - gone, or on the retreat (its march is the retreat's now): the order is over;
 * - a march (a formation's, a fleet's): over when it no longer marches, sails, waits to sail or is
 *   aboard: it has arrived, or its march ended. In a fight it was not given in, it is cancelled:
 *   the formation stops and fights (a march of the AI's only pauses). Given in a fight, it goes
 *   on through it (`through`, `movementSystem`) until the formation is first out of contact;
 * - a wing's rebase: over when the wing is at its new base (no ferry flight);
 * - a wing's mission: over after PLAYER_MISSION_HOURS, or when the mission is.
 * The AI has the formation back from the next hour, and may undo the order at once.
 * Nothing to do while there is no order: a world with no player is as it was.
 */
import { EventKind, RejectReason } from '../../shared/events';
import { PlayerOrderKind, type World } from '../world';

/** How long the AI leaves a wing's mission given by the player (hours). */
export const PLAYER_MISSION_HOURS = 24;

export function playerOrderSystem(world: World): void {
  if (world.playerOrders.size === 0) return;
  const c = world.formations.cols;
  for (const [id, o] of [...world.playerOrders].sort((a, b) => a[0] - b[0])) {
    if (!world.formations.has(id) || c.retreat[id]! > 0) {
      world.playerOrders.delete(id);
      continue;
    }
    if (o.kind === PlayerOrderKind.mission) {
      if (world.tick >= o.until || !world.wingMission.has(id)) world.playerOrders.delete(id);
      continue;
    }
    if (o.kind === PlayerOrderKind.rebase) {
      if (!world.wingFerry.has(id)) world.playerOrders.delete(id);
      continue;
    }
    if (c.moving[id] !== 1 && !world.embarked.has(id) && !world.seaBound.has(id) && !world.afloat(id)) {
      world.playerOrders.delete(id);
      continue;
    }
    if (c.engaged[id] !== 1) {
      o.through = false;
    } else if (!o.through) {
      // Contact on the way: the order is cancelled, and the formation stands and fights; the
      // player is told (`MoveRejected`, as a refused order).
      c.moving[id] = 0;
      c.home[id] = 0;
      world.paths.delete(id);
      world.seaBound.delete(id);
      world.playerOrders.delete(id);
      world.out.emit(world.tick, EventKind.MoveRejected, id, c.nation[id]!, RejectReason.Contact, NaN);
    }
  }
}
