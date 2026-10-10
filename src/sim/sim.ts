/**
 * Sim facade: the one entry point used by the worker, Node tools and tests (ADR-2), so
 * every host runs exactly the same code path.
 */
import type { Command } from '../shared/commands';
import type { ScenarioId, SimInit } from '../shared/protocol';
import { loadBytes, saveBytes, stateHash } from './core/state';
import { applyPendingCommands, step, type System } from './tick';
import { BUILD_MIX_1938, createWorld1938, ECONOMY_TABLES_1938 } from './scenario1938';
import { allianceSystem } from './systems/alliances';
import { economicAi } from './ai/economic';
import { operationalAiOf } from './ai/operational';
import { strategicAi } from './ai/strategic';
import { buffSystem } from './systems/buffs';
import { efficiencySystem } from './systems/efficiency';
import { capitalsSystem } from './systems/capitals';
import { combatSystem } from './systems/combat';
import { navalCombatSystem } from './systems/navalCombat';
import { movementSystem, repatriationSystem } from './systems/movement';
import { productionSystem } from './systems/production';
import { researchSystem } from './systems/research';
import { puppetSystem } from './systems/puppets';
import { collapseSystem } from './systems/revival';
import { statsSystem } from './stats';
import { applyGameOptions } from './gameOptions';
import { revoltSystem } from './systems/revolts';
import { orgLossSystem, retreatSystem } from './systems/retreat';
import { supplySystem } from './systems/supply';
import { territorySystem } from './systems/territory';
import { warSystem } from './systems/war';
import { economySystem } from './systems/economy';
import { createRandomWorld } from './randomWorld';
import { createToyWorld, TOY_SYSTEMS } from './toy';
import type { World } from './world';

/** The systems of the 1938 rules by name, in their order (several are closures without one). */
const SYSTEM_NAMES_1938 = ['buffs', 'strategicAi', 'operationalAi', 'production', 'research', 'economicAi', 'economy', 'efficiency', 'supply', 'repatriation', 'movement', 'retreat', 'combat', 'navalCombat', 'orgLoss', 'territory', 'capitals', 'war', 'alliances', 'puppets', 'revolts', 'collapse', 'stats'] as const;

/** A call of a system that takes this long is counted as a slow one (`SystemProfile.slow`). */
export const SLOW_CALL_MS = 1;

/** What each system has cost since the profile was started or last cleared (PLAN 3.10a). Not state: in no save and no hash. */
export interface SystemProfile {
  readonly names: readonly string[];
  /** Milliseconds in all calls. */
  readonly ms: Float64Array;
  /** The longest call. */
  readonly max: Float64Array;
  /** Calls of `SLOW_CALL_MS` or more, and the milliseconds in them: a system that is dear on some ticks only. */
  readonly slow: Float64Array;
  readonly slowMs: Float64Array;
}

export class Sim {
  readonly world: World;
  private systems: readonly System[];
  /** A name for each of `systems`, for a profile. */
  private readonly systemNames: readonly string[];
  /** The scenario the world was made as; a load keeps it (a save is of the same scenario). */
  readonly scenario: ScenarioId;

  constructor(init: SimInit) {
    this.scenario = init.scenario;
    switch (init.scenario) {
      case 'toy':
        this.world = createToyWorld(init.seed);
        this.systems = TOY_SYSTEMS;
        this.systemNames = TOY_SYSTEMS.map((s) => s.name);
        break;
      case '1938':
      case 'random':
        if (!init.assets) throw new Error(`scenario '${init.scenario}' needs its map assets`);
        // The random world has the map, the units and the rules of 1938, and nations of its own.
        this.world = init.scenario === '1938' ? createWorld1938(init.seed, init.assets) : createRandomWorld(init.seed, init.options?.nations, init.assets);
        if (init.options) applyGameOptions(this.world, init.options);
        // SPEC §2.5 order: production and economy (3), supply (4), land movement (7),
        // engagement and combat (8), territory (9).
        // AI decides first (SPEC §2.5 step 2), on the state left by the previous tick.
        this.systems = [buffSystem, strategicAi, operationalAiOf(ECONOMY_TABLES_1938), productionSystem, researchSystem, economicAi(ECONOMY_TABLES_1938, BUILD_MIX_1938), economySystem(ECONOMY_TABLES_1938), efficiencySystem, supplySystem, repatriationSystem, movementSystem, retreatSystem, combatSystem, navalCombatSystem, orgLossSystem, territorySystem, capitalsSystem, warSystem, allianceSystem, puppetSystem, revoltSystem, collapseSystem, statsSystem];
        this.systemNames = SYSTEM_NAMES_1938;
        break;
    }
  }

  get tick(): number {
    return this.world.tick;
  }

  /**
   * Advances n ticks. `afterTick` runs after each tick to consume derived outputs (events,
   * dirty tiles); without it, events are discarded each tick so headless runs stay bounded.
   */
  /**
   * Applies queued commands now, without advancing (PLAN 1.32b: God actions while paused). They
   * are stamped with the current tick, exactly as the next step would apply them, so saves and
   * replays are unchanged. `after` consumes derived outputs as in `step`.
   */
  applyNow(after?: (world: World) => void): void {
    applyPendingCommands(this.world);
    if (after) after(this.world);
    else {
      this.world.out.events.length = 0;
      this.world.out.fires.length = 0;
    }
  }

  /**
   * Times every system from now on with the clock `now` and returns the tallies, which the caller
   * reads and clears. The systems run as before: a profiled game is the same game.
   */
  profile(now: () => number): SystemProfile {
    const n = this.systems.length;
    const p: SystemProfile = { names: this.systemNames, ms: new Float64Array(n), max: new Float64Array(n), slow: new Float64Array(n), slowMs: new Float64Array(n) };
    this.systems = this.systems.map((s, i) => (world: World) => {
      const t0 = now();
      s(world);
      const dt = now() - t0;
      p.ms[i]! += dt;
      if (dt > p.max[i]!) p.max[i] = dt;
      if (dt >= SLOW_CALL_MS) {
        p.slow[i]!++;
        p.slowMs[i]! += dt;
      }
    });
    return p;
  }

  step(n = 1, afterTick?: (world: World) => void): void {
    for (let i = 0; i < n; i++) {
      step(this.world, this.systems);
      if (afterTick) afterTick(this.world);
      else {
        this.world.out.events.length = 0;
        this.world.out.fires.length = 0;
      }
    }
  }

  /** Queues `cmd`; false when it is of a kind the sim does not know and was refused (`World.enqueue`). */
  command(cmd: Command): boolean {
    return this.world.enqueue(cmd);
  }

  hash(): number {
    return stateHash(this.world.parts());
  }

  save(): Uint8Array {
    return saveBytes(this.world.parts());
  }

  /**
   * The world as a scenario (PLAN 1.38): the same state with its run history dropped (command log
   * and pending commands, history log, statistics, editor undo stack), so a shared scenario starts
   * clean at its date. The running game is left as it was. Returns the state bytes and their hash.
   */
  exportScenario(): { bytes: Uint8Array; hash: number } {
    const w = this.world;
    const keep = { log: w.commandLog, pending: w.pending, history: w.history.rows, stats: w.stats.rows, undo: w.edits.undo, redo: w.edits.redo };
    w.commandLog = [];
    w.pending = [];
    w.history.rows = [];
    w.stats.rows = [];
    w.edits.undo = [];
    w.edits.redo = [];
    try {
      return { bytes: this.save(), hash: this.hash() };
    } finally {
      w.commandLog = keep.log;
      w.pending = keep.pending;
      w.history.rows = keep.history;
      w.stats.rows = keep.stats;
      w.edits.undo = keep.undo;
      w.edits.redo = keep.redo;
    }
  }

  /** Replaces the state with a save produced by a Sim of the same scenario and map size. */
  load(bytes: Uint8Array): void {
    loadBytes(this.world.parts(), bytes);
  }
}
