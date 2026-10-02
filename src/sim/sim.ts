/**
 * Sim facade: the one entry point used by the worker, Node tools and tests (ADR-2), so
 * every host runs exactly the same code path.
 */
import type { Command } from '../shared/commands';
import type { SimInit } from '../shared/protocol';
import { loadBytes, saveBytes, stateHash } from './core/state';
import { run, type System } from './tick';
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
    }
  }

  get tick(): number {
    return this.world.tick;
  }

  step(n = 1): void {
    run(this.world, this.systems, n);
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
