import { expect, it } from 'vitest';
import { isDayStart } from '../../src/shared/calendar';
import { SIZE_1938, TAGS_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { assets1938 } from '../helpers/earth';
import { realmWars } from '../helpers/realmWars';

// PLAN 3.8c: nobody joins a war against a nation it has a bond with. Two games that had such
// joiners (ADR-178): seed 1, day 125, Yugoslavia, a puppet of Italy in another alliance, among
// the enemies of Italy; seed 3301, day 822, Latvia, a puppet of Germany and the ally of Estonia,
// among the defenders of Estonia against Germany. A change of the rules moves the days on which
// these games declare their wars: what is asserted is every day of the stretch, not those wars.

const tag = (n: number): string => TAGS_1938[n - 1] ?? `nation ${n}`;

function firstRealmWar(seed: number, days: number): string[] {
  const s = new Sim({ scenario: '1938', seed, assets: assets1938(SIZE_1938.w) });
  const found: string[] = [];
  s.step(24 * days, (w) => {
    w.out.events.length = 0;
    w.out.fires.length = 0;
    if (isDayStart(w.tick) && found.length === 0) found.push(...realmWars(w, tag).map((l) => `day ${w.tick / 24}, ${l}`));
  });
  return found;
}

// PLAN 3.8d1: and to day 250. On day 199 the peace of France with Republican Spain made it France's
// puppet while it fought two other puppets of France in two other wars.
// PLAN 3.8d2: and to day 305. On day 300 Poland annexed Hungary and got its puppet Albania, at war
// with four allies of Poland.
it('seed 1, 305 days: on no day are two nations of one realm or of allied realms at war', () => {
  expect(firstRealmWar(1, 305)).toEqual([]);
}, 300_000);

it('seed 3301, 825 days: on no day are two nations of one realm or of allied realms at war', () => {
  expect(firstRealmWar(3301, 825)).toEqual([]);
}, 900_000);
