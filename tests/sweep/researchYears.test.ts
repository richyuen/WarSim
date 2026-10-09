import { expect, it } from 'vitest';
import { daysFromCivil } from '../../src/shared/calendar';
import { RULES_1938, SIZE_1938, TAGS_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { HELD_CATEGORIES } from '../../src/sim/systems/research';
import { knowsTechs, techMask } from '../../src/sim/tech';
import { assets1938 } from '../helpers/earth';

// PLAN 3.1b AT: a 1938 game without commands. No nation knows the heavy tank before 1942 (the
// year of a tech is a floor, ADR-128), and the rich know it within two years of 1942.
const RICH = 1000;

it('seed 99: nobody knows the heavy tank before 1942, the rich know it by 1944', () => {
  const s = new Sim({ scenario: '1938', seed: 99, assets: assets1938(SIZE_1938.w) });
  const w = s.world;
  const nc = w.nations.cols;
  const heavy = techMask([RULES_1938.techs.findIndex((t) => t.id === 'armor_heavy_1')]);
  const knowing = (): number[] => {
    const out: number[] = [];
    w.nations.forEach((n) => {
      if (knowsTechs(w, n, heavy)) out.push(n);
    });
    return out;
  };
  const quiet = (ww: typeof w): void => {
    ww.out.events.length = 0;
    ww.out.fires.length = 0;
  };
  const until = (year: number, month = 1): void => s.step((daysFromCivil(year, month, 1) - w.startDay) * 24 - w.tick, quiet);
  const richNow = (): number[] => {
    const out: number[] = [];
    w.nations.forEach((n) => {
      if (nc.living[n] === 1 && nc.income[n]! >= RICH) out.push(n);
    });
    return out;
  };
  until(1940);
  // Rich on the first day of every month of 1940 and 1941.
  let richThrough = richNow();
  // And up with the calendar as the two years begin: no tech of 1938 or before to learn (PLAN
  // 3.12Rm, ADR-224: in the game since, Latvia holds 3,689 cells in January 1940, with an income
  // of 3 until March 1939 and of 1,225 now. It has learnt one tech and has 14 of 1938 to 1941 to
  // go, 2,290 days of them on three lines: it learns all but `armor_medium_2` in the two
  // years, 13 techs, and that one in February 1942). The rules give no nation that begins so
  // far behind the tech in two years; Latvia too is in the check of 1944.
  const early = RULES_1938.techs.map((t, i) => (t.year <= 1938 && !HELD_CATEGORIES.includes(t.category) ? i : -1)).filter((i) => i >= 0);
  const abreast = richThrough.filter((n) => knowsTechs(w, n, techMask(early)));
  for (const year of [1940, 1941]) {
    for (let month = 2; month <= 12; month++) {
      until(year, month);
      const now = richNow();
      richThrough = richThrough.filter((n) => now.includes(n));
    }
  }
  // The last hour of 1941.
  until(1942);
  expect(knowing()).toEqual([]);
  // Research went on meanwhile: every nation that was rich through 1940 and 1941, and began
  // them abreast of the calendar, knows a tech of 1941. The two years are the premise this check always had (PLAN 3.4Rj, ADR-147: in the
  // game since, Denmark's income in peace is 157 until it takes 1,096 cells of Germany at the
  // peace of February 1941, and 1,087 after; rich for ten months, it has learnt 6 techs, the
  // earliest first, and has 6 of 1939 and 1940 to go before `armor_medium_2`). The check of
  // 1944 below takes every nation that is rich in 1942, Denmark too.
  // Through the two years, month by month, and not on their first and last day alone (PLAN
  // 3.5c, ADR-153: in the game since, France is rich in January 1940, between two wars with
  // Germany, and in 1942; from March 1940 to the peace of May 1941 Germany holds it and its
  // income is 158, a seventh. It has four techs of 1940 and 1941 to go). France too is in
  // the check of 1944.
  const medium2 = techMask([RULES_1938.techs.findIndex((t) => t.id === 'armor_medium_2')]);
  const rich = richNow();
  const richBoth = rich.filter((n) => richThrough.includes(n) && abreast.includes(n));
  expect(richBoth.length).toBeGreaterThanOrEqual(3);
  for (const n of richBoth) expect(knowsTechs(w, n, medium2), `${TAGS_1938[n - 1]} knows armor_medium_2 in 1942`).toBe(true);
  until(1944);
  const known = knowing();
  for (const n of rich) if (nc.living[n] === 1 && nc.income[n]! >= RICH) expect(known, `${TAGS_1938[n - 1]} knows armor_heavy_1 in 1944`).toContain(n);
  expect(known.length).toBeGreaterThanOrEqual(3);
}, 900_000);

// PLAN 3.4Rg AT (ADR-144): a nation that is played, or lives in a world with no AI, researches
// as the AI's nations do. Two years: the United States taken at tick 0, its AI twin, and a world
// with the AI off from the start.
// The nation was France until PLAN 3.10c1 (ADR-187). What is compared is two years of research
// by a nation that can pay for it, and in the game since, France is held by Germany from the
// autumn of 1938 in both games that have an AI (an income of 156, a seventh): it learns four
// techs in the two years, played or not, and the one tech of 1939 among them, the day it is
// paid for, is `naval_aviation` in the one game and `infantry_weapons_2` in the other. The
// United States is at peace in all three games and learns the same ten techs in each.
it('seed 99: the United States played from tick 0, and in a world with no AI, know after two years a tech of 1939 that the AI\'s United States knows', () => {
  const USA = TAGS_1938.indexOf('USA') + 1;
  const make = (): Sim => new Sim({ scenario: '1938', seed: 99, assets: assets1938(SIZE_1938.w) });
  const quiet = (ww: Sim['world']): void => {
    ww.out.events.length = 0;
    ww.out.fires.length = 0;
  };
  const twoYears = (s: Sim): number[] => {
    const start = RULES_1938.techs.flatMap((_, i) => (knowsTechs(s.world, USA, techMask([i])) ? [i] : []));
    s.step((daysFromCivil(1940, 1, 1) - s.world.startDay) * 24 - s.world.tick, quiet);
    return RULES_1938.techs.flatMap((_, i) => (!start.includes(i) && knowsTechs(s.world, USA, techMask([i])) ? [i] : []));
  };
  const ai = twoYears(make());
  const played = make();
  played.command({ kind: 'setPlayer', nation: USA });
  const mine = twoYears(played);
  const noAi = make();
  noAi.world.settings.aiEnabled = false;
  const alone = twoYears(noAi);
  const of1939 = (l: number[]): number[] => l.filter((i) => RULES_1938.techs[i]!.year === 1939);
  expect(of1939(ai).length).toBeGreaterThan(0);
  for (const [name, l] of [['played', mine], ['no AI', alone]] as const) {
    expect(l.length, `${name}: techs learned in two years (the AI's: ${ai.length})`).toBeGreaterThanOrEqual(ai.length - 2);
    expect(of1939(l).some((i) => of1939(ai).includes(i)), `${name}: a tech of 1939 the AI's knows`).toBe(true);
  }
}, 900_000);
