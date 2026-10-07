/**
 * Tick orchestration (SPEC §2.5). Systems run in a fixed order; each is `(world) => void`
 * and reads no wall-clock time, render state or subscriptions.
 */
import { finiteCommand, Refusal, type Command } from '../shared/commands';
import { EventKind } from '../shared/events';
import { destroyFormation, equipFormation } from './systems/elements';
import { declareWar, makePeace, offerPeace, whyNotWar } from './systems/war';
import { canJoin, leaveAlliance, noWarAmong, proposeAlliance } from './systems/alliances';
import { annexNation, makePuppet, releasePuppet } from './systems/puppets';
import { removeCity, setCapital, setCore, spawnCity } from './scenarioEdit';
import { collapseNation, reviveOnCores, whyNotKill, whyNotRevive } from './systems/revival';
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
 * (x2, y2) the brush is stamped at every cell step of the segment to it (PLAN 1.44b), so no cell
 * under the segment is skipped. The command of an occupation: the God brush paints the owner
 * too, with `editPaint` (ADR-118).
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

/** Why a command may not set a value of nation `n`: it is not there. A dead nation keeps its name, flag, gold and settings for a revival. */
function whyNoNation(world: World, n: number): Refusal {
  return world.nations.has(n) ? Refusal.None : Refusal.NoNation;
}

/** Why a command may not name nation `n` as one that acts or is acted on: it is not there, or it is dead. */
function whyNotNation(world: World, n: number): Refusal {
  if (!world.nations.has(n)) return Refusal.NoNation;
  return world.nations.cols.living[n] === 1 ? Refusal.None : Refusal.DeadNation;
}

/**
 * Carries out `cmd`, or says why not (PLAN 2.17a). A command that is refused leaves the state as
 * it was. The offers of a player (`offerPeace`, `proposeAlliance`), an order to march and an
 * order to build have events of their own for a "no" and count as carried out here.
 */
function applyCommand(world: World, cmd: Command): Refusal {
  if (!finiteCommand(cmd)) return Refusal.NotANumber;
  const done = (ok: boolean, why: Refusal = Refusal.NoEffect): Refusal => (ok ? Refusal.None : why);
  switch (cmd.kind) {
    case 'spawnFormation': {
      const why = whyNotNation(world, cmd.nation);
      if (why) return why;
      const f = world.formations;
      const id = f.create();
      f.cols.nation[id] = cmd.nation;
      // On land by the fine mask (PLAN 2.9a): a place given on the water of a coastal cell is the cell's land point.
      [f.cols.x[id], f.cols.y[id]] = world.standPoint(cmd.x, cmd.y);
      f.cols.strength[id] = cmd.strength;
      f.cols.org[id] = 1;
      // Of a scenario template (PLAN 2.5): with its elements, as production delivers one.
      if (cmd.template !== undefined && world.rules?.templates[cmd.template]) {
        f.cols.template[id] = cmd.template;
        f.cols.supply[id] = 1;
        equipFormation(world, id, cmd.template); // sets strength from the elements
      }
      return Refusal.None;
    }
    case 'removeFormation':
      if (!world.formations.has(cmd.id)) return Refusal.NoSuch;
      destroyFormation(world, cmd.id); // with its elements and cached path
      return Refusal.None;
    case 'queueFormation':
      queueFormation(world, cmd.nation, cmd.template);
      return Refusal.None;
    case 'moveFormation':
      // A player's order names its nation: the id may be another nation's formation by now (PLAN 2.16Rk).
      if (cmd.nation !== undefined && (!world.formations.has(cmd.id) || world.formations.cols.nation[cmd.id] !== cmd.nation)) return Refusal.NoSuch;
      // On the retreat it takes no order (PLAN 3.7m, ADR-173): its march is held by no enemy's ground, and it is in no battle.
      if (world.formations.has(cmd.id) && world.formations.cols.retreat[cmd.id]! > 0) return Refusal.OnRetreat;
      orderMove(world, cmd.id, cmd.x, cmd.y);
      return Refusal.None;
    case 'setSetting':
      if (cmd.key === 'winnerTakesAll') world.settings.winnerTakesAll = cmd.value;
      else if (cmd.key === 'revoltMode') world.settings.revoltMode = cmd.value;
      else if (cmd.key === 'ceMode') world.settings.ceMode = cmd.value;
      else world.settings.aiEnabled = cmd.value;
      return Refusal.None;
    case 'setEfficiency': {
      const why = whyNoNation(world, cmd.nation);
      if (!why) world.nations.cols.efficiency[cmd.nation] = Math.max(MIN_CE, Math.min(MAX_CE, cmd.value));
      return why;
    }
    case 'lockEfficiency': {
      const why = whyNoNation(world, cmd.nation);
      if (!why) world.nations.cols.ceLocked[cmd.nation] = cmd.locked ? 1 : 0;
      return why;
    }
    case 'setSuppression': {
      const why = whyNoNation(world, cmd.nation);
      if (!why) world.nations.cols.suppression[cmd.nation] = Math.max(0, Math.min(1, cmd.level));
      return why;
    }
    case 'grantBuff': {
      if (!(cmd.hours > 0)) return Refusal.NoEffect;
      const b = world.buffs.add({ targetKind: cmd.targetKind, target: cmd.target, kind: cmd.buff, magnitude: cmd.magnitude, expiresTick: world.tick + Math.ceil(cmd.hours), nameKey: cmd.nameKey });
      world.out.emit(world.tick, EventKind.BuffGranted, b.id, b.target, NaN, NaN);
      return Refusal.None;
    }
    case 'removeBuff': {
      const b = world.buffs.remove(cmd.id);
      if (!b) return Refusal.NoSuch;
      world.out.emit(world.tick, EventKind.BuffExpired, b.id, b.target, NaN, NaN);
      return Refusal.None;
    }
    case 'forceBreakthrough': {
      const why = whyNotNation(world, cmd.nation);
      if (why) return why;
      const id = world.battles.nextId++;
      world.battles.history.push({ tick: world.tick, kind: EventKind.MajorBattleEnded, a: id, b: cmd.nation, x: cmd.x, y: cmd.y });
      world.out.emit(world.tick, EventKind.MajorBattleEnded, id, cmd.nation, cmd.x, cmd.y);
      addCorridor(world, cmd.nation, cmd.x, cmd.y, cmd.toX - cmd.x, cmd.toY - cmd.y);
      return Refusal.None;
    }
    case 'setAi': {
      const why = whyNoNation(world, cmd.nation);
      if (!why) world.nations.cols.aiOff[cmd.nation] = cmd.enabled ? 0 : 1;
      return why;
    }
    case 'reviveNation':
      return whyNotRevive(world, cmd.nation) || done(reviveOnCores(world, cmd.nation));
    case 'collapseNation': {
      const why = whyNotNation(world, cmd.nation) || whyNotKill(world, cmd.nation);
      if (!why) collapseNation(world, cmd.nation, true); // God Mode Kill: everything fragments
      return why;
    }
    case 'setUnrest':
      if (!(cmd.province > 0 && cmd.province < world.provinces.count)) return Refusal.NoSuch;
      world.provinces.unrest[cmd.province] = Math.max(0, Math.min(100, cmd.value));
      world.provinces.version++;
      return Refusal.None;
    case 'paintControl': {
      const why = whyNotNation(world, cmd.nation);
      if (!why) paintControl(world, cmd.nation, cmd.x, cmd.y, cmd.r, cmd.x2, cmd.y2);
      return why;
    }
    case 'declareWar': {
      const why = whyNotWar(world, cmd.attacker, cmd.defender);
      declareWar(world, cmd.attacker, cmd.defender); // a refused one has its event (`WarRejected`)
      return why;
    }
    case 'forcePeace': {
      const war = world.wars.list.find((w) => w.id === cmd.war);
      if (!war) return Refusal.NoSuch;
      makePeace(world, war);
      return Refusal.None;
    }
    case 'createAlliance': {
      const all = [cmd.leader, ...cmd.members];
      for (const m of all) {
        const why = whyNotNation(world, m);
        if (why) return why;
      }
      if (all.some((m) => world.alliances.allianceOf(m) !== undefined)) return Refusal.InAlliance;
      if (!noWarAmong(world, all)) return Refusal.AtWar;
      const a = world.alliances.create(cmd.leader, cmd.members, cmd.nameKey, 50);
      if (!a) return Refusal.NoEffect;
      for (const m of a.members) world.out.emit(world.tick, EventKind.AllianceJoined, m, a.id, NaN, NaN);
      return Refusal.None;
    }
    case 'joinAlliance': {
      const a = world.alliances.list.find((x) => x.id === cmd.alliance);
      if (!a) return Refusal.NoSuch;
      const why = whyNotNation(world, cmd.nation);
      if (why) return why;
      if (world.alliances.allianceOf(cmd.nation) !== undefined) return Refusal.InAlliance;
      if (!canJoin(world, cmd.nation, a)) return Refusal.AtWar;
      if (!world.alliances.join(cmd.nation, a)) return Refusal.NoEffect;
      world.out.emit(world.tick, EventKind.AllianceJoined, cmd.nation, a.id, NaN, NaN);
      return Refusal.None;
    }
    case 'leaveAlliance':
      if (world.alliances.allianceOf(cmd.nation) === undefined) return Refusal.NoAlliance;
      leaveAlliance(world, cmd.nation);
      return Refusal.None;
    case 'setUnity': {
      const a = world.alliances.list.find((x) => x.id === cmd.alliance);
      if (!a) return Refusal.NoSuch;
      a.unity = Math.max(0, Math.min(100, cmd.value));
      return Refusal.None;
    }
    case 'setLoyalty': {
      const a = world.alliances.allianceOf(cmd.nation);
      if (!a) return Refusal.NoAlliance;
      a.loyalty[a.members.indexOf(cmd.nation)] = Math.max(0, Math.min(100, cmd.value));
      return Refusal.None;
    }
    case 'createPuppet': {
      const why = whyNotNation(world, cmd.overlord) || whyNotNation(world, cmd.subject);
      if (why) return why;
      if (cmd.overlord === cmd.subject) return Refusal.SameNation;
      return done(makePuppet(world, cmd.overlord, cmd.subject, cmd.autonomy), Refusal.Subject);
    }
    case 'releasePuppet':
      if (!world.nations.has(cmd.subject)) return Refusal.NoNation;
      if (world.nations.cols.overlord[cmd.subject] === 0) return Refusal.NoEffect;
      releasePuppet(world, cmd.subject);
      return Refusal.None;
    case 'setAutonomy': {
      const why = whyNoNation(world, cmd.subject);
      if (!why) world.nations.cols.autonomy[cmd.subject] = Math.max(0, Math.min(100, cmd.value));
      return why;
    }
    case 'setPuppetLoyalty': {
      const why = whyNoNation(world, cmd.subject);
      if (!why) world.nations.cols.loyalty[cmd.subject] = Math.max(0, Math.min(100, cmd.value));
      return why;
    }
    case 'renameNation': {
      const why = whyNoNation(world, cmd.nation);
      if (why) return why;
      const name = cmd.name.trim().slice(0, MAX_NAME);
      // The empty name gives back the scenario's name, or that of the province the nation was
      // founded in. A nation with neither keeps the name it has (PLAN 2.17e1).
      if (name === '' && cmd.nation > (world.rules?.namedNations ?? 0) && world.nations.cols.origin[cmd.nation] === 0) return Refusal.NoOtherName;
      if (name === '') world.names.delete(cmd.nation);
      else world.names.set(cmd.nation, name);
      world.namesVersion++;
      return Refusal.None;
    }
    case 'spawnRevolt':
      return done(forceRevolt(world, cmd.province));
    case 'setIncomeBonus': {
      const why = whyNoNation(world, cmd.nation);
      if (!why) world.nations.cols.incomeBonus[cmd.nation] = Math.round(Math.max(-100, Math.min(100, cmd.value)));
      return why;
    }
    case 'setPlayer': {
      const nc = world.nations.cols;
      const prev = world.settings.player;
      const why = cmd.nation === 0 ? Refusal.None : whyNotNation(world, cmd.nation);
      if (why) return why;
      if (prev !== 0 && world.nations.has(prev)) nc.aiOff[prev] = 0;
      if (cmd.nation !== 0) nc.aiOff[cmd.nation] = 1;
      world.settings.player = cmd.nation;
      return Refusal.None;
    }
    case 'spawnCity':
      return done(spawnCity(world, cmd.x, cmd.y, cmd.name, cmd.size) !== 0);
    case 'removeCity':
      return done(removeCity(world, cmd.city), Refusal.NoSuch);
    case 'setCapital':
      return done(setCapital(world, cmd.nation, cmd.city));
    case 'setGold': {
      const why = whyNoNation(world, cmd.nation);
      if (!why) world.nations.cols.gold[cmd.nation] = cmd.value;
      return why;
    }
    case 'setCore':
      return done(setCore(world, cmd.province, cmd.nation, cmd.on));
    case 'annexNation': {
      const why = whyNotNation(world, cmd.annexer) || whyNotNation(world, cmd.target);
      if (why) return why;
      return done(annexNation(world, cmd.annexer, cmd.target), Refusal.SameNation);
    }
    case 'setFlag': {
      const why = whyNoNation(world, cmd.nation);
      if (why) return why;
      if (cmd.runs.length === 0) world.flags.delete(cmd.nation);
      else {
        const px = decodeRunsU32(cmd.runs, FLAG_W * FLAG_H);
        if (!px) return Refusal.NoEffect;
        world.flags.set(cmd.nation, px);
      }
      world.flagsVersion++;
      return Refusal.None;
    }
    case 'editPaint': {
      // Land for a dead nation would be land of no living state: 0 (no nation) may be painted.
      const why = cmd.layer === 'nation' && cmd.value !== 0 ? whyNotNation(world, cmd.value) : Refusal.None;
      if (!why) paint(world, cmd.layer, cmd.tool, cmd.x, cmd.y, cmd.x2, cmd.y2, cmd.r, cmd.value, cmd.mask, cmd.stroke);
      return why;
    }
    case 'importLayer': {
      const values = decodeRuns(cmd.runs, world.cells.w * world.cells.h);
      if (!values) return Refusal.NoEffect;
      importLayer(world, cmd.layer, values);
      return Refusal.None;
    }
    case 'editUndo':
      undoEdit(world);
      return Refusal.None;
    case 'editRedo':
      redoEdit(world);
      return Refusal.None;
    case 'offerPeace':
      offerPeace(world, cmd.war, cmd.from);
      return Refusal.None;
    case 'proposeAlliance':
      proposeAlliance(world, cmd.from, cmd.to);
      return Refusal.None;
    case 'setWarFightToDeath': {
      const war = world.wars.list.find((w) => w.id === cmd.war);
      if (!war) return Refusal.NoSuch;
      war.fightToDeath[cmd.side] = cmd.value;
      return Refusal.None;
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
    // After the command's own events: which of the two it is, is known only then (PLAN 2.17a).
    const why = applyCommand(world, cmd);
    world.out.emit(world.tick, why === Refusal.None ? EventKind.CommandApplied : EventKind.CommandRefused, seq, why, NaN, NaN);
  }
}

/** Advances the world by one tick using `systems` after command application. */
export function step(world: World, systems: readonly System[]): void {
  applyPendingCommands(world);
  for (const s of systems) s(world);
  world.tick++;
}
