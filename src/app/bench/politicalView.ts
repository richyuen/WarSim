/**
 * 1938 political map view (PLAN 1.3, `bench.html?b=W[&size=S|M]`): the sim worker builds the
 * province raster, terrain and 1938 ownership, and the production MapRenderer draws owner and
 * controller (occupation hatching) in each nation's data colour, with the 1938 cities on a
 * label overlay (PLAN 1.5) and the starting formations as dots (PLAN 1.7). The visual check for the ownership and city data until the real
 * 1938 scenario boots in the app (PLAN 1.8+).
 */
import type { Camera } from '../../render/camera';
import { CityLabelLayer } from '../../render/labels/cityLabels';
import { MapRenderer } from '../../render/map/MapRenderer';
import { FormationDotLayer } from '../../render/units/formationDots';
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

// Starting formations (PLAN 1.7) and city dots/names (PLAN 1.5) on 2D overlays.
const unitOverlay = document.createElement('canvas');
unitOverlay.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none';
document.body.appendChild(unitOverlay);
const units = new FormationDotLayer(unitOverlay, { w: W, h: H, kmPerCell: 40075 / W, wrapX: true }, ['#888', ...nationsJson.nations.map((n) => n.color)]);
units.dots = result.formations;
const overlay = document.createElement('canvas');
overlay.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none';
document.body.appendChild(overlay);
const labels = new CityLabelLayer(overlay, { w: W, h: H, kmPerCell: 40075 / W, wrapX: true });
labels.setCities(result.cities.map((c) => ({ name: c.name, x: c.x, y: c.y, size: c.size, capital: c.capitalOf !== 0 })));

let cam: Camera = { cx: W / 2, cy: H / 2, scale: Math.min(canvas.clientWidth / W, canvas.clientHeight / H) };
map.draw(cam, dpr);
let unitsDrawn = units.draw(cam, dpr);
labels.draw(cam, dpr);

window.__bench = {
  ready: Promise.resolve(),
  run: async () => {
    const { owner: _o, controller: _c, cities, formations: _f, ...summary } = result;
    return { ...summary, cities: cities.length, capitals: cities.filter((c) => c.capitalOf !== 0).length, formations: result.formations.length, unitsDrawn };
  },
  setCamera: async (cx, cy, scale) => {
    cam = { cx, cy, scale };
    map.draw(cam, dpr);
    unitsDrawn = units.draw(cam, dpr);
    labels.draw(cam, dpr);
    await new Promise((r) => requestAnimationFrame(() => r(undefined)));
  },
  labels: () => ({
    dots: labels.lastPlaced.length,
    names: labels.lastPlaced.filter((p) => p.nameAlpha > 0).map((p) => result.cities[p.index]!.name),
  }),
};
