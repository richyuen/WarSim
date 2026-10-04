import { expect, test } from '@playwright/test';
import type {} from '../../src/app/testApi';
import { Sim } from '../../src/sim/sim';

// I3 (SPEC §2.6): the same seed + commands give the same state hash in Node and in the
// browser's sim worker. Also checks I2/I5 across the worker boundary (save bytes from the
// worker equal Node's, and loading them in Node continues identically).

const SEED = 7;
const TICKS = 24 * 45;
const SPAWN = { kind: 'spawnFormation', nation: 2, x: 30.5, y: 20.25, strength: 4000 } as const;

function nodeRun(): { sim: Sim; mid: number } {
  const sim = new Sim({ scenario: 'toy', seed: SEED });
  sim.step(300);
  sim.command(SPAWN);
  const mid = sim.hash();
  sim.step(TICKS - 300);
  return { sim, mid };
}

test('I3: Node and worker runs produce identical hashes and save bytes', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?scenario=toy&paused=1&view=0');
  await page.waitForFunction(() => window.__warsim !== undefined);

  const browser = await page.evaluate(
    async ({ seed, ticks, spawn }) => {
      const sim = window.__warsim!.sim;
      const init = await sim.init({ scenario: 'toy', seed });
      await sim.step(300);
      sim.command(spawn);
      const mid = await sim.hash();
      const end = await sim.step(ticks - 300);
      const bytes = await sim.save();
      return { init, mid, end, bytes: Array.from(bytes) };
    },
    { seed: SEED, ticks: TICKS, spawn: SPAWN },
  );

  const fresh = new Sim({ scenario: 'toy', seed: SEED });
  expect(browser.init).toEqual({ tick: 0, hash: fresh.hash() });

  const { sim, mid } = nodeRun();
  // The queued command is pending (part of state) at the mid-point in both hosts.
  expect(browser.mid.hash).toBe(mid);
  expect(browser.end).toEqual({ tick: TICKS, hash: sim.hash() });

  const workerBytes = Uint8Array.from(browser.bytes);
  expect(workerBytes).toEqual(sim.save());

  // A worker save loaded in Node continues identically to the Node run.
  const resumed = new Sim({ scenario: 'toy', seed: 0 });
  resumed.load(workerBytes);
  resumed.step(500);
  sim.step(500);
  expect(resumed.hash()).toBe(sim.hash());
  expect(errors).toEqual([]);
});

test('worker reports errors as rejected promises', async ({ page }) => {
  await page.goto('/?scenario=toy&paused=1&view=0');
  await page.waitForFunction(() => window.__warsim !== undefined);
  const message = await page.evaluate(async () => {
    try {
      await window.__warsim!.sim.init({ scenario: 'toy', seed: 1 });
      await window.__warsim!.sim.load(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]));
      return 'no error';
    } catch (e) {
      return (e as Error).message;
    }
  });
  expect(message).toContain('bad magic');
});
