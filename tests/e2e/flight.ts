import type {} from '../../src/app/testApi';

// A flight of the camera on the test's clock (PLAN 2.10a; shared since PLAN 3.6e4): the view's
// own loop is stopped and its turns (`frameAt`: the camera eases, the view subscribes, the frame
// is drawn) are given times a frame apart, with a pause between two for the worker's snapshots
// to arrive. A leg is one eased zoom of the camera's own to the next stop (`zoomTo`, what the
// wheel does), held on one point of the map.

export interface Frame {
  m: number;
  shares: [number, number, number];
  /** Where the anchor is on the screen, CSS px. */
  sx: number;
  sy: number;
}
export interface LegArgs {
  now: number;
  toM: number | null;
  /** The anchor in cells, and the screen point the zoom holds it at (null at the first stop, where nothing zooms). */
  ax: number;
  ay: number;
  hold: [number, number] | null;
  mapW: number;
  frameMs: number;
  shares: [number, number, number];
  tier: number;
  maxFrames: number;
  deadlineMs: number;
}
export interface LegResult {
  now: number;
  frames: Frame[];
  rest: boolean;
  ms: number;
  /** Where the anchor is on the screen at the leg's end. */
  at: [number, number];
  state: { m: number; shares: [number, number, number]; tier: number; elements: number; figures: number; unitsAnimating: boolean; camAnimating: boolean };
}


/**
 * In the page: the camera eases to `toM`, the view's turns are given times `frameMs` apart, and
 * the leg ends with the frame that leaves the view at rest at the stop: the camera there,
 * nothing animating, the stop's layers in full, its subscription answered.
 */
export const leg = async (a: LegArgs): Promise<LegResult> => {
  const v = window.__warsim!.view!;
  const c = v.controller;
  const canvas = document.getElementById('map') as HTMLCanvasElement;
  const [vw, vh] = [canvas.clientWidth, canvas.clientHeight];
  const where = (): [number, number] => {
    // The copy of the anchor nearest the view's middle (the map loops).
    let dx = a.ax - c.cam.cx;
    dx -= Math.round(dx / a.mapW) * a.mapW;
    return [vw / 2 + dx * c.cam.scale, vh / 2 + (a.ay - c.cam.cy) * c.cam.scale];
  };
  const toScale = a.toM === null ? null : (v.metresPerPx * c.cam.scale) / a.toM;
  const frames: Frame[] = [];
  const t0 = performance.now();
  let now = a.now;
  let rest: boolean;
  let zooming = toScale !== null;
  for (;;) {
    now += a.frameMs;
    if (zooming) c.zoomTo(toScale!, a.hold ?? where());
    v.frameAt(now);
    const [sx, sy] = where();
    frames.push({ m: v.metresPerPx, shares: [v.shares.markers, v.shares.elements, v.shares.individuals], sx, sy });
    if (zooming && Math.abs(Math.log(c.cam.scale / toScale!)) < 1e-3 && !c.animating) zooming = false;
    const needsElements = a.tier >= 2;
    rest =
      !zooming &&
      !v.unitsAnimating(now) &&
      v.shares.markers === a.shares[0] &&
      v.shares.elements === a.shares[1] &&
      v.shares.individuals === a.shares[2] &&
      v.subscription?.tier === a.tier &&
      (!needsElements || v.elementCount > 0) &&
      (a.tier < 3 || v.individualCount > 0);
    if (rest || frames.length >= a.maxFrames || performance.now() - t0 > a.deadlineMs) break;
    await new Promise((done) => setTimeout(done, 0));
  }
  // The picture of the stop: what the frame of rest started (a capital's flag making way for a
  // counter that has just come to rest, a nation's name fading in) is let run out, a second at a
  // time, so that the picture is the same on every run. The shares do not move: they are recorded.
  for (let k = 0; rest && (k < 2 || (v.unitsAnimating(now) && k < 6)); k++) {
    now += 1000;
    v.frameAt(now);
    v.draw(now);
    frames.push({ m: v.metresPerPx, shares: [v.shares.markers, v.shares.elements, v.shares.individuals], sx: where()[0], sy: where()[1] });
  }
  return {
    now,
    frames,
    rest,
    ms: performance.now() - t0,
    at: where(),
    state: { m: v.metresPerPx, shares: [v.shares.markers, v.shares.elements, v.shares.individuals], tier: v.subscription?.tier ?? -1, elements: v.elementCount, figures: v.individualCount, unitsAnimating: v.unitsAnimating(now), camAnimating: c.animating },
  };
};

/**
 * Of a leg's frames: the largest move of each share from one frame to the next and the largest
 * move back, and whether the zoom ever went out.
 */
export function steps(before: [number, number, number], frames: readonly Frame[]): { up: number[]; down: number[]; out: boolean } {
  const up = [0, 0, 0];
  const down = [0, 0, 0];
  let out = false;
  let prev = before;
  let last: Frame | null = null;
  for (const f of frames) {
    for (let i = 0; i < 3; i++) {
      up[i] = Math.max(up[i]!, f.shares[i]! - prev[i]!);
      down[i] = Math.max(down[i]!, prev[i]! - f.shares[i]!);
    }
    if (last && f.m > last.m * (1 + 1e-9)) out = true;
    last = f;
    prev = f.shares;
  }
  return { up, down, out };
}
