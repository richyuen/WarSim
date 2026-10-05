import { describe, expect, it } from 'vitest';
import type { FromWorker, WarBattle } from '../../src/shared/protocol';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { cellDist, contactsOf, deployOf, destroyFormation, elementIndex, elementPlace, slotCount } from '../../src/sim/systems/elements';
import { largestBattle, type WarBattleSite } from '../../src/sim/systems/warBattle';
import type { World } from '../../src/sim/world';
import { SimServer } from '../../src/worker/server';
import { assets1938 } from '../helpers/earth';
import { addDivision, nationId } from '../helpers/sim1938';

// PLAN 2.14e (the critic's R2-B2, "nothing leads to a battle"): a click on a war's banner
// brings its largest battle into view. This is what the worker answers: the war's largest
// battle by men, and the point between two of its formations that stand front to front.
//
// Germany against Poland with the armies of the start taken off the map: the only formations
// in contact are the divisions put down here, either side of the border. (Divisions of nations
// from elsewhere would not stay: a formation on a neutral's land is sent home.)

const W = SIZE_1938.w;
const GER = nationId('GER');
const POL = nationId('POL');

/** Middles of German cells with a Polish one east of it and land between, top to bottom. */
function borders(w: World): [number, number][] {
  const { owner, w: cw, h: ch } = w.cells;
  const out: [number, number][] = [];
  for (let y = 1; y < ch - 1; y++) for (let x = 1; x < cw - 2; x++) if (owner[y * cw + x] === GER && owner[y * cw + x + 1] === POL && w.onLand(x + 0.5, y + 0.5) && w.onLand(x + 1.5, y + 0.5) && w.onLand(x + 1, y + 0.5)) out.push([x + 0.5, y + 0.5]);
  return out;
}

function game(): { s: Sim; w: World; north: [number, number]; south: [number, number] } {
  const s = new Sim({ scenario: '1938', seed: 99, assets: assets1938(W) });
  const w = s.world;
  w.settings.aiEnabled = false;
  for (const f of w.formations.ids()) destroyFormation(w, f);
  const sites = borders(w);
  const north = sites[0]!;
  // Far enough from the first that the two are not one battle.
  const south = sites.find((p) => p[1] - north[1] > 6);
  if (!south) throw new Error('no second border site six cells from the first');
  return { s, w, north, south };
}

const warOf = (w: World, a: number, b: number): number => w.wars.list.find((x) => x.sides[0].includes(a) && x.sides[1].includes(b))!.id;

describe('the largest battle of a war (PLAN 2.14e)', () => {
  it('is null for a war with no formations in contact, and for no war', () => {
    const { s, w, north } = game();
    addDivision(w, GER, north[0], north[1]);
    addDivision(w, POL, north[0] + 3, north[1]);
    s.command({ kind: 'declareWar', attacker: GER, defender: POL });
    s.step(2);
    const war = warOf(w, GER, POL);
    expect(largestBattle(w, war)).toBeNull();
    expect(largestBattle(w, 999_999)).toBeNull();
  });

  it('is the one with the most men; the point is between two of its formations that face each other; asking changes nothing', () => {
    const { s, w, north, south } = game();
    // North: one division against one. South: two against one, the second German a little further off.
    const n1 = addDivision(w, GER, north[0], north[1]);
    const n2 = addDivision(w, POL, north[0] + 1, north[1]);
    const s1 = addDivision(w, GER, south[0], south[1]);
    const s2 = addDivision(w, POL, south[0] + 1, south[1]);
    const s3 = addDivision(w, GER, south[0] - 0.2, south[1] + 0.4);
    s.command({ kind: 'declareWar', attacker: GER, defender: POL });
    s.step(2);
    const fc = w.formations.cols;
    expect([n1, n2, s1, s2, s3].map((f) => fc.engaged[f])).toEqual([1, 1, 1, 1, 1]);
    const war = warOf(w, GER, POL);
    const hash = s.hash();
    const before = w.deployedBefore;
    const deployed = w.deployed;
    const b = largestBattle(w, war)!;
    expect(b.war).toBe(war);
    expect(b.count).toEqual([2, 1]);
    expect(b.men).toEqual([fc.strength[s1]! + fc.strength[s3]!, fc.strength[s2]!]);
    // The pair that are each other's nearest: s1 and s2, a cell apart (s3 is 1.26 cells from s2).
    expect(b.formations).toEqual([s1, s2]);
    const da = deployOf(w, s1, 28)!;
    const db = deployOf(w, s2, 28)!;
    expect(b.x).toBeCloseTo((da.x + db.x) / 2, 9);
    expect(b.y).toBeCloseTo((da.y + db.y) / 2, 9);
    // Between the two formations' places, which are where they were.
    expect(b.x).toBeCloseTo(south[0] + 0.5, 2);
    expect(b.y).toBeCloseTo(south[1], 2);
    // Nothing changed: the state, and the hour's deployments with the hour before's.
    expect(s.hash()).toBe(hash);
    expect(w.deployedBefore).toBe(before);
    expect(w.deployed).toBe(deployed);
    // The world's other wars have no battle: their armies are gone.
    for (const other of w.wars.list) if (other.id !== war) expect(largestBattle(w, other.id)).toBeNull();

    // The northern battle becomes the larger one: two more Polish divisions by it.
    addDivision(w, POL, north[0] + 1.2, north[1] + 0.5);
    addDivision(w, POL, north[0] + 1.2, north[1] - 0.5);
    s.step(1);
    const c = largestBattle(w, war)!;
    expect(c.count).toEqual([1, 3]);
    expect(c.formations).toEqual([n1, n2]);
    expect(c.y).toBeCloseTo(north[1], 2);
  });
});

// PLAN 2.14f5a: the same on a real front. The tests above have the pair put down for them; here
// the armies of the start fight for 60 days (Germany against Poland by command, and the wars
// the AI declares meanwhile). Every six hours, for every war: the two formations the answer
// names stand whole, every element of each, in the view the camera takes on the answer's point
// (`MapView.showBattle`: 20 m/px, so 28 by 16 km in a view of 1400 × 800), 50 px clear of its
// edges. The fear was a battle with no two formations that are each other's nearest enemy: its
// two could stand 29 km apart with their blocks towards others.
describe('the largest battle of a war on a front of 60 days (PLAN 2.14f5a)', () => {
  it('names two formations whose blocks are whole in the view the camera takes', () => {
    const s = new Sim({ scenario: '1938', seed: 99, assets: assets1938(W) });
    s.command({ kind: 'declareWar', attacker: GER, defender: POL });
    /** Half the view less 50 px, in cells (a cell is 19.57 km). */
    const HALF = { w: (700 - 50) * 20 / 19_570, h: (400 - 50) * 20 / 19_570 };
    const n = { asked: 0, battles: 0, mutual: 0, oneWay: 0, neither: 0, outside: 0, germanPolish: 0, widest: 0 };
    const outside: string[] = [];
    let last: WarBattleSite | null = null;
    s.step(24 * 60, (w) => {
      w.out.events.length = 0;
      w.out.fires.length = 0;
      if (w.tick % 6 !== 0) return;
      const idx = elementIndex(w);
      const contacts = contactsOf(w);
      for (const war of w.wars.list) {
        n.asked++;
        const b = largestBattle(w, war.id);
        const ours = war.sides[0].includes(GER) && war.sides[1].includes(POL);
        if (ours) last = b;
        if (!b) continue;
        n.battles++;
        if (ours) n.germanPolish++;
        const [a, d] = b.formations;
        const rank = (contacts.get(a) === d ? 1 : 0) + (contacts.get(d) === a ? 1 : 0);
        if (rank === 2) n.mutual++;
        else if (rank === 1) n.oneWay++;
        else n.neither++;
        const blocks = [a, d].map((f) => deployOf(w, f, slotCount(w, f, idx.get(f)?.length ?? 0))!);
        n.widest = Math.max(n.widest, cellDist(w, blocks[0]!.x, blocks[0]!.y, blocks[1]!.x, blocks[1]!.y));
        let whole = true;
        for (const f of [a, d]) {
          const list = idx.get(f) ?? [];
          expect(list.length, `elements of formation ${f}`).toBeGreaterThan(0);
          const slots = slotCount(w, f, list.length);
          for (const e of list) {
            const p = elementPlace(w, f, w.elements.cols.slot[e]!, slots);
            let dx = Math.abs(p[0] - b.x);
            if (dx > W / 2) dx = W - dx;
            if (dx >= HALF.w || Math.abs(p[1] - b.y) >= HALF.h) whole = false;
          }
        }
        if (!whole) {
          n.outside++;
          if (outside.length < 5) outside.push(`hour ${w.tick}, war ${war.id}, formations ${a} and ${d}, each other's nearest: ${rank} of 2`);
        }
      }
    });
    console.log(
      `60 days of Germany against Poland (seed 99), every six hours, every war: asked ${n.asked} times, a battle ${n.battles} times (${n.germanPolish} of Germany against Poland); ` +
        `the two named are each other's nearest enemy in ${n.mutual}, one the other's in ${n.oneWay}, neither in ${n.neither}; ` +
        `their blocks at most ${(n.widest * 19.57).toFixed(1)} km apart; not whole in the view ${n.outside} times`,
    );
    expect(outside).toEqual([]);
    expect(n.battles).toBeGreaterThan(500);
    expect(n.germanPolish).toBeGreaterThan(200);
    // The front is there on the last day: the banner of this war leads somewhere.
    expect(last).not.toBeNull();
  });
});

describe('the worker\'s answer to `warBattle` (PLAN 2.14e)', () => {
  it('is null for a war that is not there, and changes nothing', () => {
    const replies: FromWorker[] = [];
    const server = new SimServer((msg) => replies.push(msg));
    server.handle({ type: 'init', reqId: 1, init: { scenario: 'toy', seed: 3 } }, 0);
    server.handle({ type: 'step', reqId: 2, n: 30 }, 0);
    const hash = server.sim!.hash();
    const ask = (war: number): WarBattle | null => {
      const reqId = 100 + replies.length;
      server.handle({ type: 'warBattle', reqId, war }, 0);
      const r = replies.find((m) => m.type === 'reply' && m.reqId === reqId);
      if (!r || r.type !== 'reply' || !r.bytes) throw new Error('no reply with bytes');
      return JSON.parse(new TextDecoder().decode(r.bytes)) as WarBattle | null;
    };
    for (const none of [0, -1, 1.5, 999_999, Number.NaN]) expect(ask(none), String(none)).toBeNull();
    // Every war of the toy world: an answer of that war and this tick, or null.
    for (const war of server.sim!.world.wars.list) {
      const b = ask(war.id);
      if (b) expect(b).toMatchObject({ war: war.id, tick: 30 });
    }
    expect(server.sim!.hash()).toBe(hash);
    expect(replies.filter((r) => r.type === 'error')).toEqual([]);
  });
});
