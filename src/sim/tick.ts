/**
 * Tick orchestration (SPEC §2.5). Systems run in a fixed order; each is `(world) => void`
 * and reads no wall-clock time, render state or subscriptions.
 */
import type { Command } from '../shared/commands';
import { EventKind } from '../shared/events';
import { destroyFormation } from './systems/elements';
import { declareWar, makePeace } from './systems/war';
import { leaveAlliance } from './systems/alliances';
import { makePuppet, releasePuppet } from './systems/puppets';
import { collapseNation, reviveOnCores } from './systems/revival';
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
      if (cmd.key === 'winnerTakesAll') world.settings.winnerTakesAll = cmd.value;
      else world.settings.revoltMode = cmd.value;
      return;
    case 'setSuppression':
      if (world.nations.has(cmd.nation)) world.nations.cols.suppression[cmd.nation] = Math.max(0, Math.min(1, cmd.level));
      return;
    case 'grantBuff': {
      if (!(cmd.hours > 0) || !Number.isFinite(cmd.magnitude)) return;
      const b = world.buffs.add({ targetKind: cmd.targetKind, target: cmd.target, kind: cmd.buff, magnitude: cmd.magnitude, expiresTick: world.tick + Math.ceil(cmd.hours), nameKey: cmd.nameKey });
      world.out.emit(world.tick, EventKind.BuffGranted, b.id, b.target, NaN, NaN);
      return;
    }
    case 'removeBuff': {
      const b = world.buffs.remove(cmd.id);
      if (b) world.out.emit(world.tick, EventKind.BuffExpired, b.id, b.target, NaN, NaN);
      return;
    }
    case 'reviveNation':
      reviveOnCores(world, cmd.nation);
      return;
    case 'collapseNation':
      collapseNation(world, cmd.nation);
      return;
    case 'setUnrest':
      if (cmd.province > 0 && cmd.province < world.provinces.count) world.provinces.unrest[cmd.province] = Math.max(0, Math.min(100, cmd.value));
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
    case 'createAlliance': {
      const a = world.alliances.create(cmd.leader, cmd.members, cmd.nameKey, 50);
      if (a) for (const m of a.members) world.out.emit(world.tick, EventKind.AllianceJoined, m, a.id, NaN, NaN);
      return;
    }
    case 'joinAlliance': {
      const a = world.alliances.list.find((x) => x.id === cmd.alliance);
      if (a && world.nations.has(cmd.nation) && world.alliances.join(cmd.nation, a)) world.out.emit(world.tick, EventKind.AllianceJoined, cmd.nation, a.id, NaN, NaN);
      return;
    }
    case 'leaveAlliance':
      leaveAlliance(world, cmd.nation);
      return;
    case 'setUnity': {
      const a = world.alliances.list.find((x) => x.id === cmd.alliance);
      if (a) a.unity = Math.max(0, Math.min(100, cmd.value));
      return;
    }
    case 'setLoyalty': {
      const a = world.alliances.allianceOf(cmd.nation);
      if (a) a.loyalty[a.members.indexOf(cmd.nation)] = Math.max(0, Math.min(100, cmd.value));
      return;
    }
    case 'createPuppet':
      makePuppet(world, cmd.overlord, cmd.subject, cmd.autonomy);
      return;
    case 'releasePuppet':
      releasePuppet(world, cmd.subject);
      return;
    case 'setAutonomy':
      if (world.nations.has(cmd.subject)) world.nations.cols.autonomy[cmd.subject] = Math.max(0, Math.min(100, cmd.value));
      return;
    case 'setPuppetLoyalty':
      if (world.nations.has(cmd.subject)) world.nations.cols.loyalty[cmd.subject] = Math.max(0, Math.min(100, cmd.value));
      return;
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
