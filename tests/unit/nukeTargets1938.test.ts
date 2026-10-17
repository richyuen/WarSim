import { describe, expect, it } from 'vitest';
import { cellOf } from '../../src/sim/data/terrain';
import { SIZE_1938, TEMPLATES_LAND } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { blastRadius, CAPITAL_RESTRIKE_DAYS, detonate, FRONT_KM, nukeTargets, RESTRIKE_DAYS } from '../../src/sim/systems/nuclear';
import { seaKm } from '../../src/sim/systems/navalCombat';
import { declareWar } from '../../src/sim/systems/war';
import { assets1938 } from '../helpers/earth';
import { nationId } from '../helpers/sim1938';

// PLAN 6.11a (critic R6-B2): the places the AI weighs for a warhead are on land the enemy side
// owns and controls, within FRONT_KM of the striker's side (its land formations, its capitals).
// Germany at war with the United Kingdom: twelve British divisions massed in Kent are weighed;
// twelve at Aden, a colony far from every front, are not; nor twelve on Germany's own land at
// Cologne, nor twelve in neutral Belgium, nor those in Kent once no one holds their land.
// PLAN 6.11b: nor a place within a blast radius of a burst of the last RESTRIKE_DAYS, or of a
// warhead in flight; the bursts are saved.

const { w: W, h: H } = SIZE_1938;
const [ENG, GER] = ['ENG', 'GER'].map(nationId) as [number, number];
const kent = cellOf(0.9, 51.2, W, H);
const aden = cellOf(44.9, 13.4, W, H);
const cologne = cellOf(6.96, 50.94, W, H);
const belgium = cellOf(4.6, 50.6, W, H);
const inf = TEMPLATES_LAND.findIndex((t) => t.id === 'infantry_div');

const near = (places: [number, number][], at: readonly [number, number]): boolean => places.some(([x, y]) => Math.hypot(x - at[0], y - at[1]) < 1.5);

describe('where the AI\'s warheads may fall (PLAN 6.11a)', () => {
  it('Germany against the United Kingdom: a mass in Kent is weighed, one at Aden, on German land or in Belgium is not', () => {
    const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
    const w = s.world;
    s.step(1);
    const war = declareWar(w, GER, ENG, true)!;
    for (const at of [kent, aden, cologne, belgium]) {
      for (let k = 0; k < 12; k++) s.command({ kind: 'spawnFormation', nation: ENG, x: at[0] + (k % 4) * 0.3, y: at[1] + Math.floor(k / 4) * 0.3, strength: 0, template: inf });
    }
    s.step(1);
    const { owner, controller } = w.cells;
    const cell = (at: readonly [number, number]): number => Math.floor(at[1]) * W + Math.floor(at[0]);
    // The scene: Kent and Aden British, Cologne German, Belgium neutral.
    expect([owner[cell(kent)], owner[cell(aden)], owner[cell(cologne)], controller[cell(cologne)], owner[cell(belgium)]]).toEqual([ENG, ENG, GER, GER, nationId('BEL')]);
    const places = nukeTargets(w, GER, war, 0);
    process.stderr.write(`Germany's places: ${JSON.stringify(places.map(([x, y]) => [x.toFixed(1), y.toFixed(1)]))}\n`);
    expect(near(places, kent), 'Kent').toBe(true);
    expect(near(places, aden), 'Aden').toBe(false);
    expect(near(places, cologne), 'Cologne').toBe(false);
    expect(near(places, belgium), 'Belgium').toBe(false);
    // Every place weighed: owned and controlled by the British side (Ireland is on it).
    for (const [x, y] of places) {
      const c = Math.floor(y) * W + Math.floor(x);
      expect(war.sides[1].includes(owner[c]!) && war.sides[1].includes(controller[c]!), `${owner[c]} ${controller[c]}`).toBe(true);
    }
    // London is weighed (930 km from Berlin, nearer German formations).
    const london = [w.nations.cols.capitalX[ENG]!, w.nations.cols.capitalY[ENG]!] as const;
    expect(near(places, london), 'London').toBe(true);
    expect(FRONT_KM).toBe(1000);

    // Kent's land held by no one: no longer weighed.
    for (let dy = -2; dy <= 3; dy++) for (let dx = -2; dx <= 3; dx++) {
      const c = (Math.floor(kent[1]) + dy) * W + Math.floor(kent[0]) + dx;
      owner[c] = 0;
      controller[c] = 0;
    }
    expect(near(nukeTargets(w, GER, war, 0), kent), 'Kent, held by no one').toBe(false);
  });

  it('a capital far from every front is not weighed: the United Kingdom\'s, moved to Aden', () => {
    const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
    const w = s.world;
    s.step(1);
    const war = declareWar(w, GER, ENG, true)!;
    const nc = w.nations.cols;
    nc.capitalX[ENG] = aden[0];
    nc.capitalY[ENG] = aden[1];
    const places = nukeTargets(w, GER, war, 0);
    expect(near(places, aden)).toBe(false);
    // Moved back to London, it is.
    const london = cellOf(-0.12, 51.5, W, H);
    nc.capitalX[ENG] = london[0];
    nc.capitalY[ENG] = london[1];
    expect(near(nukeTargets(w, GER, war, 0), london)).toBe(true);
  });

  it('a spot struck the day before, or one a warhead is flying to, is not weighed again; a capital not for a year (PLAN 7.6e); the bursts are saved', () => {
    const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
    const w = s.world;
    w.settings.nukesEnabled = true;
    s.step(1);
    const war = declareWar(w, GER, ENG, true)!;
    for (let k = 0; k < 12; k++) s.command({ kind: 'spawnFormation', nation: ENG, x: kent[0] + (k % 4) * 0.3, y: kent[1] + Math.floor(k / 4) * 0.3, strength: 0, template: inf });
    s.step(1);
    expect(near(nukeTargets(w, GER, war, 0), kent)).toBe(true);
    // A burst at London (God's: no grievance, no outrage): London is not weighed for a week.
    const london = [w.nations.cols.capitalX[ENG]!, w.nations.cols.capitalY[ENG]!] as const;
    expect(near(nukeTargets(w, GER, war, 0), london)).toBe(true);
    detonate(w, 0, 1, london[0], london[1]);
    s.step(24);
    const places = nukeTargets(w, GER, war, 0);
    expect(near(places, london), 'London the day after').toBe(false);
    for (const [x, y] of places) for (const b of w.nukeBursts) expect(seaKm(w, x, y, b.x, b.y)).toBeGreaterThan(blastRadius(1));
    // A save carries the burst.
    const c = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
    c.load(s.save());
    expect(c.world.nukeBursts).toEqual(w.nukeBursts);
    expect(w.nukeBursts.length).toBe(1);
    // A warhead flying to Kent: Kent is not weighed while it flies.
    w.nukeLaunches.push({ id: w.nextLaunchId++, nation: GER, missile: 1, wing: 0, bx: 0, by: 0, tx: kent[0], ty: kent[1], launch: w.tick, arrive: w.tick + 1000 });
    expect(near(nukeTargets(w, GER, war, 0), kent), 'Kent, a warhead on its way').toBe(false);
    w.nukeLaunches.length = 0;
    // A week on, London is a capital struck within the year (PLAN 7.6e, ADR-465; before, weighed
    // again a week on): not weighed, and the burst remembered.
    s.step(RESTRIKE_DAYS * 24);
    expect(w.nukeBursts.length).toBe(1);
    expect(near(nukeTargets(w, GER, war, 0), london), 'London a week on').toBe(false);
    // A year on (the burst's time moved back, and a day for the nuclear system to forget it):
    // London weighed again, and the burst forgotten.
    w.nukeBursts[0]!.tick -= CAPITAL_RESTRIKE_DAYS * 24;
    s.step(24);
    expect(w.nukeBursts.length).toBe(0);
    expect(near(nukeTargets(w, GER, war, 0), london), 'London a year on').toBe(true);
  });
});
