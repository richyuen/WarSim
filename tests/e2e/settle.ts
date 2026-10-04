import type { Page } from '@playwright/test';
import type {} from '../../src/app/testApi';

/**
 * Draws until a frame leaves nothing animating, and returns with that frame's state in the view.
 *
 * "Wait until nothing animates, then draw" is not the same. The view's own loop may not have
 * drawn since the last animation ended; then the test's draw is the frame that sees the end
 * state, starts what follows from it (a capital flag making way for a counter that has just
 * come to rest) and shows that animation's first frame. `flagsClear1938.spec.ts` failed that
 * way once in a gate run (2026-10-04): three flags still on their counters.
 *
 * For a paused game. While the game runs the counters never all stand still: a spec that
 * samples a running game says which animation it waits for (`handover1938.spec.ts`) or which
 * frames it reads (`declutter1938.spec.ts`).
 */
export async function settle(page: Page, timeoutMs = 30_000): Promise<void> {
  await page.evaluate(async (timeoutMs) => {
    const v = window.__warsim!.view!;
    const deadline = performance.now() + timeoutMs;
    for (;;) {
      v.draw();
      if (!v.unitsAnimating()) return;
      if (performance.now() > deadline) throw new Error(`the view did not come to rest in ${timeoutMs / 1000} s`);
      await new Promise((done) => setTimeout(done, 25));
    }
  }, timeoutMs);
}
