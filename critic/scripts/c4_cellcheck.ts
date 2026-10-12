import { Sim } from '../../src/sim/sim';
import { SIZE_1938, NATIONS_1938 } from '../../src/sim/scenario1938';
import { loadAssets1938 } from '../../tools/headless/assets';
import { cellOf } from '../../src/sim/data/terrain';
const sim = new Sim({ scenario: '1938', seed: 2207, assets: loadAssets1938(SIZE_1938.w) });
const w = sim.world;
const at = (x: number, y: number) => { const c = Math.floor(y) * w.cells.w + Math.floor(x); return { x, y, terrain: w.cells.terrain[c], owner: NATIONS_1938[(w.cells.owner[c] ?? 1) - 1]?.tag ?? w.cells.owner[c] }; };
console.log(JSON.stringify([at(1062, 259.5), at(...cellOf(8.58, 53.55, SIZE_1938.w, SIZE_1938.h) as [number, number]), at(...cellOf(7.2, 53.4, SIZE_1938.w, SIZE_1938.h) as [number,number]), at(1014.34, 278.5)]));
