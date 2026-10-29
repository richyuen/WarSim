import { describe, expect, it } from 'vitest';
import { EventKind, RejectReason } from '../../src/shared/events';
import { AiLayer, aiRuns, PLAYER_AI_ALL, PLAYER_AI_DEFAULT } from '../../src/sim/ai/layers';
import { cellOf } from '../../src/sim/data/terrain';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { destroyFormation } from '../../src/sim/systems/elements';
import { PLAYER_MISSION_HOURS } from '../../src/sim/systems/playerOrders';
import { WITHDRAW_SPEED } from '../../src/sim/systems/movement';
import { PlayerOrderKind, type World } from '../../src/sim/world';
import { decodeSections } from '../../src/sim/core/sections';
import { assets1938 } from '../helpers/earth';
import { addDivision, nationId } from '../helpers/sim1938';

// ADR-759 (the user's decision): taking control of a nation leaves its AI on, layer by layer as
// the player's boxes say (all but nuclear strikes at first); a direct order of the player's keeps
// the AI's hands off its formation until it is done; a march of the player's that meets the enemy
// is cancelled and the formation fights; an order given in a fight marches through it, at
// WITHDRAW_SPEED, until the formation is out of contact.

const { w: W, h: H } = SIZE_1938;
const [GER, POL] = ['GER', 'POL'].map(nationId) as [number, number];
const at = (lon: number, lat: number): [number, number] => {
  const [x, y] = cellOf(lon, lat, W, H);
  return [Math.floor(x) + 0.5, Math.floor(y) + 0.5];
};

/** The 1938 world (seed 5) with no formation in it, Germany and Poland at war, Poland played. */
function cleared(ai: boolean): Sim {
  const s = new Sim({ scenario: '1938', seed: 5, assets: assets1938(W) });
  const world = s.world;
  world.formations.ids().forEach((id) => destroyFormation(world, id));
  world.wars.set(GER, POL, true);
  world.settings.aiEnabled = ai;
  s.command({ kind: 'setPlayer', nation: POL });
  s.step(1);
  return s;
}

/** Steps hour by hour until `done` or `max` hours; the events of those hours. */
function stepUntil(s: Sim, done: (w: World) => boolean, max: number): number[][] {
  const out: number[][] = [];
  for (let h = 0; h < max && !done(s.world); h++) {
    s.step(1, (w) => {
      for (let i = 0; i < w.out.events.length; i += 6) out.push(w.out.events.slice(i, i + 6));
      w.out.events.length = 0;
      w.out.fires.length = 0;
    });
  }
  return out;
}

describe('the player\'s AI assist', () => {
  it('control leaves the AI on, every layer but nuclear strikes; the boxes are kept, saved, and reset with the nation played', () => {
    const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
    const names = (): string[] => decodeSections(s.save()).map((x) => x.name);
    s.command({ kind: 'setPlayer', nation: POL });
    s.step(1);
    const w = s.world;
    expect(w.nations.cols.aiOff[POL]).toBe(0);
    expect(w.playerAi).toBe(PLAYER_AI_DEFAULT);
    for (const layer of [AiLayer.army, AiLayer.navy, AiLayer.air, AiLayer.diplomacy, AiLayer.economy]) expect(aiRuns(w, POL, layer), `layer ${layer}`).toBe(true);
    expect(aiRuns(w, POL, AiLayer.nukes), 'nuclear strikes, off at first').toBe(false);
    expect(aiRuns(w, GER, AiLayer.nukes), 'another nation\'s, as ever').toBe(true);

    s.command({ kind: 'setPlayerAi', layers: AiLayer.navy | AiLayer.nukes });
    s.step(1);
    expect(aiRuns(w, POL, AiLayer.army)).toBe(false);
    expect(aiRuns(w, POL, AiLayer.nukes)).toBe(true);
    expect(aiRuns(w, GER, AiLayer.army), 'the boxes are the player\'s nation\'s').toBe(true);
    // Out of range: refused.
    s.command({ kind: 'setPlayerAi', layers: PLAYER_AI_ALL + 1 });
    s.step(1);
    expect(w.playerAi).toBe(AiLayer.navy | AiLayer.nukes);

    // Saved and loaded with the world.
    const t = new Sim({ scenario: '1938', seed: 2, assets: assets1938(W) });
    t.load(s.save());
    expect(t.world.playerAi).toBe(AiLayer.navy | AiLayer.nukes);
    expect(t.hash()).toBe(s.hash());
    // Another nation taken: the boxes as at first. Released: as at first, and nothing saved of them.
    s.command({ kind: 'setPlayer', nation: GER });
    s.step(1);
    expect(w.playerAi).toBe(PLAYER_AI_DEFAULT);
    s.command({ kind: 'setPlayer', nation: 0 });
    s.step(1);
    expect(w.playerAi).toBe(PLAYER_AI_DEFAULT);
    expect(names().filter((n) => n.startsWith('world.player')), 'nothing of them saved').toEqual([]);

    // God Mode's switch is every layer, for the nation played too.
    s.command({ kind: 'setPlayer', nation: POL });
    s.command({ kind: 'setAi', nation: POL, enabled: false });
    s.step(1);
    expect(aiRuns(w, POL, AiLayer.economy)).toBe(false);
    // A save from before ADR-759 has the AI of the nation played off: released, it is back on.
    s.command({ kind: 'setPlayer', nation: 0 });
    s.step(1);
    expect(w.nations.cols.aiOff[POL]).toBe(0);
  });

  it('the army\'s layer unticked, no Polish formation is sent anywhere at war; ticked, the AI sends them', () => {
    const run = (layers: number): number => {
      const s = cleared(true);
      for (let i = 0; i < 6; i++) addDivision(s.world, POL, ...at(19.5 + i * 0.6, 52.2));
      for (let i = 0; i < 6; i++) addDivision(s.world, GER, ...at(14.5 + i * 0.3, 52.4));
      s.command({ kind: 'setPlayerAi', layers });
      s.step(48);
      let moved = 0;
      s.world.formations.forEach((id) => {
        const c = s.world.formations.cols;
        if (c.nation[id] === POL && (c.moving[id] === 1 || s.world.paths.has(id))) moved++;
      });
      return moved;
    };
    expect(run(PLAYER_AI_DEFAULT & ~AiLayer.army)).toBe(0);
    expect(run(PLAYER_AI_DEFAULT)).toBeGreaterThan(0);
  });

  it('a march of the player\'s is left alone by the AI at war until it arrives; then the order is over', () => {
    const s = cleared(true);
    const w = s.world;
    const c = w.formations.cols;
    for (let i = 0; i < 4; i++) addDivision(w, GER, ...at(14.5 + i * 0.3, 52.4));
    const ids = [0, 1, 2].map((i) => addDivision(w, POL, ...at(22.5 + i * 0.4, 52.0)));
    const id = ids[0]!;
    const [tx, ty] = at(23.6, 51.4);
    s.command({ kind: 'moveFormation', id, x: tx, y: ty, nation: POL });
    s.step(1);
    expect(w.playerOrders.get(id)?.kind).toBe(PlayerOrderKind.march);
    const target = c.targetCell[id]!;
    const ev = stepUntil(s, () => !w.playerOrders.has(id), 24 * 20);
    expect(w.playerOrders.has(id), 'the order is over').toBe(false);
    expect(ev.some((e) => e[1] === EventKind.FormationArrived && e[2] === id), 'it arrived').toBe(true);
    // Its target was the player's all the way (the AI's plans every day sent the others).
    expect(Math.floor(c.y[id]!) * W + Math.floor(c.x[id]!)).toBe(target);
  });

  it('a march of the player\'s that meets the enemy is cancelled, told, and the formation fights; a new order marches it through the fight at WITHDRAW_SPEED', () => {
    const s = cleared(false);
    const w = s.world;
    const c = w.formations.cols;
    const pol = addDivision(w, POL, ...at(20.0, 52.2));
    const ger = addDivision(w, GER, ...at(21.2, 52.2));
    const [tx, ty] = at(22.4, 52.2);
    s.command({ kind: 'moveFormation', id: pol, x: tx, y: ty, nation: POL });
    s.step(1);
    expect(w.playerOrders.has(pol)).toBe(true);
    const ev = stepUntil(s, () => c.engaged[pol] === 1, 24 * 10);
    expect(c.engaged[pol], 'in contact').toBe(1);
    expect(c.moving[pol], 'stopped').toBe(0);
    expect(w.playerOrders.has(pol), 'the order is cancelled').toBe(false);
    expect(ev.filter((e) => e[1] === EventKind.MoveRejected && e[2] === pol).map((e) => e[4]), 'told: met the enemy').toEqual([RejectReason.Contact]);
    // It holds there and fights, as any formation in contact.
    const [hx, hy] = [c.x[pol]!, c.y[pol]!];
    s.step(3);
    expect([c.x[pol], c.y[pol]]).toEqual([hx, hy]);
    expect(c.engaged[pol]).toBe(1);

    // A fighting withdrawal: ordered back west in the fight, it marches in contact, slower.
    const [bx, by] = at(18.6, 52.2);
    s.command({ kind: 'moveFormation', id: pol, x: bx, y: by, nation: POL });
    s.step(1);
    expect(w.playerOrders.get(pol)?.through, 'given in the fight').toBe(true);
    expect(c.moving[pol]).toBe(1);
    const x0 = c.x[pol]!;
    s.step(1);
    expect(c.engaged[pol], 'still in contact').toBe(1);
    expect(c.x[pol]!, 'it moved west in the fight').toBeLessThan(x0);
    // Out of contact, the order goes on as any march of the player's (cancelled by a new contact).
    stepUntil(s, () => c.engaged[pol] !== 1, 48);
    expect(c.engaged[pol]).toBe(0);
    s.step(1);
    expect(w.playerOrders.get(pol)?.through, 'out of the fight').toBe(false);
    expect(c.moving[pol]).toBe(1);
    expect(w.formations.has(ger)).toBe(true);
    expect(WITHDRAW_SPEED).toBeLessThan(1);
  });

  it('a push on through the fight: an order toward the enemy given in contact marches in contact', () => {
    const s = cleared(false);
    const w = s.world;
    const c = w.formations.cols;
    const pol = addDivision(w, POL, ...at(20.0, 52.2));
    addDivision(w, GER, c.x[pol]! + 1, c.y[pol]!);
    stepUntil(s, () => c.engaged[pol] === 1, 24);
    expect(c.engaged[pol]).toBe(1);
    const [tx, ty] = at(21.5, 52.2);
    s.command({ kind: 'moveFormation', id: pol, x: tx, y: ty, nation: POL });
    s.step(1);
    const x0 = c.x[pol]!;
    s.step(2);
    expect(c.x[pol]!, 'it pushed on east').toBeGreaterThan(x0);
  });

  it('a wing\'s mission of the player\'s is kept PLAYER_MISSION_HOURS, a rebase until the wing lands', () => {
    const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
    const w = s.world;
    const wing = [...w.wingBase.keys()].sort((a, b) => a - b)[0]!;
    w.wingMission.set(wing, { kind: 'patrol', x: w.formations.cols.x[wing]!, y: w.formations.cols.y[wing]! });
    w.playerOrders.set(wing, { kind: PlayerOrderKind.mission, until: w.tick + PLAYER_MISSION_HOURS, through: false });
    s.step(PLAYER_MISSION_HOURS - 1);
    expect(w.playerOrders.has(wing) || !w.wingMission.has(wing)).toBe(true);
    s.step(2);
    expect(w.playerOrders.has(wing)).toBe(false);
    // A rebase: kept while the wing flies there (`wingFerry`), over when it is at its base.
    w.playerOrders.set(wing, { kind: PlayerOrderKind.rebase, until: 0, through: false });
    w.wingFerry.set(wing, w.tick + 3);
    s.step(1);
    expect(w.playerOrders.has(wing)).toBe(true);
    w.wingFerry.delete(wing);
    s.step(1);
    expect(w.playerOrders.has(wing)).toBe(false);
  });

  it('the player\'s orders are saved and loaded, and go with their formation', () => {
    const s = cleared(false);
    const w = s.world;
    const pol = addDivision(w, POL, ...at(20.0, 52.2));
    const [tx, ty] = at(21.0, 51.8);
    s.command({ kind: 'moveFormation', id: pol, x: tx, y: ty, nation: POL });
    s.step(1);
    const t = new Sim({ scenario: '1938', seed: 2, assets: assets1938(W) });
    t.load(s.save());
    expect([...t.world.playerOrders]).toEqual([...w.playerOrders]);
    expect(t.hash()).toBe(s.hash());
    destroyFormation(w, pol);
    expect(w.playerOrders.has(pol)).toBe(false);
  });
});
