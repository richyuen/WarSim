/**
 * Procedural unit sprite atlas (our own art, DATA_SOURCES "Unit sprites"): white silhouettes
 * with a dark outline, tinted per nation in the shader. Frames are 64×64 in a strip, in the
 * order of `Frame` (`shared/unitLooks`): infantry, light tank hull, ship, aircraft, gun, infantry
 * prone, medium and heavy tank hull, half-track, the three turrets, and the tank's small mark.
 *
 * A tank is two frames (PLAN 3.6a): its hull, and its turret with the gun, whose ring is at the
 * middle of both frames, so that a turret drawn at its hull's place turns about its ring. Greys
 * take the nation's tint darker: tracks, decks and the open bay of a half-track.
 */
import { Frame } from '../../shared/unitLooks';

export const ATLAS_FRAME = 64;
export const ATLAS_FRAMES = Object.keys(Frame).length;

/** How far the gun of each turret reaches from its ring, atlas px. */
const GUN_LIGHT = 26;
const GUN_MEDIUM = 29;
const GUN_HEAVY = 28;

/**
 * Where a frame's shot leaves it (PLAN 3.6c): atlas px from the middle of the frame, x along
 * its facing and y to its right. A hull's is its turret's muzzle, along the turret. Frames
 * without a barrel drawn (a carrier, a ship, an aircraft) fire from their middle.
 */
const MUZZLE: Readonly<Partial<Record<Frame, readonly [number, number]>>> = {
  [Frame.infantry]: [28, 10],
  [Frame.prone]: [30, 4.5],
  [Frame.gun]: [30, 0],
  [Frame.tank]: [GUN_LIGHT, 0],
  [Frame.tankMedium]: [GUN_MEDIUM, 0],
  [Frame.tankHeavy]: [GUN_HEAVY, 0],
};
const NO_MUZZLE: readonly [number, number] = [0, 0];

/** The muzzle of `frame` as shares of the sprite's side: along its facing (a hull: its turret's), and to the right. */
export function muzzleOf(frame: number): readonly [number, number] {
  const [x, y] = MUZZLE[frame as Frame] ?? NO_MUZZLE;
  return [x / ATLAS_FRAME, y / ATLAS_FRAME];
}

export function drawUnitAtlas(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = ATLAS_FRAME * ATLAS_FRAMES;
  c.height = ATLAS_FRAME;
  const g = c.getContext('2d')!;
  const frame = (i: number, draw: (g: CanvasRenderingContext2D) => void): void => {
    g.save();
    g.translate(i * ATLAS_FRAME + ATLAS_FRAME / 2, ATLAS_FRAME / 2);
    g.lineJoin = 'round';
    g.lineWidth = 5;
    g.strokeStyle = 'rgba(15,15,20,0.95)';
    g.fillStyle = '#ffffff';
    draw(g);
    g.restore();
  };
  // Infantry: a soldier seen from above facing +x (head, shoulders, rifle). The outline of the two
  // infantry frames is INFANTRY_LINE, not 5 (PLAN 7.21a): a man is 5 to 9 px at T3, where the 5-px
  // outline was half of him and his nation's colour the other half (critic run 8: the two sides
  // "near one colour on the grass").
  frame(Frame.infantry, (g) => {
    g.lineWidth = INFANTRY_LINE;
    g.beginPath();
    g.ellipse(0, 0, 12, 18, 0, 0, Math.PI * 2);
    g.stroke();
    g.fill();
    g.beginPath();
    g.arc(4, 0, 8, 0, Math.PI * 2);
    g.stroke();
    g.fill();
    g.fillRect(6, 8, 22, 4);
    g.strokeRect(6, 8, 22, 4);
  });
  // Light tank hull (PLAN 3.6a): facing +x, the turret ring at the middle.
  frame(Frame.tank, (g) => hull(g, 40, 26, 6));
  // The ships of each class (PLAN 4.7b), facing +x, the longest the battleship's: its length and
  // beam tell them apart at T2's sizes, the deck's marks closer. Since PLAN 7.10a the marks are dark
  // (SHIP_DETAIL, which no tint lightens) and large enough to read at a ship's least size (26 px for
  // a battleship): turrets with their guns, the superstructure, a carrier's deck and island. They
  // were light grey, which the tint made a paler shade of the hull: at 15 m/px a red bar.
  const pointed = (g: CanvasRenderingContext2D, bow: number, stern: number, beam: number): void => {
    g.beginPath();
    g.moveTo(bow, 0);
    g.lineTo(bow * 0.45, -beam);
    g.lineTo(stern, -beam * 0.85);
    g.lineTo(stern, beam * 0.85);
    g.lineTo(bow * 0.45, beam);
    g.closePath();
    g.stroke();
    g.fill();
  };
  /** A gun turret at (x, 0), radius `r`, its guns `gun` long toward `dir` (1: the bow, −1: the stern). */
  const gunTurret = (g: CanvasRenderingContext2D, x: number, r: number, gun: number, dir: number): void => {
    g.fillStyle = SHIP_DETAIL;
    g.strokeStyle = SHIP_DETAIL;
    g.beginPath();
    g.arc(x, 0, r, 0, Math.PI * 2);
    g.fill();
    g.lineWidth = Math.max(2, r * 0.45);
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x + dir * (r + gun), 0);
    g.stroke();
  };
  /** The superstructure: a dark block from `x0` to `x1`, `half` to either side, with a funnel. */
  const bridge = (g: CanvasRenderingContext2D, x0: number, x1: number, half: number, funnel: boolean): void => {
    g.fillStyle = SHIP_DETAIL;
    g.fillRect(x0, -half, x1 - x0, 2 * half);
    if (funnel) {
      g.fillStyle = '#111111';
      g.beginPath();
      g.ellipse((x0 + x1) / 2 - 2, 0, half * 0.55, half * 0.75, 0, 0, Math.PI * 2);
      g.fill();
    }
  };
  // A ship of no class of its own (a cruiser's frame): a pointed hull, two turrets and a bridge.
  frame(Frame.ship, (g) => {
    pointed(g, 30, -28, 11);
    gunTurret(g, 15, 5, 7, 1);
    bridge(g, -10, 4, 5, true);
    gunTurret(g, -19, 5, 7, -1);
  });
  frame(Frame.battleship, (g) => {
    pointed(g, 31, -30, 12);
    gunTurret(g, 18, 6, 8, 1);
    gunTurret(g, 7, 6, 6, 1);
    bridge(g, -12, 0, 6, true);
    gunTurret(g, -21, 6, 8, -1);
  });
  frame(Frame.carrier, (g) => {
    g.beginPath();
    g.rect(-30, -11, 60, 22);
    g.stroke();
    g.fill();
    // The flight deck's edges and its centre line, dark; the island to starboard.
    g.strokeStyle = SHIP_DETAIL;
    g.lineWidth = 2;
    g.strokeRect(-27, -8, 54, 16);
    g.setLineDash([6, 4]);
    g.beginPath();
    g.moveTo(-24, 0);
    g.lineTo(24, 0);
    g.stroke();
    g.setLineDash([]);
    g.fillStyle = SHIP_DETAIL;
    g.fillRect(-6, 6, 16, 6);
  });
  frame(Frame.submarine, (g) => {
    g.beginPath();
    g.ellipse(0, 0, 26, 5.5, 0, 0, Math.PI * 2);
    g.stroke();
    g.fill();
    g.fillStyle = SHIP_DETAIL;
    g.fillRect(-2, -3.5, 10, 7);
  });
  frame(Frame.transport, (g) => {
    g.beginPath();
    g.moveTo(26, 0);
    g.lineTo(18, -11);
    g.lineTo(-24, -11);
    g.lineTo(-24, 11);
    g.lineTo(18, 11);
    g.closePath();
    g.stroke();
    g.fill();
    // Its holds forward, the superstructure and funnel aft.
    g.strokeStyle = SHIP_DETAIL;
    g.lineWidth = 2;
    g.strokeRect(2, -6, 9, 12);
    g.strokeRect(-9, -6, 9, 12);
    bridge(g, -21, -12, 6, true);
  });
  frame(Frame.destroyer, (g) => {
    pointed(g, 24, -22, 6.5);
    gunTurret(g, 12, 3.5, 5, 1);
    bridge(g, -4, 4, 3.5, true);
    gunTurret(g, -14, 3.5, 5, -1);
  });
  // The wake (PLAN 4.7b): two lines of foam that open astern, the ship's stern at +x. Drawn white,
  // not tinted, behind a ship under way.
  frame(Frame.wake, (g) => {
    g.strokeStyle = 'rgba(255,255,255,0.85)';
    g.lineCap = 'round';
    for (const [w, a] of [[5, 0.9], [3, 0.6]] as const) {
      g.lineWidth = w;
      g.globalAlpha = a;
      g.beginPath();
      g.moveTo(30, -2);
      g.quadraticCurveTo(0, -6, -30, -18);
      g.moveTo(30, 2);
      g.quadraticCurveTo(0, 6, -30, 18);
      g.stroke();
    }
    g.globalAlpha = 0.35;
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.ellipse(18, 0, 14, 3, 0, 0, Math.PI * 2);
    g.fill();
  });
  // Aircraft: fuselage, wings and tail facing +x.
  frame(Frame.aircraft, (g) => {
    g.beginPath();
    g.moveTo(28, 0);
    g.lineTo(6, -4);
    g.lineTo(2, -26);
    g.lineTo(-6, -26);
    g.lineTo(-6, -4);
    g.lineTo(-20, -3);
    g.lineTo(-26, -12);
    g.lineTo(-30, -12);
    g.lineTo(-28, 0);
    g.lineTo(-30, 12);
    g.lineTo(-26, 12);
    g.lineTo(-20, 3);
    g.lineTo(-6, 4);
    g.lineTo(-6, 26);
    g.lineTo(2, 26);
    g.lineTo(6, 4);
    g.closePath();
    g.stroke();
    g.fill();
  });
  // Gun (PLAN 2.6): a field piece facing +x, seen from above: split trail, wheels, shield, barrel.
  frame(Frame.gun, (g) => {
    g.beginPath();
    g.moveTo(-4, 0);
    g.lineTo(-28, -9);
    g.moveTo(-4, 0);
    g.lineTo(-28, 9);
    g.lineWidth = 9;
    g.stroke();
    g.lineWidth = 4;
    g.strokeStyle = '#ffffff';
    g.stroke();
    g.strokeStyle = 'rgba(15,15,20,0.95)';
    g.lineWidth = 5;
    for (const y of [-17, 17]) {
      g.beginPath();
      g.roundRect(-9, y - 4, 16, 8, 3);
      g.stroke();
      g.fill();
    }
    g.beginPath();
    g.rect(2, -13, 5, 26);
    g.stroke();
    g.fill();
    g.fillRect(6, -3, 24, 6);
    g.strokeRect(6, -3, 24, 6);
  });
  // Infantry in contact (PLAN 2.14c2): a soldier lying prone, seen from above, facing +x: legs
  // back, body, head, the rifle out in front. Long and narrow, where the standing one is broad: 19
  // px across of his 60 (PLAN 7.21a: 16 abreast in a rank, `individuals`).
  frame(Frame.prone, (g) => {
    g.lineWidth = INFANTRY_LINE;
    for (const y of [-4, 4]) {
      g.beginPath();
      g.roundRect(-30, y - 3, 20, 6, 3);
      g.stroke();
      g.fill();
    }
    g.beginPath();
    g.ellipse(-4, 0, 14, 8, 0, 0, Math.PI * 2);
    g.stroke();
    g.fill();
    g.beginPath();
    g.arc(10, 0, 7, 0, Math.PI * 2);
    g.stroke();
    g.fill();
    g.fillRect(12, 3, 18, 3);
    g.strokeRect(12, 3, 18, 3);
  });
  frame(Frame.tankMedium, (g) => hull(g, 50, 32, 7));
  frame(Frame.tankHeavy, (g) => hull(g, 56, 40, 9));
  // Half-track (PLAN 3.6a): mechanised infantry's carrier, facing +x: bonnet and front wheels,
  // tracks under the rear, an open bay for the men.
  frame(Frame.halftrack, (g) => {
    g.lineWidth = 4;
    g.fillStyle = TRACK;
    for (const y of [-15, 10]) {
      g.beginPath();
      g.roundRect(-24, y, 26, 5, 2);
      g.stroke();
      g.fill();
      g.beginPath();
      g.roundRect(11, y + (y < 0 ? 1 : 0), 9, 4, 2);
      g.stroke();
      g.fill();
    }
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.roundRect(-25, -10, 49, 20, 3);
    g.stroke();
    g.fill();
    g.fillStyle = DECK;
    g.fillRect(-21, -6, 24, 12);
    g.lineWidth = 2;
    g.strokeRect(-21, -6, 24, 12);
    g.beginPath();
    g.moveTo(8, -9);
    g.lineTo(8, 9);
    g.stroke();
  });
  // Turrets, the gun toward +x: a small round one with a thin gun, a larger one, and the heavy
  // tank's box with a thick gun and a muzzle brake.
  frame(Frame.turretLight, (g) => turret(g, 7, 7, GUN_LIGHT, 3, false));
  frame(Frame.turretMedium, (g) => turret(g, 10, 9, GUN_MEDIUM, 4, false));
  frame(Frame.turretHeavy, (g) => turret(g, 14, 12, GUN_HEAVY, 6, true));
  // A tank where a sprite is 5 px (PLAN 3.6e3b): one slab along the facing, all fill and a thin
  // rim. A hull's tracks, deck and outlines are most of its 5 px, and it was a dark blob there.
  frame(Frame.tankSmall, (g) => {
    g.lineWidth = 7;
    g.beginPath();
    g.roundRect(-28, -17, 56, 34, 8);
    g.stroke();
    g.fill();
  });
  return c;
}

/** The outline of the infantry's two frames, atlas px (the others' is 5): PLAN 7.21a. */
const INFANTRY_LINE = 2.5;
/** The dark of a ship's marks (PLAN 7.10a): no tint lightens it. */
const SHIP_DETAIL = '#3a3a3a';
/** Greys of the atlas: what the nation's tint makes darker. */
const TRACK = '#7d7d7d';
const DECK = '#b4b4b4';

/**
 * A tank's hull seen from above, facing +x: `length` × `width` px with tracks `track` wide, the
 * turret ring at the origin (the hull reaches a little further back than forward of it).
 */
function hull(g: CanvasRenderingContext2D, length: number, width: number, track: number): void {
  const x0 = -length / 2 - 2;
  g.lineWidth = 4;
  g.fillStyle = TRACK;
  for (const y of [-width / 2, width / 2 - track]) {
    g.beginPath();
    g.roundRect(x0, y, length, track, 2);
    g.stroke();
    g.fill();
  }
  // The links of the tracks.
  g.lineWidth = 1;
  g.beginPath();
  for (let x = x0 + 4; x < x0 + length - 2; x += 5) {
    for (const y of [-width / 2, width / 2 - track]) {
      g.moveTo(x, y + 1);
      g.lineTo(x, y + track - 1);
    }
  }
  g.stroke();
  g.lineWidth = 4;
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.roundRect(x0 + 2, -width / 2 + track - 1, length - 4, width - 2 * track + 2, 3);
  g.stroke();
  g.fill();
  // The engine deck at the back and the edge of the glacis at the front.
  const inner = width / 2 - track - 2;
  g.fillStyle = DECK;
  g.fillRect(x0 + 5, -inner, length * 0.2, 2 * inner);
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(x0 + length - 8, -inner);
  g.lineTo(x0 + length - 8, inner);
  g.stroke();
}

/**
 * A turret seen from above, the gun toward +x and the ring at the origin: `back` px behind the
 * ring and `half` to either side, a gun `calibre` px thick to `muzzle`. `box`: the heavy
 * tank's, angular, with a muzzle brake.
 */
function turret(g: CanvasRenderingContext2D, back: number, half: number, muzzle: number, calibre: number, box: boolean): void {
  g.lineWidth = 3;
  g.fillStyle = '#f2f2f2';
  g.beginPath();
  g.rect(half - 2, -calibre / 2, muzzle - half + 2, calibre);
  if (box) g.rect(muzzle - 5, -calibre / 2 - 2, 4, calibre + 4);
  g.stroke();
  g.fill();
  g.beginPath();
  if (box) g.roundRect(-back, -half, back + half - 1, 2 * half, 4);
  else g.ellipse((half - back) / 2, 0, (half + back) / 2, half, 0, 0, Math.PI * 2);
  g.stroke();
  g.fill();
  // The commander's hatch.
  g.fillStyle = DECK;
  g.lineWidth = 1.5;
  g.beginPath();
  g.arc(-back / 3, -half / 3, Math.max(2, half / 4), 0, Math.PI * 2);
  g.stroke();
  g.fill();
}
