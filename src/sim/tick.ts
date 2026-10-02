/**
 * Tick orchestration (SPEC §2.5). Systems run in a fixed order; each is `(world) => void`
 * and reads no wall-clock time, render state or subscriptions.
 */
import type { Command } from '../shared/commands';
import { EventKind } from '../shared/events';
import { queueFormation } from './systems/production';
import type { World } from './world';

export type System = (world: World) => void;

function applyCommand(world: World, cmd: Command): void {
  switch (cmd.kind) {
    case 'spawnFormation': {
      if (!world.nations.has(cmd.nation)) return;
      const f = world.formations;
      const id = f.create();
      f.cols.nation[id] = cmd.nation;
      f.cols.x[id] = cmd.x;
      f.cols.y[id] = cmd.y;
      f.cols.strength[id] = cmd.strength;
      return;
    }
    case 'removeFormation':
      if (world.formations.has(cmd.id)) world.formations.remove(cmd.id);
      return;
    case 'queueFormation':
      queueFormation(world, cmd.nation, cmd.template);
      return;
  }
}

/** Step 1 of §2.5: apply queued commands in arrival order, stamped with the current tick. */
export function applyPendingCommands(world: World): void {
  if (world.pending.length === 0) return;
  const queue = world.pending;
  world.pending = [];
  queue.sort((a, b) => a.seq - b.seq);
  for (const { seq, cmd } of queue) {
    world.commandLog.push({ tick: world.tick, seq, cmd });
    world.out.emit(world.tick, EventKind.CommandApplied, seq, 0, NaN, NaN);
    applyCommand(world, cmd);
  }
}

/** Advances the world by one tick using `systems` after command application. */
export function step(world: World, systems: readonly System[]): void {
  applyPendingCommands(world);
  for (const s of systems) s(world);
  world.tick++;
}
