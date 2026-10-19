import { EventKind } from '../shared/events';
import { convoyTake, HISTORY_ROLES, kindName, nukeStrike, nukeToll, seaSide, type HistoryRow, type NukeToll } from '../shared/history';
import { displayName, t, type MessageKey } from './i18n';
import en from './i18n/en.json';

/** The alliances that many have a copy of: such a one is told from the others by its founder. */
const COMMON_ALLIANCES: ReadonlySet<string> = new Set(['alliance.defensive', 'alliance.coalition']);

/**
 * An alliance's title: one that many have a copy of is told from the others by its founder ("the
 * Defensive Pact of Sweden" in the history, "Defensive Pact of Sweden" in the nation panel: PLAN
 * 7.4f4, the critic's N10); one of its own by its name. Without the founder's name, the name.
 */
export function allianceTitle(nameKey: string, founder: string | null): string {
  return COMMON_ALLIANCES.has(nameKey) && founder ? t('history.allianceOf', { name: displayName(nameKey), founder: displayName(founder) }) : displayName(nameKey);
}

/** A decision's utility under this was a near thing, */
export const NUKE_WEIGHED_LONG = 0.1;
/** and from this a plain one. */
export const NUKE_WEIGHED_NONE = 0.5;

/** How readily a nation decided on a strike of utility `u` (PLAN 7.25c): the history tells it in words. */
export function nukeWeighed(u: number): MessageKey {
  return u < NUKE_WEIGHED_LONG ? 'history.nukeWeighed.long' : u < NUKE_WEIGHED_NONE ? 'history.nukeWeighed.some' : 'history.nukeWeighed.none';
}

/** A count as the history writes it: "10,855". */
const count = (v: number): string => v.toLocaleString('en-US');
/** Gold as the history writes it: "1,204", "38", "4.5" (tenths under 10). */
const gold = (v: number): string => (v < 10 ? v.toLocaleString('en-US', { maximumFractionDigits: 1 }) : count(Math.round(v)));

/**
 * A nuclear strike's toll in words (PLAN 7.32b, the critic's R9-B2: "24 dead" did not say who):
 * the civilians killed, then the men, guns and tanks of the forces there lost, those of none left
 * out, or that no troops were in the blast. A row of a game saved before has no `toll`: its dead.
 */
export function strikeToll(r: HistoryRow): string {
  const dead = nukeStrike(r.b).dead;
  if (!r.toll) return t('history.nukeDead', { n: count(dead) });
  const people = count(Math.max(0, dead - r.toll.men));
  const forces = forcesLost(r.toll);
  return forces ? t('history.nukeToll', { people, forces }) : t('history.nukeToll.noForces', { people });
}

/** A toll's forces lost, or that the blast found none. */
function lostOrNone(toll: NukeToll): string {
  const forces = forcesLost(toll);
  return forces ? t('history.nukeForces', { forces }) : t('history.nukeForces.none');
}

/** "10,855 men, 40 guns and 12 tanks", those of none left out; '' when the burst found no forces (PLAN 7.32b). */
function forcesLost({ men, guns, tanks }: NukeToll): string {
  const part = (n: number, key: 'history.nukeMen' | 'history.nukeGuns' | 'history.nukeTanks'): string[] => (n > 0 ? [t(n === 1 ? `${key}.one` : key, { n: count(n) })] : []);
  const parts = [...part(men, 'history.nukeMen'), ...part(guns, 'history.nukeGuns'), ...part(tanks, 'history.nukeTanks')];
  if (parts.length <= 1) return parts[0] ?? '';
  return t('history.listAnd', { rest: parts.slice(0, -1).join(', '), last: parts.at(-1)! });
}

/**
 * The rendered sentence of a row (i18n `history.<Kind>` with {a} and {b}). No part is an id
 * (PLAN 3.12a): an alliance is "the Defensive Pact of Sweden" or "the Comintern", a Major
 * Battle "the major battle near Lyon". A row with nobody as its b has the sentence
 * `history.<Kind>.none` where the kind has one, and a row that is `as` something
 * `history.<Kind>.<as>` (PLAN 3.12b). A founding names its alliance without the founder, who is
 * the row's a: "Sweden founded a Defensive Pact" (PLAN 3.12Rg1). A row with a third nation
 * (`cn`) has it as {c} (PLAN 3.12Rn).
 */
export function historyText(r: HistoryRow): string {
  const [ra, rb] = HISTORY_ROLES[r.kind] ?? ['number', 'number'];
  const part = (role: string, v: number, name: string): string => {
    if (role === 'number') return String(v);
    if (role === 'battle') return name ? t('history.battleNear', { city: displayName(name) }) : t('history.aBattle');
    if (role === 'alliance') {
      if (!name) return t('history.anAlliance');
      if (r.as === 'founded' && COMMON_ALLIANCES.has(name)) return t('history.oneAlliance', { name: displayName(name) });
      return t('history.theAlliance', { name: allianceTitle(name, r.of || null) });
    }
    // A town of a row of a game saved before it was named (PLAN 7.33b).
    if (role === 'town' && !name) return t('history.aTown');
    return name ? displayName(name) : t('history.nobody');
  };
  const kind = `history.${kindName(r.kind)}`;
  // A strike of God Mode's (PLAN 6.6a): no nation struck.
  // A month's raids on convoys (PLAN 7.33a): the gold taken, {gold}; a row of a game saved before has none.
  const took = r.kind === EventKind.ConvoyRaided ? convoyTake(r.b).gold : 0;
  const key = r.as && `${kind}.${r.as}` in en ? `${kind}.${r.as}` : rb === 'strike' && r.a === 0 ? `${kind}.god` : took > 0 ? `${kind}.took` : kind;
  const none = `${key}.none`;
  // A sea battle's sides carry the ships each lost (PLAN 4.3c), the air's rows their aircraft or
  // what their bombs took (PLAN 5.11a): {na} and {nb}.
  const ships = ra === 'side' || rb === 'side' ? { na: count(ra === 'side' ? seaSide(r.a).ships : 0), nb: count(rb === 'side' ? seaSide(r.b).ships : 0) } : {};
  // A nuclear strike's bomb and its dead (PLAN 6.5a): {bomb} and {nb}; the city nearest it, {near} (PLAN 6.11c).
  const strike = rb === 'strike' ? { bomb: t(nukeStrike(r.b).yieldN >= 2 ? 'history.hBomb' : 'history.aBomb'), toll: strikeToll(r), near: r.near ? t('history.strikeNear', { city: displayName(r.near) }) : '' } : {};
  // A decision to strike (PLAN 7.25c): its place, and its utility told in words, not as a number.
  // A burst's toll found without its strike's row (PLAN 7.32b; the log has it right after the strike).
  const lost = r.kind === EventKind.NukeToll ? { near: r.near ? t('history.strikeNear', { city: displayName(r.near) }) : '', forces: lostOrNone(nukeToll(r.b)) } : {};
  const decided = r.kind === EventKind.NukeDecided ?{ near: r.near ? t('history.strikeNear', { city: displayName(r.near) }) : '', weighed: t(nukeWeighed(r.b / 1000)) } : {};
  const s = t((!r.bn && rb !== 'number' && rb !== 'side' && none in en ? none : key) as MessageKey, { a: part(ra, r.a, r.an), b: part(rb, r.b, r.bn), c: r.cn ? displayName(r.cn) : '', ...ships, ...strike, ...lost, ...decided, gold: gold(took) });
  return s.charAt(0).toLocaleUpperCase() + s.slice(1);
}
