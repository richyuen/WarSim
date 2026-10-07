import { describe, expect, it } from 'vitest';
import { Refusal, type Command } from '../../src/shared/commands';
import { EventKind } from '../../src/shared/events';
import { isDayStart } from '../../src/shared/calendar';
import { SIZE_1938, TAGS_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { declareWar, whyNotWar } from '../../src/sim/systems/war';
import { assets1938 } from '../helpers/earth';
import { realmWars } from '../helpers/realmWars';
import { nationId, runEvents } from '../helpers/sim1938';

// PLAN 3.8 (the critic's R3-B4): no war inside one realm or one alliance. On seed 3301 the United
// Kingdom, which leads the alliance France is in, declared war on French West Africa, a puppet of
// France, on day 64 (6 March 1938), and seven French puppets came with it against their overlord's
// puppet; on day 55 Germany declared war on Austria, by then a puppet of its ally Italy.

const tag = (n: number): string => TAGS_1938[n - 1] ?? `nation ${n}`;
const [ENG, FRA, AOF, AEF, GER, ITA, ALB] = ['ENG', 'FRA', 'AOF', 'AEF', 'GER', 'ITA', 'ALB'].map(nationId) as [number, number, number, number, number, number, number];
const world1938 = (seed: number): Sim => new Sim({ scenario: '1938', seed, assets: assets1938(SIZE_1938.w) });

/** Sends `cmd`, steps a tick and returns the reasons of the refusals. */
function refused(s: Sim, cmd: Command): number[] {
  s.command(cmd);
  return runEvents(s, 1).filter((e) => e[1] === EventKind.CommandRefused).map((e) => e[3]!);
}

describe('no war inside one realm or one alliance (PLAN 3.8)', () => {
  it('seed 3301: on no day of the first 66 are two nations of one realm or of allied realms at war', () => {
    const s = world1938(3301);
    const found: string[] = [];
    s.step(24 * 66, (w) => {
      w.out.events.length = 0;
      w.out.fires.length = 0;
      if (isDayStart(w.tick) && found.length === 0) found.push(...realmWars(w, tag).map((l) => `day ${w.tick / 24}, ${l}`));
    });
    expect(found).toEqual([]);
  }, 120_000);

  it('the 1938 world as it starts: who may not declare war on whom, and why', () => {
    const w = world1938(5).world;
    expect(w.nations.cols.overlord[AOF]).toBe(FRA);
    expect(w.nations.cols.overlord[AEF]).toBe(FRA);
    expect(w.nations.cols.overlord[ALB]).toBe(ITA);
    expect(w.alliances.allied(ENG, FRA)).toBe(true);
    expect(w.alliances.allied(GER, ITA)).toBe(true);
    expect(w.alliances.allied(ENG, AOF)).toBe(false);
    // An overlord and its puppet, and allies: as before.
    expect(whyNotWar(w, FRA, AOF)).toBe(Refusal.Subject);
    expect(whyNotWar(w, AOF, FRA)).toBe(Refusal.Subject);
    expect(whyNotWar(w, ENG, FRA)).toBe(Refusal.Allied);
    // Two puppets of one overlord.
    expect(whyNotWar(w, AEF, AOF)).toBe(Refusal.SameOverlord);
    // A nation and the puppet of its ally, either way round; the puppets of two allies.
    expect(whyNotWar(w, ENG, AOF)).toBe(Refusal.AlliedRealm);
    expect(whyNotWar(w, AOF, ENG)).toBe(Refusal.AlliedRealm);
    expect(whyNotWar(w, GER, ALB)).toBe(Refusal.AlliedRealm);
    expect(whyNotWar(w, nationId('EGY'), AOF)).toBe(Refusal.AlliedRealm);
    // Strangers may.
    expect(whyNotWar(w, GER, AOF)).toBe(Refusal.None);
    expect(whyNotWar(w, GER, FRA)).toBe(Refusal.None);
    expect(declareWar(w, ENG, AOF)).toBeNull();
    expect(w.wars.atWar(ENG, AOF)).toBe(false);
    expect(realmWars(w, tag)).toEqual([]);
  });

  // PLAN 3.8c: France is the ally of the United Kingdom and guarantees Poland. It attacked Poland
  // with its ally while its puppets defended it.
  it('a guarantor that is the ally of the attacker stays out of the war, and its puppets with it', () => {
    const w = world1938(5).world;
    const POL = nationId('POL');
    const nc = w.nations.cols;
    expect(w.alliances.allied(ENG, FRA)).toBe(true);
    expect(w.alliances.guarantorsOf(POL)).toContain(FRA);
    expect(whyNotWar(w, ENG, POL)).toBe(Refusal.None);
    const war = declareWar(w, ENG, POL)!;
    expect(war).not.toBeNull();
    const french = [...war.sides[0], ...war.sides[1]].filter((n) => n === FRA || nc.overlord[n] === FRA).map(tag);
    expect(french).toEqual([]);
    expect(war.sides[0][0]).toBe(ENG);
    expect(war.sides[1][0]).toBe(POL);
    expect(war.sides[0]).toContain(nationId('EGY'));
    expect(realmWars(w, tag)).toEqual([]);
  });

  it('God Mode is told why', () => {
    const s = world1938(5);
    expect(refused(s, { kind: 'declareWar', attacker: ENG, defender: AOF })).toEqual([Refusal.AlliedRealm]);
    expect(refused(s, { kind: 'declareWar', attacker: AEF, defender: AOF })).toEqual([Refusal.SameOverlord]);
    expect(s.world.wars.atWar(ENG, AOF)).toBe(false);
    expect(s.world.wars.atWar(AEF, AOF)).toBe(false);
  });
});
