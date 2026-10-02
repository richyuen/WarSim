/**
 * Procedural unit sprite atlas (our own art, DATA_SOURCES "Unit sprites"): white silhouettes
 * with a dark outline, tinted per nation in the shader. Frames are 64×64 in a 256×64 strip:
 * 0 infantry, 1 tank, 2 ship, 3 aircraft. Phase 2 replaces this with the full atlas.
 */

export const ATLAS_FRAME = 64;
export const ATLAS_FRAMES = 4;

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
  frame(0, (g) => {
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
  // Tank: hull, turret and barrel facing +x.
  frame(1, (g) => {
    g.beginPath();
    g.roundRect(-24, -16, 44, 32, 5);
    g.stroke();
    g.fill();
    g.beginPath();
    g.arc(-2, 0, 10, 0, Math.PI * 2);
    g.stroke();
    g.fill();
    g.fillRect(6, -3, 24, 6);
    g.strokeRect(6, -3, 24, 6);
  });
  // Ship: pointed hull facing +x with a superstructure.
  frame(2, (g) => {
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
  frame(3, (g) => {
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
  return c;
}
