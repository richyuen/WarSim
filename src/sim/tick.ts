/**
 * Tick orchestration (SPEC §2.5). Systems run in a fixed order; each is `(world) => void`
 * and reads no wall-clock time, render state or subscriptions.
 */
import type { Command } from '../shared/commands';
import { EventKind } from '../shared/events';
import { destroyFormation, equipFormation } from './systems/elements';
import { declareWar, makePeace, offerPeace } from './systems/war';
import { canJoin, leaveAlliance, noWarAmong, proposeAlliance } from './systems/alliances';
import { annexNation, makePuppet, releasePuppet } from './systems/puppets';
import { removeCity, setCapital, setCore, spawnCity } from './scenarioEdit';
import { collapseNation, reviveOnCores } from './systems/revival';
import { MAX_CE, MIN_CE } from './systems/efficiency';
import { addCorridor } from './systems/majorBattles';
import { orderMove } from './systems/movement';
import { queueFormation } from './systems/production';
import { forceRevolt } from './systems/revolts';
import { importLayer, paint, redoEdit, undoEdit } from './editor';
import { decodeRuns, decodeRunsU32 } from '../shared/mapImport';
import { FLAG_H, FLAG_W } from '../shared/flagPixels';
import type { World } from './world';

export type System = (world: World) => void;

/** Longest custom nation name (God Mode rename). */
const MAX_NAME = 40;

/**
 * Sets the controller of land cells within r cells of (x, y) (wrapping x; water untouched). With
 * (x2, y2) the brush is stamped at every cell step of the segment to it (a dragged God brush,
 * PLAN 1.44b), so no cell under the segment is skipped.
 */
function paintControl(world: World, nation: number, x: number, y: number, r: number, x2 = x, y2 = y): void {
  const { w, h, terrain } = world.cells;
  if (nation !== 0 && !world.nations.has(nation)) return;
  const rr = Math.min(Math.max(0, r), 64);
  // One stamp per cell of the longer axis; a segment longer than the map is cut to its size.
  const steps = Math.min(Math.ceil(Math.max(Math.abs(x2 - x), Math.abs(y2 - y))), w + h);
  for (let i = 0; i <= steps; i++) {
    const px = steps === 0 ? x : x + ((x2 - x) * i) / steps;
    const py = steps === 0 ? y : y + ((y2 - y) * i) / steps;
    for (let dy = Math.ceil(-rr); dy <= rr; dy++) {
      const cy = Math.floor(py + dy);
      if (cy < 0 || cy >= h) continue;
      for (let dx = Math.ceil(-rr); dx <= rr; dx++) {
        if (dx * dx + dy * dy > rr * rr) continue;
        const cell = cy * w + ((Math.floor(px + dx) % w) + w) % w;
        if (terrain[cell] !== 0) world.setController(cell, nation);
      }
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
      // On land by the fine mask (PLAN 2.9a): a place given on the water of a coastal cell is the cell's land point.
      [f.cols.x[id], f.cols.y[id]] = world.standPoint(cmd.x, cmd.y);
      f.cols.strength[id] = cmd.strength;
      // Of a scenario template (PLAN 2.5): with its elements, as production delivers one.
      if (cmd.template !== undefined && world.rules?.templates[cmd.template]) {
        f.cols.template[id] = cmd.template;
        f.cols.supply[id] = 1;
        equipFormation(world, id, cmd.template); // sets strength from the elements
      }
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
      else if (cmd.key === 'revoltMode') world.settings.revoltMode = cmd.value;
      else if (cmd.key === 'ceMode') world.settings.ceMode = cmd.value;
      else world.settings.aiEnabled = cmd.value;
      return;
    case 'setEfficiency':
      if (world.nations.has(cmd.nation)) world.nations.cols.efficiency[cmd.nation] = Math.max(MIN_CE, Math.min(MAX_CE, cmd.value));
      return;
    case 'lockEfficiency':
      if (world.nations.has(cmd.nation)) world.nations.cols.ceLocked[cmd.nation] = cmd.locked ? 1 : 0;
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
    case 'forceBreakthrough': {
      if (!world.nations.has(cmd.nation)) return;
      const id = world.battles.nextId++;
      world.battles.history.push({ tick: world.tick, kind: EventKind.MajorBattleEnded, a: id, b: cmd.nation, x: cmd.x, y: cmd.y });
      world.out.emit(world.tick, EventKind.MajorBattleEnded, id, cmd.nation, cmd.x, cmd.y);
      addCorridor(world, cmd.nation, cmd.x, cmd.y, cmd.toX - cmd.x, cmd.toY - cmd.y);
      return;
    }
    case 'setAi':
      if (world.nations.has(cmd.nation)) world.nations.cols.aiOff[cmd.nation] = cmd.enabled ? 0 : 1;
      return;
    case 'reviveNation':
      reviveOnCores(world, cmd.nation);
      return;
    case 'collapseNation':
      collapseNation(world, cmd.nation, true); // God Mode Kill: everything fragments
      return;
    case 'setUnrest':
      if (cmd.province > 0 && cmd.province < world.provinces.count) {
        world.provinces.unrest[cmd.province] = Math.max(0, Math.min(100, cmd.value));
        world.provinces.version++;
      }
      return;
    case 'paintControl':
      paintControl(world, cmd.nation, cmd.x, cmd.y, cmd.r, cmd.x2, cmd.y2);
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
      if (!noWarAmong(world, [cmd.leader, ...cmd.members])) return;
      const a = world.alliances.create(cmd.leader, cmd.members, cmd.nameKey, 50);
      if (a) for (const m of a.members) world.out.emit(world.tick, EventKind.AllianceJoined, m, a.id, NaN, NaN);
      return;
    }
    case 'joinAlliance': {
      const a = world.alliances.list.find((x) => x.id === cmd.alliance);
      if (a && world.nations.has(cmd.nation) && canJoin(world, cmd.nation, a) && world.alliances.join(cmd.nation, a)) world.out.emit(world.tick, EventKind.AllianceJoined, cmd.nation, a.id, NaN, NaN);
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
    case 'renameNation': {
      if (!world.nations.has(cmd.nation)) return;
      const name = cmd.name.trim().slice(0, MAX_NAME);
      if (name === '') world.names.delete(cmd.nation);
      else world.names.set(cmd.nation, name);
      world.namesVersion++;
      return;
    }
    case 'spawnRevolt':
      forceRevolt(world, cmd.province);
      return;
    case 'setIncomeBonus':
      if (world.nations.has(cmd.nation)) world.nations.cols.incomeBonus[cmd.nation] = Math.round(Math.max(-100, Math.min(100, cmd.value)));
      return;
    case 'setPlayer': {
      const nc = world.nations.cols;
      const prev = world.settings.player;
      if (cmd.nation !== 0 && (!world.nations.has(cmd.nation) || nc.living[cmd.nation] !== 1)) return;
      if (prev !== 0 && world.nations.has(prev)) nc.aiOff[prev] = 0;
      if (cmd.nation !== 0) nc.aiOff[cmd.nation] = 1;
      world.settings.player = cmd.nation;
      return;
    }
    case 'spawnCity':
      spawnCity(world, cmd.x, cmd.y, cmd.name, cmd.size);
      return;
    case 'removeCity':
      removeCity(world, cmd.city);
      return;
    case 'setCapital':
      setCapital(world, cmd.nation, cmd.city);
      return;
    case 'setGold':
      if (world.nations.has(cmd.nation) && Number.isFinite(cmd.value)) world.nations.cols.gold[cmd.nation] = cmd.value;
      return;
    case 'setCore':
      setCore(world, cmd.province, cmd.nation, cmd.on);
      return;
    case 'annexNation':
      annexNation(world, cmd.annexer, cmd.target);
      return;
    case 'setFlag': {
      if (!world.nations.has(cmd.nation)) return;
      if (cmd.runs.length === 0) world.flags.delete(cmd.nation);
      else {
        const px = decodeRunsU32(cmd.runs, FLAG_W * FLAG_H);
        if (!px) return;
        world.flags.set(cmd.nation, px);
      }
      world.flagsVersion++;
      return;
    }
    case 'editPaint':
      paint(world, cmd.layer, cmd.tool, cmd.x, cmd.y, cmd.x2, cmd.y2, cmd.r, cmd.value, cmd.mask, cmd.stroke);
      return;
    case 'importLayer': {
      const values = decodeRuns(cmd.runs, world.cells.w * world.cells.h);
      if (values) importLayer(world, cmd.layer, values);
      return;
    }
    case 'editUndo':
      undoEdit(world);
      return;
    case 'editRedo':
      redoEdit(world);
      return;
    case 'offerPeace':
      offerPeace(world, cmd.war, cmd.from);
      return;
    case 'proposeAlliance':
      proposeAlliance(world, cmd.from, cmd.to);
      return;
    case 'setWarFightToDeath': {
      const war = world.wars.list.find((w) => w.id === cmd.war);
      if (war) war.fightToDeath[cmd.side] = cmd.value;
      return;
    }
    default: {
      // Every kind has its case: one without does not compile (PLAN 2.12b).
      const unhandled: never = cmd;
      return unhandled;
    }
  }
}

/** Step 1 of §2.5: apply queued commands in arrival order, stamped with the current tick. */
export function applyPendingCommands(world: World): void {
  if (world.pending.length === 0) return;
  const queue = world.pending;
  world.pending = [];
  // A command may move, make or end a formation: where the blocks of those in contact stand is
  // worked out again from the state (`contactsOf`, `deployOf`; derived, not state).
  world.contacts = null;
  world.deployed = null;
  world.deployedBefore = null;
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
