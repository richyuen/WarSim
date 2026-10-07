/**
 * Procedural unit sprite atlas (our own art, DATA_SOURCES "Unit sprites"): white silhouettes
 * with a dark outline, tinted per nation in the shader. Frames are 64×64 in a strip, in the
 * order of `Frame` (`shared/unitLooks`): infantry, light tank hull, ship, aircraft, gun, infantry
 * prone, medium and heavy tank hull, half-track, and the three turrets.
 *
 * A tank is two frames (PLAN 3.6a): its hull, and its turret with the gun, whose ring is at the
 * middle of both frames, so that a turret drawn at its hull's place turns about its ring. Greys
 * take the nation's tint darker: tracks, decks and the open bay of a half-track.
 */
import { Frame } from '../../shared/unitLooks';

export const ATLAS_FRAME = 64;
export const ATLAS_FRAMES = Object.keys(Frame).length;

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
  // Infantry: a soldier seen from above facing +x (head, shoulders, rifle).
  frame(Frame.infantry, (g) => {
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
  // Ship: pointed hull facing +x with a superstructure.
  frame(Frame.ship, (g) => {
    g.beginPath();
    g.moveTo(30, 0);
    g.lineTo(12, -11);
    g.lineTo(-28, -10);
    g.lineTo(-28, 10);
    g.lineTo(12, 11);
    g.closePath();
    g.stroke();
    g.fill();
    g.fillStyle = '#c8c8c8';
    g.fillRect(-12, -5, 14, 10);
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
  // back, body, head, the rifle out in front. Long and narrow, where the standing one is broad.
  frame(Frame.prone, (g) => {
    for (const y of [-5, 5]) {
      g.beginPath();
      g.roundRect(-30, y - 3, 20, 6, 3);
      g.stroke();
      g.fill();
    }
    g.beginPath();
    g.ellipse(-4, 0, 14, 9, 0, 0, Math.PI * 2);
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
  frame(Frame.turretLight, (g) => turret(g, 7, 7, 26, 3, false));
  frame(Frame.turretMedium, (g) => turret(g, 10, 9, 29, 4, false));
  frame(Frame.turretHeavy, (g) => turret(g, 14, 12, 28, 6, true));
  return c;
}

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
