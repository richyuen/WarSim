/**
 * The line of contact (PLAN 7.11a, critic run 7: "at 10 to 25 m/px the two sides are clumps of
 * tiny sprites that run into one another; the front line between them cannot be read"): where two
 * formations in contact face each other, a line between their blocks at T2 and T3, each side's
 * half in its colour.
 *
 * A pair: two formations engaged, of two nations, each facing the other (its facing within
 * FACE_TOLERANCE of the way to the other's block), and each the other's nearest such: two
 * divisions of one side behind one another against one of the other have one line, at the front
 * of the one in front (a line for the one behind ran through the ranks of the one in front). The
 * line stands across the way from one block to the other, halfway between their fronts (each
 * block's element furthest toward the other: the middle of two blocks of unlike depth was inside
 * the deeper), as long as the narrower of the two reaches across that way (the front they share),
 * LINE_MIN_CELLS to LINE_MAX_CELLS either way. Pure: the same formations and elements give the
 * same lines.
 */

/** How far a block's facing may be off the way to the enemy's block and still face it, radians (35°). */
export const FACE_TOLERANCE = (35 * Math.PI) / 180;
/** The farthest two blocks in contact stand apart and have a line, cells (a deployed pair is about 0.05 apart). */
export const PAIR_MAX_CELLS = 0.5;
/** The least and the most half-length of a line, cells. */
export const LINE_MIN_CELLS = 0.03;
export const LINE_MAX_CELLS = 0.15;

export interface ContactForm {
  id: number;
  nation: number;
  /** Its block's middle, cells. */
  x: number;
  y: number;
  /** What it faces, radians (x east, y south). */
  facing: number;
  engaged: boolean;
}

export interface ContactLine {
  /** The middle between the two blocks, cells. */
  x: number;
  y: number;
  /** The way from `a`'s block to `b`'s, radians: the line runs across it. */
  axis: number;
  /** Half the line's length, cells. */
  half: number;
  /** The two formations and their nations: `a`'s half on its side of the line. */
  a: number;
  b: number;
  nationA: number;
  nationB: number;
}

const off = (a: number, b: number): number => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

/** The lines of contact of `forms`, with `elements` (their formation's id and place, cells) for their lengths. */
export function contactLines(forms: readonly ContactForm[], elements: readonly { formation: number; x: number; y: number }[]): ContactLine[] {
  const engaged = forms.filter((f) => f.engaged).sort((p, q) => p.id - q.id);
  const faces = (p: ContactForm, q: ContactForm): boolean => off(p.facing, Math.atan2(q.y - p.y, q.x - p.x)) <= FACE_TOLERANCE;
  // Each one's nearest enemy facing it, that it faces.
  const nearest = new Map<number, ContactForm>();
  for (const p of engaged) {
    let best: ContactForm | null = null;
    let bestD = PAIR_MAX_CELLS;
    for (const q of engaged) {
      if (q === p || q.nation === p.nation) continue;
      const d = Math.hypot(q.x - p.x, q.y - p.y);
      if (d > bestD || d === 0 || !faces(p, q) || !faces(q, p)) continue;
      if (d === bestD && best !== null && q.id > best.id) continue;
      best = q;
      bestD = d;
    }
    if (best) nearest.set(p.id, best);
  }
  const out: ContactLine[] = [];
  for (const p of engaged) {
    const best = nearest.get(p.id);
    // Each the other's nearest, the pair once (from the lower id).
    if (!best || nearest.get(best.id) !== p || best.id < p.id) continue;
    const [a, b] = [p, best];
    const [mx, my] = [(a.x + b.x) / 2, (a.y + b.y) / 2];
    const axis = Math.atan2(b.y - a.y, b.x - a.x);
    const [ax, ay] = [Math.cos(axis), Math.sin(axis)];
    // Across the axis: (−sin, cos). The fronts along it, and each block's reach across it.
    const [ux, uy] = [-ay, ax];
    let frontA = -Infinity;
    let frontB = Infinity;
    let acrossA = 0;
    let acrossB = 0;
    for (const e of elements) {
      const along = (e.x - mx) * ax + (e.y - my) * ay;
      const across = Math.abs((e.x - mx) * ux + (e.y - my) * uy);
      if (e.formation === a.id) [frontA, acrossA] = [Math.max(frontA, along), Math.max(acrossA, across)];
      else if (e.formation === b.id) [frontB, acrossB] = [Math.min(frontB, along), Math.max(acrossB, across)];
    }
    const t = Number.isFinite(frontA) && Number.isFinite(frontB) ? (frontA + frontB) / 2 : 0;
    const shared = acrossA > 0 && acrossB > 0 ? Math.min(acrossA, acrossB) : Math.max(acrossA, acrossB);
    out.push({ x: mx + ax * t, y: my + ay * t, axis, half: Math.min(LINE_MAX_CELLS, Math.max(LINE_MIN_CELLS, shared)), a: a.id, b: b.id, nationA: a.nation, nationB: b.nation });
  }
  return out;
}

/** The width of each side's half of a line on the screen, CSS px (before the unit size), and its opacity. */
export const LINE_PX = 3;
export const LINE_ALPHA = 0.9;

/**
 * Draws `lines` (already in the CSS-px transform of `ctx`) at `alpha`: each side's half a stroke
 * LINE_PX wide on its side of the line, in `colour` of its nation, with a dark rim; returns the
 * lines drawn on the screen, for tests.
 */
export function drawContactLines(
  ctx: CanvasRenderingContext2D,
  lines: readonly ContactLine[],
  toScreen: (x: number, y: number) => [number, number],
  scale: number,
  vw: number,
  vh: number,
  alpha: number,
  colour: (nation: number) => string,
  size = 1,
): ContactLine[] {
  const shown: ContactLine[] = [];
  if (alpha <= 0.01 || lines.length === 0) return shown;
  const w = LINE_PX * size;
  ctx.save();
  ctx.globalAlpha = alpha * LINE_ALPHA;
  ctx.lineCap = 'round';
  for (const l of lines) {
    const [cx, cy] = toScreen(l.x, l.y);
    const half = l.half * scale;
    if (cx < -half || cy < -half || cx > vw + half || cy > vh + half) continue;
    shown.push(l);
    const [ax, ay] = [Math.cos(l.axis), Math.sin(l.axis)];
    const [ux, uy] = [-ay, ax];
    const halves = [[-1, l.nationA], [1, l.nationB]] as const;
    const path = (side: number): void => {
      const ox = ((side * w) / 2) * ax;
      const oy = ((side * w) / 2) * ay;
      ctx.beginPath();
      ctx.moveTo(cx + ox - ux * half, cy + oy - uy * half);
      ctx.lineTo(cx + ox + ux * half, cy + oy + uy * half);
    };
    // The dark rims of both halves first, then their colours: a half's rim not over the other's colour.
    ctx.strokeStyle = 'rgba(16, 18, 24, 0.85)';
    ctx.lineWidth = w + 2;
    for (const [side] of halves) {
      path(side);
      ctx.stroke();
    }
    ctx.lineWidth = w;
    for (const [side, nation] of halves) {
      ctx.strokeStyle = colour(nation);
      path(side);
      ctx.stroke();
    }
  }
  ctx.restore();
  return shown;
}
