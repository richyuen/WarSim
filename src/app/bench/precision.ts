/**
 * Precision probe (PLAN 0.16): a sprite near lon 179° viewed at 1 m/px while the camera pans
 * in sub-metre steps. `window.__precision.frame` renders one frame and returns the sprite's
 * expected (f64) and measured (readPixels centroid) screen positions.
 *
 * Mode 'relative' uses the production scheme (integer origin + f32 offsets). Mode 'naive'
 * uploads absolute f32 world positions; at x ≈ 2042 cells the f32 ulp is ≈ 4.8 m, so it jitters.
 */
import type { Camera } from '../../render/camera';
import { MapRenderer } from '../../render/map/MapRenderer';
import { drawUnitAtlas } from '../../render/units/atlas';
import { ProxyRenderer } from '../../render/units/ProxyRenderer';

/** M map: 2048 cells span 40 075 km at the equator (SPEC §3.1). */
export const KM_PER_CELL = 40075 / 2048;
export const PX_PER_CELL_1M = KM_PER_CELL * 1000; // 1 m/px
const W = 2048;
const H = 1024;

const canvas = document.getElementById('map') as HTMLCanvasElement;
canvas.width = canvas.clientWidth;
canvas.height = canvas.clientHeight;
const gl = canvas.getContext('webgl2', { antialias: false, preserveDrawingBuffer: true })!;

// Two nations split at x = 2042 so the map at 1 m/px shows a border through the view.
const owner = new Uint16Array(W * H);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) owner[y * W + x] = x < 2042 ? 1 : 2;
const map = new MapRenderer(gl, W, H, { wrapX: true });
map.setColor(0, 0x1d3557);
map.setColor(1, 0x6a994e);
map.setColor(2, 0xbc6c25);
map.setGrid(owner, owner);

const proxies = new ProxyRenderer(gl, drawUnitAtlas());
const SPRITE_PX = 40;
let mode: 'relative' | 'naive' = 'relative';
let sx = 0;
let sy = 0;

function upload(cam: Camera): void {
  proxies.reserve(1);
  // Production: origin = integer cell near the data; naive: origin 0 (absolute f32).
  proxies.originX = mode === 'relative' ? Math.floor(cam.cx) : 0;
  proxies.originY = mode === 'relative' ? Math.floor(cam.cy) : 0;
  const d = proxies.data;
  d[0] = d[2] = sx - proxies.originX;
  d[1] = d[3] = sy - proxies.originY;
  d[4] = 0;
  d[5] = SPRITE_PX / PX_PER_CELL_1M;
  d[6] = 1; // tank frame: compact and symmetric about its centre row
  d[7] = 1;
  proxies.colors.set([255, 0, 0, 255], 0);
  proxies.upload(1);
}

window.__precision = {
  setup: (m, x, y) => {
    mode = m;
    sx = x;
    sy = y;
  },
  frame: (cx, cy) => {
    const cam: Camera = { cx, cy, scale: PX_PER_CELL_1M };
    // In naive mode the origin is 0, so both the instance position and the camera reach the
    // shader as absolute f32 world coordinates.
    upload(cam);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    map.draw(cam, 1);
    proxies.draw(cam, 1, 1, 1);
    const ex = canvas.width / 2 + (sx - cx) * PX_PER_CELL_1M;
    const ey = canvas.height / 2 + (sy - cy) * PX_PER_CELL_1M;
    // Coverage-weighted centroid of the red sprite in a window around the expected position:
    // weight = redness, so linearly filtered edges contribute fractionally (sub-pixel accurate).
    const r = 120;
    const x0 = Math.max(0, Math.floor(ex - r));
    const y0 = Math.max(0, Math.floor(ey - r));
    const w = Math.min(canvas.width - x0, 2 * r);
    const h = Math.min(canvas.height - y0, 2 * r);
    const px = new Uint8Array(w * h * 4);
    // readPixels rows start at the bottom of the framebuffer.
    const yb = canvas.height - y0 - h;
    gl.readPixels(x0, yb, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
    let sumX = 0;
    let sumY = 0;
    let n = 0;
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        const o = (j * w + i) * 4;
        // Map colours have redness ≤ 80; the sprite interior is ≈ 255.
        const wgt = Math.max(0, px[o]! - Math.max(px[o + 1]!, px[o + 2]!) - 120) / 135;
        if (wgt <= 0) continue;
        sumX += wgt * (x0 + i + 0.5);
        sumY += wgt * (canvas.height - (yb + j + 0.5));
        n += wgt;
      }
    }
    return { expected: [ex, ey], actual: n > 20 ? [sumX / n, sumY / n] : null };
  },
};
