/**
 * 1938 political map view (PLAN 1.3, `bench.html?b=W[&size=S|M]`): the sim worker builds the
 * province raster, terrain and 1938 ownership, and the production MapRenderer draws owner and
 * controller (occupation hatching) in each nation's data colour. The visual check for the
 * ownership data until the real 1938 scenario boots in the app (PLAN 1.8+).
 */
import type { Camera } from '../../render/camera';
import { MapRenderer } from '../../render/map/MapRenderer';
import nationsJson from '../../../data/scenarios/1938/nations.json' with { type: 'json' };
import { SimClient } from '../simClient';

const size = new URLSearchParams(location.search).get('size') === 'S' ? 'S' : 'M';
const W = size === 'S' ? 1024 : 2048;
const H = W / 2;

const canvas = document.getElementById('map') as HTMLCanvasElement;
const dpr = window.devicePixelRatio || 1;
canvas.width = Math.round(canvas.clientWidth * dpr);
canvas.height = Math.round(canvas.clientHeight * dpr);
const gl = canvas.getContext('webgl2', { antialias: false, preserveDrawingBuffer: true })!;
const map = new MapRenderer(gl, W, H, { wrapX: true });
map.setColor(0, 0x24476b);
nationsJson.nations.forEach((n, i) => map.setColor(i + 1, parseInt(n.color.slice(1), 16)));

const sim = new SimClient();
const result = await sim.buildPolitical(W, H);
map.setGrid(result.owner, result.controller);
let cam: Camera = { cx: W / 2, cy: H / 2, scale: Math.min(canvas.clientWidth / W, canvas.clientHeight / H) };
map.draw(cam, dpr);

window.__bench = {
  ready: Promise.resolve(),
  run: async () => {
    const { owner: _o, controller: _c, ...summary } = result;
    return summary;
  },
  setCamera: async (cx, cy, scale) => {
    cam = { cx, cy, scale };
    map.draw(cam, dpr);
    await new Promise((r) => requestAnimationFrame(() => r(undefined)));
  },
};
