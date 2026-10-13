import { cellOf } from '../../src/sim/data/terrain';
import { SIZE_1938 } from '../../src/sim/scenario1938';
const pts: Record<string, [number, number]> = { channel: [1.0, 50.6], calais: [1.86, 50.95], dover: [1.31, 51.13], northsea: [3.5, 55.5], gibraltar: [-5.35, 36.13], malta: [14.5, 35.9], taranto: [17.2, 40.4], scapa: [-3.1, 58.9], kiel: [10.1, 54.3], pearl: [-157.9, 21.35], tokyo: [139.7, 35.6], midway: [-177.4, 28.2], london: [-0.13, 51.5], berlin: [13.4, 52.5], warsaw: [21, 52.2], sicily: [14, 37.5], alexandria: [29.9, 31.2], newyork: [-74, 40.7], plymouth: [-4.14, 50.37], brest: [-4.49, 48.39], portsmouth: [-1.09, 50.8] };
const out: Record<string, [number, number]> = {};
for (const [k, [lo, la]] of Object.entries(pts)) out[k] = cellOf(lo, la, SIZE_1938.w, SIZE_1938.h).map((v) => +v.toFixed(2)) as [number, number];
console.log(JSON.stringify({ size: SIZE_1938, ...out }));
