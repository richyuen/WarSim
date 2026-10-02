/**
 * Terrain view (PLAN 1.2, `bench.html?b=T[&size=S|M]`): loads the derived terrain raster with
 * its crossings in the sim worker and draws it with the production MapRenderer, one palette
 * entry per class (colours from data/terrain.json), without borders. The visual check for the
 * terrain derivation until the in-game terrain map mode lands (PLAN 1.30).
 */
import type { Camera } from '../../render/camera';
import { MapRenderer } from '../../render/map/MapRenderer';
import terrainJson from '../../../data/terrain.json' with { type: 'json' };
import { SimClient } from '../simClient';

const size = new URLSearchParams(location.search).get('size') === 'S' ? 'S' : 'M';
const W = size === 'S' ? 1024 : 2048;
const H = W / 2;

const canvas = document.getElementById('map') as HTMLCanvasElement;
const dpr = window.devicePixelRatio || 1;
canvas.width = Math.round(canvas.clientWidth * dpr);
canvas.height = Math.round(canvas.clientHeight * dpr);
const gl = canvas.getContext('webgl2', { antialias: false, preserveDrawingBuffer: true })!;
const map = new MapRenderer(gl, W, H, { wrapX: true, borderPx: 0 });
terrainJson.terrain.forEach((t, i) => map.setColor(i, parseInt(t.color.slice(1), 16)));

const sim = new SimClient();
const result = await sim.buildTerrain(W, H);
const ids = Uint16Array.from(result.terrain);
map.setGrid(ids, ids);
let cam: Camera = { cx: W / 2, cy: H / 2, scale: Math.min(canvas.clientWidth / W, canvas.clientHeight / H) };
map.draw(cam, dpr);

window.__bench = {
  ready: Promise.resolve(),
  run: async () => {
    const { terrain: _omit, ...summary } = result;
    return summary;
  },
  setCamera: async (cx, cy, scale) => {
    cam = { cx, cy, scale };
    map.draw(cam, dpr);
    await new Promise((r) => requestAnimationFrame(() => r(undefined)));
  },
};
