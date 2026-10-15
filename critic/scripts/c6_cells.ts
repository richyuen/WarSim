import { writeFileSync } from 'node:fs';
import { cellOf } from '../../src/sim/data/terrain';
import { SIZE_1938, NATIONS_1938 } from '../../src/sim/scenario1938';
const pts: Record<string, [number, number]> = { berlin: [13.4, 52.52], warsaw: [21.01, 52.23], paris: [2.35, 48.86], london: [-0.12, 51.5], rome: [12.5, 41.9], moscow: [37.6, 55.75], prague: [14.42, 50.08], vienna: [16.37, 48.21], northsea: [4, 55], tokyo: [139.7, 35.7], kiev: [30.5, 50.45], polfront: [18.5, 53.0], hamburg: [10.0, 53.55] };
const out: Record<string, unknown> = { size: SIZE_1938, tags: Object.fromEntries(NATIONS_1938.map((n, i) => [n.tag, i + 1])) };
for (const [k, [lon, lat]] of Object.entries(pts)) out[k] = cellOf(lon, lat, SIZE_1938.w, SIZE_1938.h);
writeFileSync('critic/c6_cells.json', JSON.stringify(out));
