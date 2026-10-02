/**
 * Province raster view (PLAN 0.19, `bench.html?b=R`): builds the admin-1 province raster at
 * M size in the sim worker and draws it with the production MapRenderer (each province as
 * its own "nation" colour), for timing and visual checks.
 */
import type { Camera } from '../../render/camera';
import { MapRenderer } from '../../render/map/MapRenderer';
import { SimClient } from '../simClient';
import { hslToRgb } from './synthetic';

const W = 2048;
const H = 1024;

const canvas = document.getElementById('map') as HTMLCanvasElement;
const dpr = window.devicePixelRatio || 1;
canvas.width = Math.round(canvas.clientWidth * dpr);
canvas.height = Math.round(canvas.clientHeight * dpr);
const gl = canvas.getContext('webgl2', { antialias: false, preserveDrawingBuffer: true })!;
const map = new MapRenderer(gl, W, H, { wrapX: true });
map.setColor(0, 0x1d3557);

const sim = new SimClient();
const result = await sim.buildProvinces(W, H, true);
const ids = result.ids!;
for (let id = 1; id <= result.provinces; id++) {
  const hue = (id * 0.618033988749895) % 1;
  map.setColor(id, hslToRgb(hue, 0.45 + 0.3 * ((id * 7) % 5) / 4, 0.45 + 0.2 * ((id * 3) % 4) / 3));
}
map.setGrid(ids, ids);
let cam: Camera = { cx: W / 2, cy: H / 2, scale: Math.min(canvas.clientWidth / W, canvas.clientHeight / H) };
map.draw(cam, dpr);

window.__bench = {
  ready: Promise.resolve(),
  run: async () => {
    const { ids: _omit, ...summary } = result;
    return summary;
  },
  setCamera: async (cx, cy, scale) => {
    cam = { cx, cy, scale };
    map.draw(cam, dpr);
    await new Promise((r) => requestAnimationFrame(() => r(undefined)));
  },
};
