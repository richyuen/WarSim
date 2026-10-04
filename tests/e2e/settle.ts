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
 */
export async function settle(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const v = window.__warsim!.view!;
    for (let i = 0; i < 400; i++) {
      v.draw();
      if (!v.unitsAnimating()) return;
      await new Promise((done) => setTimeout(done, 25));
    }
    throw new Error('the view did not come to rest in 10 s');
  });
}
