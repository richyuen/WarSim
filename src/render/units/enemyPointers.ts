/**
 * The way to the enemy (PLAN 7.34d, critic run 9, semantic zoom 7: "at 10 m/px on German
 * infantry division 11 the enemy is off screen; the screen is all grey German figures"). A
 * formation in contact stands in a file of up to DEPLOY_LINES blocks on the way to its enemy's
 * block, and the second line's middle is 6.7 km from that block: in a view of 10 m/px (4.5 km
 * from the middle to the top of a 900-px screen) the enemy is not in the frame. Where a
 * formation in contact is in the view and the enemy it is in contact with (the sim's nearest,
 * `contactsOf`) is not, a pointer at the frame's edge toward that enemy's block: an arrow in the
 * enemy's colour, its name and how far it is. One for each enemy, however many of the view's
 * formations face it. A click on it takes the camera there (`MapView`).
 *
 * The pointer stands where the line from the frame's middle to the enemy's block meets the frame
 * inset by POINTER_INSET px; where the page has a box over that place (the banners, the bottom
 * bar, a panel) it slides along that edge to the nearest place clear of the boxes. Two pointers
 * nearer than POINTER_GAP px: the farther enemy's is left out. Pure.
 */

/** A formation of the view in contact, with the enemy it is in contact with (CSS px of the frame; the enemy's x the copy nearest the camera). */
export interface PointerSource {
  id: number;
  /** Its block's middle on the screen. */
  x: number;
  y: number;
  enemy: number;
  enemyNation: number;
  /** The enemy's block on the screen. */
  ex: number;
  ey: number;
}

export interface EnemyPointer {
  enemy: number;
  nation: number;
  /** The view's formation it is drawn for (the first by id facing that enemy). */
  from: number;
  /** The arrow's tip, CSS px, and the way it points (radians, x right, y down). */
  x: number;
  y: number;
  angle: number;
  /** The enemy's block on the screen, CSS px (off the frame). */
  ex: number;
  ey: number;
}

/** A page box over the map, CSS px of the frame. */
export interface PointerObstacle {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** How far inside the frame the arrow's tip stands, CSS px (before the unit size). */
export const POINTER_INSET = 10;
/** The least distance between two pointers, CSS px (before the unit size). */
export const POINTER_GAP = 40;
/** The arrow's length and its width at the back, CSS px (before the unit size). */
export const POINTER_LEN = 16;
export const POINTER_WIDE = 14;
/** The label's height and its gap from the arrow, CSS px (before the unit size). */
const LABEL_H = 12;
const LABEL_GAP = 4;

const inFrame = (x: number, y: number, vw: number, vh: number): boolean => x >= 0 && x <= vw && y >= 0 && y <= vh;

/** Where the line from the frame's middle to (x, y) meets the rectangle [m, vw − m] × [m, vh − m]. */
function edgePoint(x: number, y: number, vw: number, vh: number, m: number): [number, number] {
  const [cx, cy] = [vw / 2, vh / 2];
  const [dx, dy] = [x - cx, y - cy];
  const tx = dx === 0 ? Infinity : (vw / 2 - m) / Math.abs(dx);
  const ty = dy === 0 ? Infinity : (vh / 2 - m) / Math.abs(dy);
  const t = Math.min(tx, ty);
  return [cx + dx * t, cy + dy * t];
}

/**
 * Where a pointer's label stands (its top left), its tip at (x, y) pointing at `angle`, its text
 * `tw` px wide: behind the arrow, inside a frame of `vw` × `vh`.
 */
export function labelAt(x: number, y: number, angle: number, tw: number, vw: number, vh: number, size = 1): [number, number] {
  const [ax, ay] = [Math.cos(angle), Math.sin(angle)];
  const len = POINTER_LEN * size;
  const [bx, by] = [x - ax * len, y - ay * len];
  const th = LABEL_H * size;
  const gap = LABEL_GAP * size;
  const lx = bx - ax * gap - tw / 2 - (ax * tw) / 2;
  const ly = by - ay * (gap + th / 2) - th / 2;
  return [Math.min(Math.max(lx, 2), vw - tw - 2), Math.min(Math.max(ly, 2), vh - th - 2)];
}

/** The box a pointer takes, its arrow and its label, CSS px. */
export function pointerBox(x: number, y: number, angle: number, tw: number, vw: number, vh: number, size = 1): PointerObstacle {
  const [ax, ay] = [Math.cos(angle), Math.sin(angle)];
  const len = POINTER_LEN * size;
  const half = (POINTER_WIDE * size) / 2;
  const [bx, by] = [x - ax * len, y - ay * len];
  const [lx, ly] = labelAt(x, y, angle, tw, vw, vh, size);
  const xs = [x, bx - half * Math.abs(ay), bx + half * Math.abs(ay), lx, lx + tw];
  const ys = [y, by - half * Math.abs(ax), by + half * Math.abs(ax), ly, ly + LABEL_H * size];
  const [x0, y0] = [Math.min(...xs) - 2, Math.min(...ys) - 2];
  return { x: x0, y: y0, w: Math.max(...xs) + 2 - x0, h: Math.max(...ys) + 2 - y0 };
}

const meets = (a: PointerObstacle, b: PointerObstacle): boolean => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/**
 * The pointers of `sources` in a frame of `vw` × `vh` CSS px: for each enemy whose block is off
 * the frame, of a formation whose block is in it.
 */
export function enemyPointers(
  sources: readonly PointerSource[],
  vw: number,
  vh: number,
  avoid: readonly PointerObstacle[] = [],
  size = 1,
  labelWidth: (enemy: number) => number = () => 0,
): EnemyPointer[] {
  const m = POINTER_INSET * size;
  const byEnemy = new Map<number, PointerSource>();
  for (const s of [...sources].sort((p, q) => p.id - q.id)) {
    if (s.enemy === 0 || !inFrame(s.x, s.y, vw, vh) || inFrame(s.ex, s.ey, vw, vh)) continue;
    if (!byEnemy.has(s.enemy)) byEnemy.set(s.enemy, s);
  }
  // The nearest enemies first: a far one gives way.
  const [cx, cy] = [vw / 2, vh / 2];
  const order = [...byEnemy.values()].sort((p, q) => Math.hypot(p.ex - cx, p.ey - cy) - Math.hypot(q.ex - cx, q.ey - cy) || p.enemy - q.enemy);
  const out: EnemyPointer[] = [];
  const taken: PointerObstacle[] = [...avoid];
  for (const s of order) {
    const tw = labelWidth(s.enemy);
    const blocked = (x: number, y: number): boolean => {
      const box = pointerBox(x, y, Math.atan2(s.ey - y, s.ex - x), tw, vw, vh, size);
      return taken.some((b) => meets(box, b));
    };
    let [x, y] = edgePoint(s.ex, s.ey, vw, vh, m);
    if (blocked(x, y)) {
      // Along its edge, the nearest place clear of the page's boxes.
      const along = Math.abs(y - m) < 0.5 || Math.abs(y - (vh - m)) < 0.5 ? 'x' : 'y';
      const [lo, hi] = along === 'x' ? [m, vw - m] : [m, vh - m];
      let found: [number, number] | null = null;
      for (let step = 4; step <= hi - lo && !found; step += 4) {
        for (const sign of [-1, 1]) {
          const v = (along === 'x' ? x : y) + sign * step;
          if (v < lo || v > hi) continue;
          const [px, py] = along === 'x' ? [v, y] : [x, v];
          if (!blocked(px, py)) {
            found = [px, py];
            break;
          }
        }
      }
      if (found) [x, y] = found;
    }
    if (out.some((p) => Math.hypot(p.x - x, p.y - y) < POINTER_GAP * size)) continue;
    const angle = Math.atan2(s.ey - y, s.ex - x);
    out.push({ enemy: s.enemy, nation: s.enemyNation, from: s.id, x, y, angle, ex: s.ex, ey: s.ey });
    taken.push(pointerBox(x, y, angle, tw, vw, vh, size));
  }
  return out;
}

/** The label's font (the tags' name face, PLAN 2.14a). */
export const POINTER_FONT = (s: number): string => `600 ${Math.round(10 * s)}px system-ui, sans-serif`;

/**
 * Draws `pointers` at `alpha`: each an arrow in its enemy's colour with a dark rim, its tip at the
 * pointer's place, and inside the frame from it the label (`label(p)`), light on a dark halo.
 * Returns each one's box (arrow and label), CSS px, for the click.
 */
export function drawEnemyPointers(
  ctx: CanvasRenderingContext2D,
  pointers: readonly EnemyPointer[],
  alpha: number,
  colour: (nation: number) => string,
  label: (p: EnemyPointer) => string,
  vw: number,
  vh: number,
  size = 1,
): { x: number; y: number; w: number; h: number }[] {
  const boxes: { x: number; y: number; w: number; h: number }[] = [];
  if (alpha <= 0.01) return boxes;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.lineJoin = 'round';
  const len = POINTER_LEN * size;
  const wide = POINTER_WIDE * size;
  for (const p of pointers) {
    const [ax, ay] = [Math.cos(p.angle), Math.sin(p.angle)];
    const [ux, uy] = [-ay, ax];
    const [bx, by] = [p.x - ax * len, p.y - ay * len];
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(bx + (ux * wide) / 2, by + (uy * wide) / 2);
    ctx.lineTo(bx - (ux * wide) / 2, by - (uy * wide) / 2);
    ctx.closePath();
    ctx.lineWidth = 3 * size;
    ctx.strokeStyle = 'rgba(16, 18, 24, 0.9)';
    ctx.stroke();
    ctx.fillStyle = colour(p.nation);
    ctx.fill();
    // The label behind the arrow, kept inside the frame.
    const text = label(p);
    ctx.font = POINTER_FONT(size);
    const tw = ctx.measureText(text).width;
    const [lx, ly] = labelAt(p.x, p.y, p.angle, tw, vw, vh, size);
    ctx.textBaseline = 'top';
    ctx.lineWidth = 3 * size;
    ctx.strokeStyle = 'rgba(16, 18, 24, 0.85)';
    ctx.strokeText(text, lx, ly);
    ctx.fillStyle = '#f2ead8';
    ctx.fillText(text, lx, ly);
    boxes.push(pointerBox(p.x, p.y, p.angle, tw, vw, vh, size));
  }
  ctx.restore();
  return boxes;
}
