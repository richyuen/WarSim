import { HISTORY_ROLES, kindName, type HistoryRow } from '../shared/history';
import { displayName, t, type MessageKey } from './i18n';
import en from './i18n/en.json';

/** The alliances that many have a copy of: such a one is told from the others by its founder. */
const COMMON_ALLIANCES: ReadonlySet<string> = new Set(['alliance.defensive', 'alliance.coalition']);

/**
 * The rendered sentence of a row (i18n `history.<Kind>` with {a} and {b}). No part is an id
 * (PLAN 3.12a): an alliance is "the Defensive Pact of Sweden" or "the Comintern", a Major
 * Battle "the major battle near Lyon". A row with nobody as its b has the sentence
 * `history.<Kind>.none` where the kind has one.
 */
export function historyText(r: HistoryRow): string {
  const [ra, rb] = HISTORY_ROLES[r.kind] ?? ['number', 'number'];
  const part = (role: string, v: number, name: string): string => {
    if (role === 'number') return String(v);
    if (role === 'battle') return name ? t('history.battleNear', { city: displayName(name) }) : t('history.aBattle');
    if (role === 'alliance') {
      if (!name) return t('history.anAlliance');
      return t('history.theAlliance', { name: COMMON_ALLIANCES.has(name) && r.of ? t('history.allianceOf', { name: displayName(name), founder: displayName(r.of) }) : displayName(name) });
    }
    return name ? displayName(name) : t('history.nobody');
  };
  const key = `history.${kindName(r.kind)}`;
  const none = `${key}.none`;
  const s = t((!r.bn && rb !== 'number' && none in en ? none : key) as MessageKey, { a: part(ra, r.a, r.an), b: part(rb, r.b, r.bn) });
  return s.charAt(0).toLocaleUpperCase() + s.slice(1);
}
