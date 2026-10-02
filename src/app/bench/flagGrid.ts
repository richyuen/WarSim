/**
 * Flag grid (PLAN 1.6, `bench.html?b=F`): the 1938 flag atlas exactly as the GPU will receive it
 * (built by buildFlagAtlas from data), drawn 2× with each nation's name, for visual review.
 */
import presetsJson from '../../../data/flags/presets.json' with { type: 'json' };
import flagsJson from '../../../data/scenarios/1938/flags.json' with { type: 'json' };
import nationsJson from '../../../data/scenarios/1938/nations.json' with { type: 'json' };
import { buildFlagAtlas, type FlagPresets, type FlagSpec } from '../../shared/flags';
import { t, type MessageKey } from '../../ui/i18n';

const SCALE = 2;
const COLS = 10;
const t0 = performance.now();
const flags = flagsJson.flags as unknown as Record<string, FlagSpec>;
const atlas = buildFlagAtlas(
  nationsJson.nations.map((n) => [n.tag, flags[n.tag]!] as [string, FlagSpec]),
  presetsJson.presets as unknown as FlagPresets,
);
const buildMs = performance.now() - t0;

const src = document.createElement('canvas');
src.width = atlas.width;
src.height = atlas.height;
src.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(atlas.rgba), atlas.width, atlas.height), 0, 0);

const canvas = document.getElementById('map') as HTMLCanvasElement;
const dpr = window.devicePixelRatio || 1;
canvas.width = Math.round(canvas.clientWidth * dpr);
canvas.height = Math.round(canvas.clientHeight * dpr);
const ctx = canvas.getContext('2d')!;
ctx.scale(dpr, dpr);
ctx.fillStyle = '#2b2f36';
ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
ctx.imageSmoothingEnabled = false;
ctx.font = '600 11px system-ui, sans-serif';
ctx.textAlign = 'center';
const cw = atlas.cellW * SCALE;
const ch = atlas.cellH * SCALE;
const gx = cw + 40;
const gy = ch + 24;
nationsJson.nations.forEach((n, i) => {
  const { x, y } = atlas.cells[n.tag]!;
  const dx = 20 + (i % COLS) * gx;
  const dy = 12 + Math.floor(i / COLS) * gy;
  ctx.drawImage(src, x, y, atlas.cellW, atlas.cellH, dx, dy, cw, ch);
  ctx.fillStyle = '#e8e8e8';
  ctx.fillText(t(n.nameKey as MessageKey), dx + cw / 2, dy + ch + 13, gx - 4);
});

window.__bench = {
  ready: Promise.resolve(),
  run: async () => ({ flags: Object.keys(atlas.cells).length, atlas: [atlas.width, atlas.height], buildMs }),
  setCamera: async () => {},
};
