import { describe, expect, it } from 'vitest';
import { Refusal } from '../../src/shared/commands';
import { EventKind } from '../../src/shared/events';
import { cellOf } from '../../src/sim/data/terrain';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { BOMBER_INTERCEPT, interceptChance, launchNuke, nuclearSystem, warheadsOf } from '../../src/sim/systems/nuclear';
import { airSuperiority } from '../../src/sim/systems/airSuperiority';
import { grantTechs, techMask } from '../../src/sim/tech';
import { airOf, type World } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';
import { nationId } from '../helpers/sim1938';

// PLAN 6.2 AT: a nuclear bomber's warhead is stopped short at the rate the air over its target
// gives: BOMBER_INTERCEPT × (1 − its side's superiority there). A missile is not. The United
// Kingdom at war with Germany (seed 1), at Berlin: of the nations of 1938 Britain, France, the
// Soviet Union and the United States have strategic bombers, Germany none.

const { w: W, h: H } = SIZE_1938;
const [ENG, GER] = ['ENG', 'GER'].map(nationId) as [number, number];
const berlin = cellOf(13.4, 52.52, W, H);
const sim = (): Sim => {
  const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
  s.world.wars.start([ENG], [GER], 0);
  return s;
};
const tech = (w: World, id: string): number => w.rules!.techs.findIndex((t) => t.id === id);
const events = (w: World, kind: number): number[][] => {
  const out: number[][] = [];
  for (let i = 0; i < w.out.events.length; i += 6) if (w.out.events[i + 1] === kind) out.push(Array.from(w.out.events.slice(i + 2, i + 6)));
  return out;
};
const strategic = (w: World, n: number): number =>
  [...w.wingBase].find(([id, b]) => b > 0 && w.formations.cols.nation[id] === n && w.rules!.units[w.rules!.templates[w.formations.cols.template[id]!]!.elements[0]!.unit]!.cls === 'bomber_str')![0];

describe('a warhead delivered (PLAN 6.2)', () => {
  it('a bomber\'s is stopped short at BOMBER_INTERCEPT × (1 − superiority): 600 launches at each of three skies', () => {
    const w = sim().world;
    const zone = airOf(w).zoneOf[Math.floor(berlin[1]) * W + Math.floor(berlin[0])]!;
    const wing = strategic(w, ENG);
    const N = 600;
    for (const [own, enemy] of [[100, 0], [100, 100], [100, 300]] as const) {
      w.airPower.set(zone, new Map([[ENG, own], [GER, enemy]]));
      const s = airSuperiority(w, ENG, zone);
      w.out.events.length = 0;
      for (let k = 0; k < N; k++) w.nukeLaunches.push({ id: w.nextLaunchId++, nation: ENG, missile: 0, wing, bx: 0, by: 0, tx: berlin[0], ty: berlin[1], launch: w.tick, arrive: w.tick });
      const p = interceptChance(w, w.nukeLaunches[0]!);
      expect(p).toBeCloseTo(BOMBER_INTERCEPT * (1 - s), 12);
      nuclearSystem(w);
      const stopped = events(w, EventKind.NukeIntercepted).length;
      const burst = events(w, EventKind.NukeDetonated).length;
      expect(stopped + burst).toBe(N);
      expect(w.nukeLaunches).toHaveLength(0);
      const sigma = Math.sqrt((p * (1 - p)) / N);
      process.stderr.write(`superiority ${s.toFixed(2)}: ${stopped} of ${N} stopped (${(stopped / N).toFixed(3)}, ${p.toFixed(3)} expected)\n`);
      expect(Math.abs(stopped / N - p), `superiority ${s}`).toBeLessThanOrEqual(4 * sigma + 1e-9);
    }
  });

  it('a launch: refused without nukes, a warhead, or a means; a bomber flies it, a missile from the capital always arrives; a save carries it', () => {
    const s = sim();
    const w = s.world;
    expect(launchNuke(w, ENG, ...berlin, false)).toBe(Refusal.NoWarhead);
    w.warheads.set(ENG, { stock: 3, paid: 0 });
    w.nukesBanned.add(ENG);
    expect(launchNuke(w, ENG, ...berlin, false)).toBe(Refusal.NoNukes);
    w.nukesBanned.delete(ENG);
    // Sydney: no British bomber reaches it; no missile known.
    expect(launchNuke(w, ENG, ...cellOf(151.2, -33.87, W, H), false)).toBe(Refusal.NoDelivery);
    expect(launchNuke(w, ENG, ...berlin, true)).toBe(Refusal.NoDelivery);
    expect(warheadsOf(w, ENG)).toBe(3);
    // By bomber: a strategic bomber flies to Berlin with it, no mission of its own.
    w.out.events.length = 0;
    expect(launchNuke(w, ENG, ...berlin, false)).toBe(Refusal.None);
    expect(warheadsOf(w, ENG)).toBe(2);
    const l = w.nukeLaunches[0]!;
    expect([l.missile, w.sorties.get(l.wing)?.tx, w.wingMission.has(l.wing)]).toEqual([0, berlin[0], false]);
    expect(events(w, EventKind.NukeLaunched)).toEqual([[ENG, 0, ...berlin]]);
    // By missile, known: from London; within the hour, and never stopped.
    grantTechs(w, ENG, techMask([tech(w, 'ballistic_missiles')]));
    expect(launchNuke(w, ENG, ...berlin, true)).toBe(Refusal.None);
    const m = w.nukeLaunches[1]!;
    expect([m.missile, m.bx, m.by]).toEqual([1, w.nations.cols.capitalX[ENG], w.nations.cols.capitalY[ENG]]);
    expect(interceptChance(w, m)).toBe(0);
    // A save in flight, the same game on.
    const t = sim();
    t.load(s.save());
    expect(t.world.nukeLaunches).toEqual(w.nukeLaunches);
    expect(t.hash()).toBe(s.hash());
    const told: number[] = [];
    for (let h = 0; h < 24 && w.nukeLaunches.length > 0; h++)
      s.step(1, (x) => {
        for (let i = 0; i < x.out.events.length; i += 6) if (x.out.events[i + 1] === EventKind.NukeDetonated || x.out.events[i + 1] === EventKind.NukeIntercepted) told.push(x.out.events[i + 1]!);
        x.out.events.length = 0;
      });
    expect(w.nukeLaunches).toHaveLength(0);
    expect(told).toHaveLength(2);
    expect(told).toContain(EventKind.NukeDetonated);
  });
});
