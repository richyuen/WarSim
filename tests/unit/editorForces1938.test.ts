import { describe, expect, it } from 'vitest';
import { Refusal, type Command } from '../../src/shared/commands';
import { EventKind } from '../../src/shared/events';
import { cellOf } from '../../src/sim/data/terrain';
import { SIZE_1938, TEMPLATES_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { assets1938 } from '../helpers/earth';
import { nationId, runEvents } from '../helpers/sim1938';

// PLAN 7.13a (critic run 7, editor 6: "warheads, fleets, airbases and wings still cannot be placed,
// so a scenario cannot set up a nuclear standoff or a navy"): the editor's fleet goes on the water by
// the click, its wing on the airbase of the nation's by the click with room, its warheads to the
// nation; a shared scenario has them.

const { w: W, h: H } = SIZE_1938;
const [GBR, GER] = ['ENG', 'GER'].map(nationId) as [number, number];
const tpl = (id: string): number => TEMPLATES_1938.findIndex((t) => t.id === id);
const SQUADRON = tpl('battle_squadron');
const BOMBERS = tpl('strategic_bomber_group');
const INFANTRY = 0; // the land's templates come first (TEMPLATES_1938)

function send(s: Sim, cmd: Command): { applied: number; refused: number[] } {
  s.command(cmd);
  const ev = runEvents(s, 1);
  return { applied: ev.filter((e) => e[1] === EventKind.CommandApplied).length, refused: ev.filter((e) => e[1] === EventKind.CommandRefused).map((e) => e[3]!) };
}

/** The formations of `nation` of template `t`. */
function ofTemplate(s: Sim, nation: number, t: number): number[] {
  const out: number[] = [];
  const c = s.world.formations.cols;
  s.world.formations.forEach((id) => {
    if (c.nation[id] === nation && c.template[id] === t) out.push(id);
  });
  return out;
}

describe('the editor places fleets, wings and warheads (PLAN 7.13a)', () => {
  it('a fleet off Portsmouth, a wing at the base by London, warheads; refused inland and with no base', () => {
    const s = new Sim({ scenario: '1938', seed: 7, assets: assets1938(W) });
    s.command({ kind: 'setSetting', key: 'aiEnabled', value: false });
    runEvents(s, 1);
    const fleets = ofTemplate(s, GBR, SQUADRON).length;
    const wings = ofTemplate(s, GBR, BOMBERS).length;

    // The fleet: a click on the coast by Portsmouth puts it on the water beside it.
    const [px, py] = cellOf(-1.09, 50.8, W, H);
    expect(send(s, { kind: 'spawnFleet', nation: GBR, x: px + 0.5, y: py + 0.5, template: SQUADRON })).toEqual({ applied: 1, refused: [] });
    const fleet = ofTemplate(s, GBR, SQUADRON).sort((a, b) => a - b).at(-1)!;
    expect(ofTemplate(s, GBR, SQUADRON)).toHaveLength(fleets + 1);
    expect(s.world.isFleet(fleet)).toBe(true);
    const c = s.world.formations.cols;
    const cell = Math.floor(c.y[fleet]!) * W + Math.floor(c.x[fleet]!);
    expect(s.world.cells.terrain[cell], 'on water').toBe(0);
    expect(Math.hypot(c.x[fleet]! - px, c.y[fleet]! - py)).toBeLessThan(4);
    expect(c.strength[fleet]).toBeGreaterThan(0);

    // The wing: at the airbase nearest the click by London, based there.
    const [lx, ly] = cellOf(-0.12, 51.5, W, H);
    expect(send(s, { kind: 'spawnWing', nation: GBR, x: lx + 0.5, y: ly + 0.5, template: BOMBERS })).toEqual({ applied: 1, refused: [] });
    expect(ofTemplate(s, GBR, BOMBERS)).toHaveLength(wings + 1);
    const wing = ofTemplate(s, GBR, BOMBERS).sort((a, b) => a - b).at(-1)!;
    expect(s.world.isWing(wing)).toBe(true);
    const base = s.world.wingBase.get(wing)!;
    expect(base).toBeGreaterThan(0);
    expect(s.world.cells.controller[s.world.airbases[base - 1]!.cell]).toBe(GBR);
    expect(Math.hypot(c.x[wing]! - lx, c.y[wing]! - ly)).toBeLessThan(4);

    // Warheads to the nation.
    expect(send(s, { kind: 'grantWarheads', nation: GBR, count: 5 }).applied).toBe(1);
    expect(s.world.warheads.get(GBR)!.stock).toBe(5);

    // Refused: a fleet inland (Berlin), a German wing in Britain, a template of another domain.
    const [bx, by] = cellOf(13.4, 52.52, W, H);
    expect(send(s, { kind: 'spawnFleet', nation: GER, x: bx + 0.5, y: by + 0.5, template: SQUADRON }).refused).toEqual([Refusal.NotAtSea]);
    expect(send(s, { kind: 'spawnWing', nation: GER, x: lx + 0.5, y: ly + 0.5, template: BOMBERS }).refused).toEqual([Refusal.NoAirbase]);
    expect(send(s, { kind: 'spawnFleet', nation: GBR, x: px + 0.5, y: py + 0.5, template: BOMBERS }).refused).toEqual([Refusal.NoSuch]);
    expect(send(s, { kind: 'spawnWing', nation: GBR, x: lx + 0.5, y: ly + 0.5, template: INFANTRY }).refused).toEqual([Refusal.NoSuch]);

    // A full base takes no more: wings until refused, each at a base of Britain's.
    let placed = 0;
    for (let k = 0; k < 200; k++) {
      const r = send(s, { kind: 'spawnWing', nation: GBR, x: lx + 0.5, y: ly + 0.5, template: BOMBERS });
      if (r.refused.length) {
        expect(r.refused).toEqual([Refusal.NoAirbase]);
        break;
      }
      placed++;
    }
    expect(placed).toBeLessThan(200);

    // A shared scenario has them, and plays them: the fleet, the wing, the warheads.
    const { bytes, hash } = s.exportScenario();
    const t = new Sim({ scenario: '1938', seed: 7, assets: assets1938(W) });
    t.load(bytes);
    expect(t.hash()).toBe(hash);
    expect(ofTemplate(t, GBR, SQUADRON)).toHaveLength(fleets + 1);
    expect(t.world.wingBase.get(wing)).toBe(base);
    expect(t.world.warheads.get(GBR)!.stock).toBe(5);
    t.step(24 * 3);
    expect(t.world.formations.has(fleet) && t.world.isFleet(fleet)).toBe(true);
    expect(t.world.formations.has(wing) && t.world.isWing(wing)).toBe(true);
  }, 300_000);
});
