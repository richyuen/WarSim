/**
 * Tick orchestration (SPEC §2.5). Systems run in a fixed order; each is `(world) => void`
 * and reads no wall-clock time, render state or subscriptions.
 */
import type { Command } from '../shared/commands';
import { EventKind } from '../shared/events';
import { destroyFormation } from './systems/elements';
import { declareWar, makePeace } from './systems/war';
import { orderMove } from './systems/movement';
import { queueFormation } from './systems/production';
import type { World } from './world';

export type System = (world: World) => void;

/** Sets the controller of land cells within r cells of (x, y) (wrapping x; water untouched). */
function paintControl(world: World, nation: number, x: number, y: number, r: number): void {
  const { w, h, terrain } = world.cells;
  if (nation !== 0 && !world.nations.has(nation)) return;
  const rr = Math.min(Math.max(0, r), 64);
  for (let dy = Math.ceil(-rr); dy <= rr; dy++) {
    const cy = Math.floor(y + dy);
    if (cy < 0 || cy >= h) continue;
    for (let dx = Math.ceil(-rr); dx <= rr; dx++) {
      if (dx * dx + dy * dy > rr * rr) continue;
      const cell = cy * w + ((Math.floor(x + dx) % w) + w) % w;
      if (terrain[cell] !== 0) world.setController(cell, nation);
    }
  }
}

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
      if (world.formations.has(cmd.id)) destroyFormation(world, cmd.id); // with its elements and cached path
      return;
    case 'queueFormation':
      queueFormation(world, cmd.nation, cmd.template);
      return;
    case 'moveFormation':
      orderMove(world, cmd.id, cmd.x, cmd.y);
      return;
    case 'setSetting':
      world.settings[cmd.key] = cmd.value;
      return;
    case 'paintControl':
      paintControl(world, cmd.nation, cmd.x, cmd.y, cmd.r);
      return;
    case 'declareWar':
      declareWar(world, cmd.attacker, cmd.defender);
      return;
    case 'forcePeace': {
      const war = world.wars.list.find((w) => w.id === cmd.war);
      if (war) makePeace(world, war);
      return;
    }
    case 'setWarFightToDeath': {
      const war = world.wars.list.find((w) => w.id === cmd.war);
      if (war) war.fightToDeath[cmd.side] = cmd.value;
      return;
    }
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
