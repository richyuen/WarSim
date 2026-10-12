import { HISTORY_ROLES, kindName, seaSide, type HistoryRow } from '../shared/history';
import { displayName, t, type MessageKey } from './i18n';
import en from './i18n/en.json';

/** The alliances that many have a copy of: such a one is told from the others by its founder. */
const COMMON_ALLIANCES: ReadonlySet<string> = new Set(['alliance.defensive', 'alliance.coalition']);

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
      return t('history.theAlliance', { name: COMMON_ALLIANCES.has(name) && r.of ? t('history.allianceOf', { name: displayName(name), founder: displayName(r.of) }) : displayName(name) });
    }
    return name ? displayName(name) : t('history.nobody');
  };
  const kind = `history.${kindName(r.kind)}`;
  const key = r.as && `${kind}.${r.as}` in en ? `${kind}.${r.as}` : kind;
  const none = `${key}.none`;
  // A sea battle's sides carry the ships each lost (PLAN 4.3c): {na} and {nb}.
  const ships = ra === 'side' ? { na: seaSide(r.a).ships, nb: seaSide(r.b).ships } : {};
  const s = t((!r.bn && rb !== 'number' && rb !== 'side' && none in en ? none : key) as MessageKey, { a: part(ra, r.a, r.an), b: part(rb, r.b, r.bn), c: r.cn ? displayName(r.cn) : '', ...ships });
  return s.charAt(0).toLocaleUpperCase() + s.slice(1);
}
