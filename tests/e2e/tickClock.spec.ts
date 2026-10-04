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

    // 3. A pause in the middle of a tick (PLAN 2.7y): the sprites finish the step they are on, at
    //    the tick's length, and then stand where the tick has them. (Until 2.7y a pause put them
    //    at the tick's end in one frame: this test had "paused: 1". Every marching sprite then
    //    jumped by the rest of its step: 14 px for the median one at 100 m/px, 54 for the
    //    furthest, 48 and 181 at 30 m/px.)
    //    One number, `tickProgress`, places every sprite and figure between its two places (the
    //    renderers' interpolation uniform): a bound on its step from frame to frame is a bound on
    //    every sprite's, at every tier.
    sim.setSpeed(1);
    // What each frame draws: its time and the sprites' progress in it.
    const drawn: { now: number; p: number }[] = [];
    const draw = v.draw.bind(v);
    v.draw = (now = performance.now()): void => {
      drawn.push({ now, p: v.tickProgress(now) });
      draw(now);
    };
    let walk: { before: number; ahead: number; behind: number; restMs: number; after: number; onItsWay: boolean; between: number; aheadDrawn: number; lastDrawn: number } | null = null;
    for (let i = 0; i < 12 && !walk; i++) {
      sim.setPaused(false);
      const tick = await into(0.3);
      const t0 = performance.now();
      const before = v.tickProgress(t0);
      const snapshots = v.snapshots;
      const first = Math.max(0, drawn.length - 1); // the last frame drawn before the pause
      sim.setPaused(true);
      await until('the snapshot of the pause', () => v.snapshots > snapshots, 3000);
      const answered = performance.now();
      // A try counts when the pause is answered in its tick with a way still to go, by the clock
      // (on a busy machine the answer can come at the tick's end: 0.98, in a run of the gate).
      if (v.lastTick !== tick || before + (answered - t0) / 1000 > 0.9) continue;
      // The frame of the pause's snapshot, and one asked for straight after it: the sprites are
      // on their way, so the view draws again.
      v.frameAt(performance.now());
      const onItsWay = v.frameAt(performance.now());
      // From before the pause to the tick's end, the progress is the clock: never ahead of the
      // time that passed, and never behind it while there is a way to go.
      let at = t0;
      let last = before;
      let ahead = 0;
      let behind = 0;
      while (last < 1) {
        if (performance.now() - t0 > 3000) throw new Error('paused: the sprites did not reach the end of their step in 3 s');
        const now = performance.now();
        const p = v.tickProgress(now);
        ahead = Math.max(ahead, p - last - (now - at) / 1000);
        if (p < 1) behind = Math.max(behind, (now - at) / 1000 - (p - last));
        last = p;
        at = now;
        if (p < 1) await new Promise((done) => setTimeout(done, 4));
      }
      const restMs = at - t0;
      // The end of the step is what stays on screen: a frame is drawn there, and none after it shows less.
      await until("a frame at the tick's end", () => drawn[drawn.length - 1]!.p === 1, 3000);
      await new Promise((done) => setTimeout(done, 300));
      // The frames: from the last one before the pause to the last one drawn.
      const frames = drawn.slice(first);
      let aheadDrawn = 0;
      for (let k = 1; k < frames.length; k++) aheadDrawn = Math.max(aheadDrawn, frames[k]!.p - frames[k - 1]!.p - (frames[k]!.now - frames[k - 1]!.now) / 1000);
      walk = { before, ahead, behind, restMs, after: v.tickProgress(), onItsWay, between: frames.filter((f) => f.now > answered && f.p < 1).length, aheadDrawn, lastDrawn: frames[frames.length - 1]!.p };
    }

    // 4. A pause in the middle of a tick, and on again at once: the clock runs on through both.
    let again: { before: number; resumed: number; ms: number } | null = null;
    for (let i = 0; i < 6 && !again; i++) {
      sim.setPaused(false);
      const tick = await into(0.3);
      const t0 = performance.now();
      const before = v.tickProgress(t0);
      let snapshots = v.snapshots;
      sim.setPaused(true);
      await until('the snapshot of the pause', () => v.snapshots > snapshots, 3000);
      const pausedTick = v.lastTick;
      snapshots = v.snapshots;
      sim.setPaused(false);
      await until('the snapshot after the pause', () => v.snapshots > snapshots, 3000);
      const now = performance.now();
      if (pausedTick === tick && v.lastTick === tick) again = { before, resumed: v.tickProgress(now), ms: now - t0 };
    }
    sim.setPaused(true);

    // 5. A tick that comes while the game is paused (a single step) has no length: the sprites
    //    stand where it has them at once, as before 2.7y.
    await until('the end of the step in hand', () => v.tickProgress() === 1, 3000);
    const held = v.lastTick;
    await sim.step(1);
    await until('the tick of the single step', () => v.lastTick !== held, 3000);
    const stepped = v.tickProgress();
    return { pan, speed, walk, again, stepped };
  });

  console.log(
    `sprites' progress through the tick: a pan ${got.pan?.before.toFixed(2)} → ${got.pan?.after.toFixed(2)}; another speed ${got.speed?.before.toFixed(2)} → ${got.speed?.after.toFixed(2)}; ` +
      `a pause at ${got.walk?.before.toFixed(2)}: ahead of the clock by ${got.walk?.ahead.toFixed(3)} at most (frame to frame ${got.walk?.aheadDrawn.toFixed(3)}), behind it by ${got.walk?.behind.toFixed(3)}, at the tick's end after ${got.walk?.restMs.toFixed(0)} ms, ${got.walk?.between} frames drawn on the way, the last at ${got.walk?.lastDrawn}; ` +
      `a pause and on again: ${got.again?.before.toFixed(2)} → ${got.again?.resumed.toFixed(2)} in ${got.again?.ms.toFixed(0)} ms`,
  );
  expect(got.pan, 'a pan answered within its tick, in six tries').not.toBeNull();
  expect(got.pan!.before).toBeGreaterThanOrEqual(0.3);
  expect(got.pan!.after, 'after a pan').toBeGreaterThanOrEqual(got.pan!.before);
  expect(got.speed, 'a change of speed answered within its tick, in six tries').not.toBeNull();
  expect(got.speed!.after, 'at another speed').toBeGreaterThanOrEqual(got.speed!.before);

  expect(got.walk, 'a pause answered in its tick with a way still to go, in twelve tries').not.toBeNull();
  const walk = got.walk!;
  // No jump: between any two readings the sprites went no further than the time that passed
  // (a tick is 1000 ms here), and so between any two frames that were drawn.
  expect(walk.ahead, 'paused: progress ahead of the clock').toBeLessThan(0.001);
  expect(walk.aheadDrawn, 'paused: from one frame to the next, ahead of the clock').toBeLessThan(0.001);
  // And no halt: they go on at the tick's pace, and are at its end when its time has run.
  expect(walk.behind, 'paused: progress behind the clock').toBeLessThan(0.001);
  expect(walk.restMs, 'paused: time to the end of the step').toBeGreaterThan((1 - walk.before) * 1000 - 40);
  // The view draws the way there, and the end of it is what stays on screen.
  expect(walk.onItsWay, 'a frame asked for straight after the frame of the pause is drawn').toBe(true);
  expect(walk.lastDrawn, 'the last frame drawn').toBe(1);
  expect(walk.after, 'paused, after the step').toBe(1);

  expect(got.again, 'a pause and its end within one tick, in six tries').not.toBeNull();
  const again = got.again!;
  expect(Math.abs(again.resumed - Math.min(1, again.before + again.ms / 1000)), 'on again: the clock ran on').toBeLessThan(0.001);

  expect(got.stepped, 'a single step while paused: no walk').toBe(1);
});
