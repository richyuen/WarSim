/**
 * Nuclear weapons (SPEC §6.4, PLAN 6): the programme and its toggles (PLAN 6.1a).
 *
 * Nukes are allowed to a nation where the world allows them (`settings.nukesEnabled`, from the
 * scenario's `nukesEnabled`, God Mode's `setSetting`) and the nation is not barred
 * (`world.nukesBanned`, God Mode's `setNukes`).
 *
 * Who goes for the bomb (SPEC §3.7's "decided in Phase 6"): a nation allowed nukes whose monthly
 * income is NUKE_PROGRAMME_INCOME or more: a great power, the programme being dear (on 1 February
 * 1938 of seed 1: the United States, the United Kingdom, Germany, the Soviet Union and France).
 * For it the `nuclear` category is no longer held back from research (`nextTech`): it takes the
 * chain by year and prerequisites as any other tech. A nation that loses the right keeps what it
 * knows, and its nuclear lines are not paid.
 *
 * Warheads (PLAN 6.1b, `nuclearSystem`, daily at 00:00): a nation that goes for the bomb and
 * knows it (`atomic_bomb`) builds one warhead at a time: WARHEAD_GOLD paid by the day over
 * WARHEAD_DAYS out of its treasury, the day's share only where the treasury holds it (never into
 * debt), up to WARHEAD_MAX in its stockpile (`world.warheads`, state). A stockpile costs
 * WARHEAD_UPKEEP a warhead a month, with the rest of its expenses (`monthlyAccounts`). God Mode
 * grants warheads (`grantWarheads`). A nation that dies loses its stockpile.
 */
import { isDayStart } from '../../shared/calendar';
import { knowsTechs, techMask } from '../tech';
import type { World } from '../world';

/** Monthly income, gold, from which a nation allowed nukes runs a programme. */
export const NUKE_PROGRAMME_INCOME = 1000;

/** Whether nation `n` may have nuclear weapons: the world's toggle and its own. */
export function nukesAllowed(world: World, n: number): boolean {
  return world.settings.nukesEnabled && !world.nukesBanned.has(n);
}

/** Whether nation `n` runs a nuclear programme: allowed, and the income of a great power. */
export function goesForBomb(world: World, n: number): boolean {
  return nukesAllowed(world, n) && world.nations.cols.income[n]! >= NUKE_PROGRAMME_INCOME;
}

/** A warhead's gold, paid by the day over WARHEAD_DAYS (about 6 % of Germany's income of 1938). */
export const WARHEAD_GOLD = 400;
export const WARHEAD_DAYS = 90;
/** The most warheads a stockpile holds. */
export const WARHEAD_MAX = 100;
/** Gold a warhead costs a month, kept. */
export const WARHEAD_UPKEEP = 10;

/** Nation `n`'s warheads (0 for none). */
export function warheadsOf(world: World, n: number): number {
  return world.warheads.get(n)?.stock ?? 0;
}

/** The day's warhead work (PLAN 6.1b): see the head of the file. */
export function nuclearSystem(world: World): void {
  const rules = world.rules;
  if (!rules || !isDayStart(world.tick)) return;
  const bomb = rules.techs.findIndex((t) => t.id === 'atomic_bomb');
  const nc = world.nations.cols;
  // A dead nation's stockpile goes with it.
  for (const n of [...world.warheads.keys()]) if (!world.nations.has(n) || nc.living[n] !== 1) world.warheads.delete(n);
  if (bomb < 0) return;
  const mask = techMask([bomb]);
  const pay = WARHEAD_GOLD / WARHEAD_DAYS;
  world.nations.forEach((n) => {
    if (nc.living[n] !== 1 || nc.bankrupt[n] === 1 || !goesForBomb(world, n) || !knowsTechs(world, n, mask)) return;
    const w = world.warheads.get(n) ?? { stock: 0, paid: 0 };
    if (w.stock >= WARHEAD_MAX || nc.gold[n]! < pay) return;
    nc.gold[n] = nc.gold[n]! - pay;
    w.paid += pay;
    if (w.paid >= WARHEAD_GOLD - 1e-9) {
      w.stock++;
      w.paid = 0;
    }
    world.warheads.set(n, w);
  });
}
