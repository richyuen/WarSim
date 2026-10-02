/**
 * Sim facade: the one entry point used by the worker, Node tools and tests (ADR-2), so
 * every host runs exactly the same code path.
 */
import type { Command } from '../shared/commands';
import type { SimInit } from '../shared/protocol';
import { loadBytes, saveBytes, stateHash } from './core/state';
import { step, type System } from './tick';
import { createWorld1938, ECONOMY_TABLES_1938, RULES_1938 } from './scenario1938';
import { allianceSystem } from './systems/alliances';
import { operationalAi } from './ai/operational';
import { strategicAi } from './ai/strategic';
import { buffSystem } from './systems/buffs';
import { efficiencySystem } from './systems/efficiency';
import { capitalsSystem } from './systems/capitals';
import { combatSystem } from './systems/combat';
import { movementSystem } from './systems/movement';
import { productionSystem } from './systems/production';
import { puppetSystem } from './systems/puppets';
import { collapseSystem } from './systems/revival';
import { revoltSystem } from './systems/revolts';
import { supplySystem } from './systems/supply';
import { territorySystem } from './systems/territory';
import { warSystem } from './systems/war';
import { economySystem } from './systems/economy';
import { createToyWorld, TOY_SYSTEMS } from './toy';
import type { World } from './world';

export class Sim {
  readonly world: World;
  private readonly systems: readonly System[];

  constructor(init: SimInit) {
    switch (init.scenario) {
      case 'toy':
        this.world = createToyWorld(init.seed);
        this.systems = TOY_SYSTEMS;
        break;
      case '1938':
        if (!init.assets) throw new Error("scenario '1938' needs its map assets");
        this.world = createWorld1938(init.seed, init.assets);
        this.world.rules = RULES_1938;
        // SPEC §2.5 order: production and economy (3), supply (4), land movement (7),
        // engagement and combat (8), territory (9).
        // AI decides first (SPEC §2.5 step 2), on the state left by the previous tick.
        this.systems = [buffSystem, strategicAi, operationalAi, productionSystem, economySystem(ECONOMY_TABLES_1938), efficiencySystem, supplySystem, movementSystem, combatSystem, territorySystem, capitalsSystem, warSystem, allianceSystem, puppetSystem, revoltSystem, collapseSystem];
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

  command(cmd: Command): void {
    this.world.enqueue(cmd);
  }

  hash(): number {
    return stateHash(this.world.parts());
  }

  save(): Uint8Array {
    return saveBytes(this.world.parts());
  }

  /** Replaces the state with a save produced by a Sim of the same scenario and map size. */
  load(bytes: Uint8Array): void {
    loadBytes(this.world.parts(), bytes);
  }
}
