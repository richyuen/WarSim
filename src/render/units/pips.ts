/**
 * What a T1 marker shows of its formation's elements (PLAN 7.21c2, ADR-498): a pip for each
 * element, in a panel under the box. At T1 a division's block is a couple of px across (its
 * elements stand 590 m apart), so the elements are not drawn where they stand: the marker lists
 * them, from the snapshot's element section, the same elements T2 and T3 draw.
 *
 * The pips go by the template's parts in its order (an infantry division: 24 battalions, 3
 * batteries, an anti-tank company), each part's sockets filled by the living elements of its
 * class, the strongest first. An element lost is an empty socket at the end of its part; one
 * that has lost men is fainter by its share of them. Elements the template has no room for (a
 * class it does not have, or more of one) follow its parts.
 */
import { Frame } from '../../shared/unitLooks';

/** A template's elements by the atlas frame of their unit's class, in the template's order. */
export interface PipPart {
  frame: number;
  count: number;
}

/** A formation's pips, in drawing order: each one's frame, and its share of its men (0: an empty socket). */
export interface Pips {
  count: number;
  frame: Uint8Array;
  share: Float32Array;
}

/** The panel's height under the box, CSS px at unit size 1: a pixel of room, then four rows of 3. */
export const PIP_PANEL_H = 13;
/** Rows of the panel's height; more are squeezed into it. */
const ROWS = 4;
/** Least share a living element is drawn with: it is never taken for an empty socket. */
const LEAST_SHARE = 0.01;

/**
 * The pips of a formation of `parts` whose living elements are of `frames`, each with `shares`
 * (strength over the element's size).
 */
export function formationPips(parts: readonly PipPart[], frames: ArrayLike<number>, shares: ArrayLike<number>): Pips {
  const living = new Map<number, number[]>();
  for (let i = 0; i < frames.length; i++) {
    const list = living.get(frames[i]!) ?? [];
    list.push(Math.max(LEAST_SHARE, Math.min(1, shares[i]!)));
    living.set(frames[i]!, list);
  }
  for (const list of living.values()) list.sort((a, b) => b - a);
  const frame: number[] = [];
  const share: number[] = [];
  for (const p of parts) {
    const list = living.get(p.frame);
    for (let k = 0; k < p.count; k++) {
      frame.push(p.frame);
      share.push(list && list.length > 0 ? list.shift()! : 0);
    }
  }
  for (const [f, list] of living) {
    for (const s of list) {
      frame.push(f);
      share.push(s);
    }
  }
  return { count: frame.length, frame: Uint8Array.from(frame), share: Float32Array.from(share) };
}

/**
 * Where the pips of a panel `w` CSS px wide stand: in rows of 8 on a pitch of 3 (2-px pips), or
 * of 13 on a pitch of 2 (1-px wide) when more than 32; five or six rows on a pitch of 2 (1 px
 * high, up to 78 pips), more squeezed into the panel's height. `x0`, `y0`: the first pip's corner from the panel's top-left.
 */
export function pipGrid(n: number, w: number): { cols: number; px: number; py: number; pw: number; ph: number; x0: number; y0: number } {
  const cols = n <= ROWS * 8 ? 8 : 13;
  const px = cols === 8 ? 3 : 2;
  const rows = Math.max(1, Math.ceil(n / cols));
  const py = rows <= ROWS ? 3 : rows <= 6 ? 2 : (ROWS * 3) / rows;
  const ph = rows <= ROWS ? 2 : rows <= 6 ? 1 : py / 2;
  const used = Math.min(cols, Math.max(1, n)) * px - 1;
  return { cols, px, py, pw: px - 1, ph, x0: Math.floor((w - used) / 2), y0: 1 + Math.floor((ROWS * 3 - (rows * py - (py - ph))) / 2) };
}

/** A pip's colour by its frame: men pale, guns gold, armour steel, half-tracks green, ships by kind. */
export function pipColour(frame: number): string {
  switch (frame) {
    case Frame.gun:
      return '#f2c14e';
    case Frame.tank:
    case Frame.tankMedium:
    case Frame.tankHeavy:
    case Frame.tankSmall:
      return '#9fc0e6';
    case Frame.halftrack:
      return '#a8d38d';
    case Frame.carrier:
      return '#dcb4ef';
    case Frame.submarine:
      return '#8aa6b4';
    case Frame.transport:
      return '#c9c4b8';
    case Frame.ship:
    case Frame.battleship:
    case Frame.destroyer:
      return '#7cc4f0';
    default:
      return '#efe9da';
  }
}

/** An empty socket: a lost element. */
const SOCKET = 'rgba(255, 255, 255, 0.16)';

/**
 * Draws `pips` in the panel whose top-left is (`x`, `y`), `w` CSS px wide, at the opacity
 * `alpha` (in the CSS-px transform of `ctx`). A pip of an element that has lost men is fainter:
 * from 0.4 of the panel's opacity, at none of its men, to all of it.
 */
export function drawPips(ctx: CanvasRenderingContext2D, pips: Pips, x: number, y: number, w: number, alpha: number): void {
  if (pips.count === 0 || alpha <= 0.01) return;
  const g = pipGrid(pips.count, w);
  let fill = '';
  let a = -1;
  for (let i = 0; i < pips.count; i++) {
    const s = pips.share[i]!;
    const want = s > 0 ? pipColour(pips.frame[i]!) : SOCKET;
    const wa = s > 0 ? alpha * (0.4 + 0.6 * s) : alpha;
    if (want !== fill) ctx.fillStyle = fill = want;
    if (wa !== a) ctx.globalAlpha = a = wa;
    const col = i % g.cols;
    const row = Math.floor(i / g.cols);
    ctx.fillRect(x + g.x0 + col * g.px, y + g.y0 + row * g.py, g.pw, g.ph);
  }
}
