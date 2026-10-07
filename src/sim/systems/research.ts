/**
 * Research (SPEC §3.7, PLAN 3.1b, ADR-128): how a nation comes to know a tech. Daily at 00:00.
 *
 * A nation has a research budget, gold per day (`nations.research`, set monthly for every living
 * nation by `researchBudget`, in the economic AI's system: RESEARCH_SHARE of its income, never
 * more than `researchCap`, nothing while it could not carry its army). It works on up to MAX_LINES techs at once (`world.research`: nation, tech, gold
 * paid). Each day, line by line in the order they were opened:
 *
 *   pay = min(the tech's gold ÷ its days, what is left to pay, what is left of the day's budget)
 *
 * taken from the treasury; a line whose tech is paid for is closed and the nation knows the tech
 * (`TechResearched`). So a tech takes its days at least, and a poor nation longer. A second line is
 * opened only with budget left over from the first. Nothing is paid by a bankrupt nation, or out
 * of a treasury that does not hold the day's payment: research never puts a nation in debt.
 *
 * What is researched next (`nextTech`): of the techs the nation does not know and is not working
 * on, whose prerequisites it knows and whose year has come, the earliest (the first in the
 * scenario's order on ties). The year is a floor: nobody is ahead of the calendar. The nuclear
 * techs are left out: whether to go for the bomb is a decision of Phase 6, not a place in a queue.
 *
 * A dead nation's lines are dropped (`eliminateNation`); what it knew it knows when it returns.
 */
import { civilFromDays, isDayStart } from '../../shared/calendar';
import { EventKind } from '../../shared/events';
import { grantTechs, knowsTechs, techMask } from '../tech';
import type { ScenarioRules, World } from '../world';

/** Share of a nation's monthly income its research budget is. */
export const RESEARCH_SHARE = 0.05;
/** Techs a nation works on at once. */
export const MAX_LINES = 3;
/** The economic AI's month, in days, when it turns gold per month into gold per day. */
export const DAYS_PER_MONTH = 365 / 12;
/** Categories no nation researches by itself (module comment). */
export const HELD_CATEGORIES: readonly string[] = ['nuclear'];
/** Below this a tech is paid for (the payments are fractions that add up to its gold). */
const PAID = 1e-9;

/** The most a nation can spend on research in a day: MAX_LINES lines of the dearest tech by the day. */
export function researchCap(rules: ScenarioRules): number {
  return MAX_LINES * rules.techs.reduce((m, t) => Math.max(m, t.gold / t.days), 0);
}

/**
 * The research budget of a nation, gold per day, for the month to come (PLAN 3.4Rg, ADR-144: a
 * rule of the economy, for every living nation, with AI or without): RESEARCH_SHARE of `income`,
 * at most `researchCap`; nothing in debt, and nothing while it is short of money (`balance`
 * below `need`, see `budgetOf` of the economic AI) with a treasury below `runway` months of what
 * is short.
 */
export function researchBudget(rules: ScenarioRules, gold: number, income: number, balance: number, need: number, runway: number): number {
  const carried = balance >= need || gold >= runway * (need - balance);
  return gold > 0 && carried ? Math.min((RESEARCH_SHARE * income) / DAYS_PER_MONTH, researchCap(rules)) : 0;
}

/** The tech `nation` takes up next in `year`, not one of `busy` (indices); -1 when there is none. */
export function nextTech(world: World, nation: number, year: number, busy: readonly number[]): number {
  const techs = world.rules?.techs ?? [];
  let best = -1;
  for (let i = 0; i < techs.length; i++) {
    const t = techs[i]!;
    if (t.year > year || HELD_CATEGORIES.includes(t.category) || busy.includes(i)) continue;
    if (best >= 0 && t.year >= techs[best]!.year) continue;
    if (knowsTechs(world, nation, techMask([i])) || !knowsTechs(world, nation, techMask(t.prereqs))) continue;
    best = i;
  }
  return best;
}

export function researchSystem(world: World): void {
  const rules = world.rules;
  if (!rules || !isDayStart(world.tick)) return;
  const nc = world.nations.cols;
  const r = world.research;
  const year = civilFromDays(world.startDay + world.tick / 24).year;
  /** A nation's lines, in the order they were opened. */
  const lines = new Map<number, number[]>();
  for (const id of r.ids()) {
    const n = r.cols.nation[id]!;
    const l = lines.get(n);
    if (l) l.push(id);
    else lines.set(n, [id]);
  }
  world.nations.forEach((n) => {
    if (nc.living[n] !== 1 || nc.bankrupt[n] === 1) return;
    let left = nc.research[n]!;
    const own = lines.get(n) ?? [];
    const busy = own.map((id) => r.cols.tech[id]!);
    for (let i = 0; i < MAX_LINES && left > 0; i++) {
      let id = own[i];
      if (id === undefined) {
        const t = nextTech(world, n, year, busy);
        if (t < 0) return;
        id = r.create();
        r.cols.nation[id] = n;
        r.cols.tech[id] = t;
        busy.push(t);
      }
      const t = r.cols.tech[id]!;
      const rule = rules.techs[t]!;
      const pay = Math.min(rule.gold / rule.days, rule.gold - r.cols.paid[id]!, left);
      if (nc.gold[n]! < pay) return;
      nc.gold[n] = nc.gold[n]! - pay;
      r.cols.paid[id] = r.cols.paid[id]! + pay;
      left -= pay;
      if (rule.gold - r.cols.paid[id]! > PAID) continue;
      r.remove(id);
      grantTechs(world, n, techMask([t]));
      world.out.emit(world.tick, EventKind.TechResearched, n, t, NaN, NaN);
    }
  });
}
