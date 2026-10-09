import { describe, expect, it } from 'vitest';
import type { Command } from '../../src/shared/commands';
import { isLand } from '../../src/shared/terrain';
import { xxhash32View } from '../../src/sim/core/hash';
import { cellOf } from '../../src/sim/data/terrain';
import { lineCells } from '../../src/sim/editor';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { assets1938 } from '../helpers/earth';
import { nationId } from '../helpers/sim1938';

// PLAN 1.44b: the God Mode territory brush dragged over the map. `paintControl` with `x2, y2`
// gives the nation every land cell within r of the segment; without them it is the disc it was.

const { w: W, h: H } = SIZE_1938;
const GER = nationId('GER');
const [wx, wy] = cellOf(19.5, 52, W, H); // central Poland

function sim(): Sim {
  const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
  s.world.settings.aiEnabled = false;
  return s;
}
function run(s: Sim, ...cmds: Command[]): Sim {
  for (const c of cmds) s.command(c);
  s.applyNow();
  return s;
}
const rasters = (s: Sim): number[] => [xxhash32View(s.world.cells.owner), xxhash32View(s.world.cells.controller)];

describe('paintControl along a segment (PLAN 1.44b)', () => {
  it('controls every land cell within r of the segment, and leaves the owners alone', () => {
    const s = sim();
    const owners = xxhash32View(s.world.cells.owner);
    const [x2, y2] = [wx + 30.4, wy + 7.7];
    run(s, { kind: 'paintControl', nation: GER, x: wx, y: wy, r: 2, x2, y2 });
    const { controller, terrain } = s.world.cells;
    // The cells under the segment itself (the editor's line of radius 0), and the brush around them.
    const under = lineCells(W, H, wx, wy, x2, y2, 0, true);
    expect(under.length).toBeGreaterThan(30);
    for (const c of under) expect(controller[c], `cell ${c}`).toBe(GER);
    for (const c of lineCells(W, H, wx, wy, x2, y2, 2, true)) if (isLand(terrain[c]!)) expect(controller[c], `cell ${c}`).toBe(GER);
    expect(xxhash32View(s.world.cells.owner)).toBe(owners);
  });

  it('equals a stamp of the brush at every cell step of the segment', () => {
    const [x2, y2] = [wx - 12.5, wy + 20.25];
    const whole = run(sim(), { kind: 'paintControl', nation: GER, x: wx, y: wy, r: 3, x2, y2 });
    const steps = Math.ceil(Math.max(Math.abs(x2 - wx), Math.abs(y2 - wy)));
    const stamps = Array.from({ length: steps + 1 }, (_, i): Command => ({ kind: 'paintControl', nation: GER, x: wx + ((x2 - wx) * i) / steps, y: wy + ((y2 - wy) * i) / steps, r: 3 }));
    expect(rasters(whole)).toEqual(rasters(run(sim(), ...stamps)));
  });

  it('without an end point, or with the end at the start, it is the disc it always was', () => {
    const point = run(sim(), { kind: 'paintControl', nation: GER, x: wx, y: wy, r: 5 });
    expect(rasters(run(sim(), { kind: 'paintControl', nation: GER, x: wx, y: wy, r: 5, x2: wx, y2: wy }))).toEqual(rasters(point));
    // A fractional position paints the disc of its cell.
    expect(rasters(run(sim(), { kind: 'paintControl', nation: GER, x: Math.floor(wx) + 0.9, y: Math.floor(wy) + 0.1, r: 5 }))).toEqual(
      rasters(run(sim(), { kind: 'paintControl', nation: GER, x: Math.floor(wx), y: Math.floor(wy), r: 5 })),
    );
    const { controller } = point.world.cells;
    let n = 0;
    for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) if (controller[(Math.floor(wy) + dy) * W + Math.floor(wx) + dx] === GER) n++;
    expect(n).toBe(81); // the cells with dx² + dy² ≤ 25, all land here
  });

  it('crosses the map seam, and a segment longer than the map ends', () => {
    const s = sim();
    const [, ay] = cellOf(179, 66.5, W, H); // Chukotka, at the date line
    run(s, { kind: 'paintControl', nation: GER, x: W - 4, y: ay, r: 1, x2: W + 4, y2: ay });
    const row = Math.floor(ay) * W;
    const { controller, terrain } = s.world.cells;
    for (const x of [W - 4, W - 1, 0, 3]) if (isLand(terrain[row + x]!)) expect(controller[row + x], `x ${x}`).toBe(GER);
    expect([W - 4, W - 1, 0, 3].some((x) => isLand(terrain[row + x]!))).toBe(true);
    const t0 = performance.now();
    run(s, { kind: 'paintControl', nation: GER, x: 0, y: 0, r: 0, x2: 1e9, y2: 1e9 });
    expect(performance.now() - t0).toBeLessThan(2000);
  });
});
