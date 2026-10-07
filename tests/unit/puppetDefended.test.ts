import { describe, expect, it } from 'vitest';
import { Refusal } from '../../src/shared/commands';
import { EventKind } from '../../src/shared/events';
import { SIZE_1938, TAGS_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { makePuppet } from '../../src/sim/systems/puppets';
import { TRUCE_TICKS, declareWar, whyNotWar } from '../../src/sim/systems/war';
import { assets1938 } from '../helpers/earth';
import { eventKinds, nationId, runEvents } from '../helpers/sim1938';

// PLAN 3.8e: a puppet is defended. On seed 3301 Iraq declared war on Syria on day 17 and
// Nationalist Spain on French West Africa on day 54, both puppets of France: each stood alone,
// since a declaration called the defender's puppets, allies and guarantors and not its overlord.
// A declaration on a puppet is now a declaration on its overlord (ADR-183).

const tag = (n: number): string => TAGS_1938[n - 1] ?? `nation ${n}`;
const [FRA, SYR, AOF, IRQ, IRN, TUR] = ['FRA', 'SYR', 'AOF', 'IRQ', 'IRN', 'TUR'].map(nationId) as [number, number, number, number, number, number];
const world1938 = (seed: number): Sim => new Sim({ scenario: '1938', seed, assets: assets1938(SIZE_1938.w) });

describe('a puppet is defended (PLAN 3.8e)', () => {
  it('seed 3301: in the first 60 days no war is declared on a puppet alone', () => {
    const s = world1938(3301);
    const found: string[] = [];
    s.step(24 * 60, (w) => {
      const ev = w.out.events;
      for (let i = 0; i < ev.length; i += 6) {
        const [a, d] = [ev[i + 2]!, ev[i + 3]!];
        const o = ev[i + 1] === EventKind.WarDeclared ? w.nations.cols.overlord[d]! : 0;
        if (o !== 0 && !w.wars.between(a, o)) found.push(`day ${Math.floor(w.tick / 24)}, ${tag(a)} -> ${tag(d)} without ${tag(o)}`);
      }
      w.out.events.length = 0;
      w.out.fires.length = 0;
    });
    expect(found).toEqual([]);
  }, 120_000);

  it('a declaration on a puppet is a war with its overlord, which leads the defenders', () => {
    const s = world1938(5);
    const w = s.world;
    expect(w.nations.cols.overlord[SYR]).toBe(FRA);
    expect(whyNotWar(w, IRQ, SYR)).toBe(Refusal.None);
    const war = declareWar(w, IRQ, SYR)!;
    expect(war.sides[0][0]).toBe(IRQ);
    expect(war.sides[1][0]).toBe(FRA);
    expect(war.sides[1]).toContain(SYR);
    expect(war.sides[1]).toContain(AOF);
    // The war is the overlord's: the event names it.
    expect(eventKinds(runEvents(s, 1), EventKind.WarDeclared).filter((e) => e[0] === IRQ)).toEqual([[IRQ, FRA]]);
  });

  it('God Mode: the same war', () => {
    const s = world1938(5);
    s.command({ kind: 'declareWar', attacker: IRN, defender: SYR });
    const ev = runEvents(s, 1);
    expect(eventKinds(ev, EventKind.CommandRefused)).toEqual([]);
    expect(eventKinds(ev, EventKind.WarDeclared).filter((e) => e[0] === IRN)).toEqual([[IRN, FRA]]);
    expect(s.world.wars.between(IRN, SYR)?.war.sides[1][0]).toBe(FRA);
  });

  it('what keeps a nation from war with the overlord keeps it from war with the puppet', () => {
    const w = world1938(5).world;
    w.wars.truces.push({ a: TUR, b: FRA, untilTick: w.tick + TRUCE_TICKS });
    expect(whyNotWar(w, TUR, SYR)).toBe(Refusal.Truce);
    expect(declareWar(w, TUR, SYR)).toBeNull();
    expect(w.wars.between(TUR, SYR)).toBeNull();
    w.wars.set(IRQ, FRA, true);
    expect(whyNotWar(w, IRQ, SYR)).toBe(Refusal.AtWar);
    expect(declareWar(w, IRQ, SYR)).toBeNull();
    expect(w.wars.atWar(IRQ, SYR)).toBe(false);
    // The overlord itself and a puppet against its overlord: as before.
    expect(whyNotWar(w, FRA, SYR)).toBe(Refusal.Subject);
    expect(whyNotWar(w, SYR, FRA)).toBe(Refusal.Subject);
  });

  it('the puppet named is in the war: an ally of it on the other side stays out, not it', () => {
    const w = world1938(5).world;
    // Iran becomes Turkey's puppet and the ally of Syria (a puppet may sit in an alliance of
    // its own, ADR-179). Turkey has no bond with Syria, and declares on it.
    w.alliances.leave(IRN);
    expect(makePuppet(w, TUR, IRN, 50)).toBe(true);
    expect(w.alliances.create(IRN, [SYR], 'alliance.defensive', 50)).not.toBeNull();
    expect(whyNotWar(w, TUR, SYR)).toBe(Refusal.None);
    const war = declareWar(w, TUR, SYR)!;
    expect(war.sides[1][0]).toBe(FRA);
    expect(war.sides[1]).toContain(SYR);
    expect(war.sides[0]).not.toContain(IRN);
    expect(war.sides[1]).not.toContain(IRN);
  });
});
