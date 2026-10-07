import { describe, expect, it } from 'vitest';
import { Refusal, type Command } from '../../src/shared/commands';
import { EventKind } from '../../src/shared/events';
import { isDayStart } from '../../src/shared/calendar';
import { SIZE_1938, TAGS_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { canJoin, noWarAmong } from '../../src/sim/systems/alliances';
import { annexNation, makePuppet } from '../../src/sim/systems/puppets';
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

  // PLAN 3.8d1: seed 1, day 199. Republican Spain was at war with French West Africa and French
  // Equatorial Africa when the peace of its war with France made it France's puppet: two wars
  // inside one realm from that hour.
  it('a nation made a puppet leaves its wars against its new realm, and the land held in them goes back', () => {
    const w = world1938(5).world;
    const [REP, POR] = [nationId('REP'), nationId('POR')];
    const { owner, controller } = w.cells;
    const first = (n: number): number => owner.findIndex((o, c) => o === n && controller[c] === n);
    // Portugal leads a war on French West Africa with Republican Spain; Republican Spain leads
    // one on French Equatorial Africa; and it fights Germany, a stranger to France.
    const shared = w.wars.start([POR, REP], [AOF], w.tick);
    const own = w.wars.start([REP], [AEF], w.tick);
    const other = w.wars.start([GER], [REP], w.tick);
    const [inAof, inRep, inGer] = [first(AOF), first(REP), first(GER)];
    w.setController(inAof, REP);
    w.setController(inRep, AEF);
    w.setController(inGer, REP);
    expect(realmWars(w, tag)).toEqual([]);
    expect(makePuppet(w, FRA, REP, 30)).toBe(true);
    expect(realmWars(w, tag)).toEqual([]);
    expect(w.wars.atWar(REP, AOF)).toBe(false);
    expect(w.wars.atWar(REP, AEF)).toBe(false);
    // The war of Portugal goes on without it; the war it led alone has ended; the third stands.
    expect(w.wars.list.includes(shared)).toBe(true);
    expect(shared.sides).toEqual([[POR], [AOF]]);
    expect(w.wars.list.includes(own)).toBe(false);
    expect(w.wars.atWar(GER, REP)).toBe(true);
    expect(other.sides).toEqual([[GER], [REP]]);
    expect(controller[inAof]).toBe(AOF);
    expect(controller[inRep]).toBe(REP);
    expect(controller[inGer]).toBe(REP);
  });

  // PLAN 3.8d2: seed 1, day 300. Poland annexed Hungary and got its puppet Albania, which was at
  // war with Italy, Germany, Latvia and Japan, the allies of Poland.
  it('a puppet handed to an annexer leaves its wars against the annexer, its realm and its allies', () => {
    const w = world1938(5).world;
    const POR = nationId('POR');
    const nc = w.nations.cols;
    const { owner, controller } = w.cells;
    const first = (n: number): number => owner.findIndex((o, c) => o === n && controller[c] === n);
    // The United Kingdom fights Italy and its puppet Albania; France, the ally of the United
    // Kingdom, fights Albania in a war of its own; and so does Portugal, a stranger to both.
    const direct = w.wars.start([ENG], [ITA, ALB], w.tick);
    const allied = w.wars.start([FRA], [ALB], w.tick);
    const other = w.wars.start([POR], [ALB], w.tick);
    const [inAlb, inFra, inPor] = [first(ALB), first(FRA), first(POR)];
    w.setController(inAlb, FRA);
    w.setController(inFra, ALB);
    w.setController(inPor, ALB);
    expect(realmWars(w, tag)).toEqual([]);
    expect(annexNation(w, ENG, ITA)).toBe(true);
    expect(nc.living[ITA]).toBe(0);
    expect(nc.overlord[ALB]).toBe(ENG);
    expect(realmWars(w, tag)).toEqual([]);
    expect(w.wars.atWar(ALB, ENG)).toBe(false);
    expect(w.wars.atWar(ALB, FRA)).toBe(false);
    // The two wars have nobody left on one side; the stranger's war stands.
    expect(w.wars.list.includes(direct)).toBe(false);
    expect(w.wars.list.includes(allied)).toBe(false);
    expect(w.wars.atWar(POR, ALB)).toBe(true);
    expect(other.sides).toEqual([[POR], [ALB]]);
    expect(controller[inAlb]).toBe(ALB);
    expect(controller[inFra]).toBe(FRA);
    expect(controller[inPor]).toBe(ALB);
  });

  // PLAN 3.8d3: an alliance ties its members' puppets too (`bond`). The rules asked only whether
  // the nations named were at war with each other.
  it('nobody joins or founds an alliance while its realm is at war with the realm of a member', () => {
    const [POR, SWI, SWE] = ['POR', 'SWI', 'SWE'].map(nationId) as [number, number, number];
    const rejected = (s: Sim, cmd: Command): number => {
      s.command(cmd);
      return runEvents(s, 1).filter((e) => e[1] === EventKind.AllianceRejected).length;
    };
    const free = (w: Sim['world']): void => {
      for (const n of [POR, SWI, SWE]) expect(w.alliances.allianceOf(n) === undefined && w.nations.cols.overlord[n] === 0, tag(n)).toBe(true);
    };
    // The joiner is at war with a member's puppet: Portugal with French West Africa.
    let s = world1938(5);
    let w = s.world;
    free(w);
    const entente = w.alliances.allianceOf(FRA)!;
    w.wars.start([POR], [AOF], w.tick);
    expect(canJoin(w, POR, entente)).toBe(false);
    expect(canJoin(w, SWI, entente)).toBe(true);
    expect(refused(s, { kind: 'joinAlliance', nation: POR, alliance: entente.id })).toEqual([Refusal.AtWar]);
    expect(rejected(s, { kind: 'proposeAlliance', from: FRA, to: POR })).toBe(1);
    expect(w.alliances.allianceOf(POR)).toBeUndefined();
    expect(realmWars(w, tag)).toEqual([]);
    // A puppet of the joiner is at war with a member: Switzerland, of Portugal, with France.
    s = world1938(5);
    w = s.world;
    w.wars.start([SWI], [FRA], w.tick);
    expect(makePuppet(w, POR, SWI, 30)).toBe(true);
    expect(w.wars.atWar(SWI, FRA)).toBe(true);
    expect(canJoin(w, POR, w.alliances.allianceOf(FRA)!)).toBe(false);
    expect(refused(s, { kind: 'joinAlliance', nation: POR, alliance: w.alliances.allianceOf(FRA)!.id })).toEqual([Refusal.AtWar]);
    expect(rejected(s, { kind: 'proposeAlliance', from: ENG, to: POR })).toBe(1);
    expect(w.alliances.allianceOf(POR)).toBeUndefined();
    expect(realmWars(w, tag)).toEqual([]);
    // Founders: Sweden is at war with Switzerland, a puppet of Portugal.
    s = world1938(5);
    w = s.world;
    expect(makePuppet(w, POR, SWI, 30)).toBe(true);
    w.wars.start([SWE], [SWI], w.tick);
    expect(noWarAmong(w, [POR, SWE])).toBe(false);
    expect(noWarAmong(w, [POR, nationId('NOR')])).toBe(true);
    expect(refused(s, { kind: 'createAlliance', leader: POR, members: [SWE], nameKey: 'alliance.defensive' })).toEqual([Refusal.AtWar]);
    expect(rejected(s, { kind: 'proposeAlliance', from: POR, to: SWE })).toBe(1);
    expect(rejected(s, { kind: 'proposeAlliance', from: SWE, to: POR })).toBe(1);
    expect(w.alliances.allied(POR, SWE)).toBe(false);
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
