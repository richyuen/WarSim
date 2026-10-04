import { expect, test } from '@playwright/test';
import type {} from '../../src/app/testApi';

// PLAN 2.7h (ADR-74, finding 3): the sprites keep their clock when a snapshot repeats a tick.
// Between two ticks the element sprites and figures walk from where the tick before had them to
// where this one has them (`tickProgress`, 0–1). A new subscription (a pan), a pause and a change
// of speed each make the worker send the tick in hand again, and the view started the walk again
// from 0: sprites jumped back and walked the tick a second time. At one tick a second that is a
// second of walking, twice.

test('a snapshot of the tick in hand does not send the sprites back', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/?scenario=toy&paused=1');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && (window.__warsim?.hud.worker.value ?? null) !== null, null, { timeout: 60_000 });

  const got = await page.evaluate(async () => {
    const { sim } = window.__warsim!;
    const v = window.__warsim!.view!;
    const until = async (what: string, test: () => boolean, ms: number): Promise<void> => {
      const end = performance.now() + ms;
      while (!test()) {
        if (performance.now() > end) throw new Error(`waited ${ms} ms for ${what}`);
        await new Promise((done) => setTimeout(done, 4));
      }
    };
    /** Waits for the next tick, then until the sprites are `p` of the way through it. */
    const into = async (p: number): Promise<number> => {
      const tick = v.lastTick;
      await until('the next tick', () => v.lastTick !== tick, 5000);
      await until(`${p} of the tick`, () => v.tickProgress() >= p, 5000);
      return v.lastTick;
    };

    sim.setSpeed(1); // one tick a second
    sim.setPaused(false);

    // 1. A pan in the middle of a tick: the view subscribes to its new box, the worker answers
    //    with the tick in hand. (If the next tick comes first, the try does not count.)
    let pan: { before: number; after: number } | null = null;
    for (let i = 0; i < 6 && !pan; i++) {
      const tick = await into(0.3);
      const before = v.tickProgress();
      const snapshots = v.snapshots;
      const c = v.controller.cam;
      v.controller.set({ cx: c.cx + 3, cy: c.cy, scale: c.scale });
      await until('the answer to the new subscription', () => v.snapshots > snapshots, 3000);
      if (v.lastTick === tick) pan = { before, after: v.tickProgress() };
    }

    // 2. Another speed in the middle of a tick: the same tick again, with another length.
    let speed: { before: number; after: number } | null = null;
    for (let i = 0; i < 6 && !speed; i++) {
      sim.setSpeed(1);
      const tick = await into(0.3);
      const before = v.tickProgress();
      const snapshots = v.snapshots;
      sim.setSpeed(3);
      await until('the answer to the new speed', () => v.snapshots > snapshots, 3000);
      if (v.lastTick === tick) speed = { before, after: v.tickProgress() };
    }

    // 3. A pause in the middle of a tick, and on again: paused, the sprites stand where the tick
    //    has them; on again, with the same tick, they stay there until the next one.
    sim.setSpeed(1);
    let pause: { paused: number; resumed: number } | null = null;
    for (let i = 0; i < 6 && !pause; i++) {
      const tick = await into(0.3);
      let snapshots = v.snapshots;
      sim.setPaused(true);
      await until('the snapshot of the pause', () => v.snapshots > snapshots, 3000);
      const paused = v.tickProgress();
      const pausedTick = v.lastTick;
      snapshots = v.snapshots;
      sim.setPaused(false);
      await until('the snapshot after the pause', () => v.snapshots > snapshots, 3000);
      if (pausedTick === tick && v.lastTick === tick) pause = { paused, resumed: v.tickProgress() };
    }
    sim.setPaused(true);
    return { pan, speed, pause };
  });

  console.log(`sprites' progress through the tick: a pan ${got.pan?.before.toFixed(2)} → ${got.pan?.after.toFixed(2)}; another speed ${got.speed?.before.toFixed(2)} → ${got.speed?.after.toFixed(2)}; paused ${got.pause?.paused.toFixed(2)}, on again ${got.pause?.resumed.toFixed(2)}`);
  expect(got.pan, 'a pan answered within its tick, in six tries').not.toBeNull();
  expect(got.pan!.before).toBeGreaterThanOrEqual(0.3);
  expect(got.pan!.after, 'after a pan').toBeGreaterThanOrEqual(got.pan!.before);
  expect(got.speed, 'a change of speed answered within its tick, in six tries').not.toBeNull();
  expect(got.speed!.after, 'at another speed').toBeGreaterThanOrEqual(got.speed!.before);
  expect(got.pause, 'a pause and its end within one tick, in six tries').not.toBeNull();
  expect(got.pause!.paused, 'paused').toBe(1);
  expect(got.pause!.resumed, 'on again').toBe(1);
});
