/**
 * The nuclear alert (PLAN 6.6a, SPEC §6.4 "an alert banner, an auto-pause option, a camera 'go to'
 * button"): which strikes a statistics message brings that were not seen, by the rule the sound's
 * cue has (`cueOfTicker`): the first message of a world is its past. `rows` are the message's
 * `strikes`, every strike since the message before (PLAN 7.109a: the ticker's last five rows at
 * Max had lost the first of two strikes a day apart); its `news` has the kinds of every major
 * event since then.
 */
import { EventKind } from './events';
import type { TickerRow } from './history';
import type { Heard } from './sound';

export function newStrikes(rows: readonly TickerRow[], world: number, seen: Heard | null, news: readonly number[] = []): { rows: TickerRow[]; struck: boolean; seen: Heard } {
  const last = rows.reduce((m, r) => Math.max(m, r.i), -1);
  if (!seen || seen.world !== world) return { rows: [], struck: false, seen: { world, i: last } };
  const fresh = rows.filter((r) => r.i > seen.i && r.kind === EventKind.NukeCasualties);
  return { rows: fresh, struck: fresh.length > 0 || news.includes(EventKind.NukeCasualties), seen: { world, i: Math.max(seen.i, last) } };
}

/** The alert goes once its strike is this many hours of the game old (PLAN 7.25d: it stayed 10 days, the critic's run 8), */
export const NUKE_ALERT_HOURS = 72;
/** and it has been shown this many milliseconds, so that it can be read at Max speed. */
export const NUKE_ALERT_MIN_MS = 8000;

/** Whether the alert of a strike at `strikeTick`, shown `shownMs` ago, has had its time at `tick` (PLAN 7.25d). A paused game's stands. */
export function alertExpired(strikeTick: number, tick: number, shownMs: number): boolean {
  return tick - strikeTick >= NUKE_ALERT_HOURS && shownMs >= NUKE_ALERT_MIN_MS;
}

/** At most this many alerts stand at once, the newest (PLAN 7.109a: each strike has its own). */
export const NUKE_ALERTS_MAX = 3;

/** An alert on the screen: its strike, and when it was first shown (`performance.now()`). */
export interface ShownAlert {
  row: TickerRow;
  at: number;
}

/**
 * The alerts after a statistics message at `tick`, `nowMs` (PLAN 7.109a): each new strike its own,
 * oldest first, the expired gone (`alertExpired`), the newest NUKE_ALERTS_MAX kept. The same array
 * when nothing changed.
 */
export function nextAlerts(shown: readonly ShownAlert[], fresh: readonly TickerRow[], tick: number, nowMs: number): readonly ShownAlert[] {
  const kept = shown.filter((a) => !alertExpired(a.row.tick, tick, nowMs - a.at));
  if (fresh.length === 0 && kept.length === shown.length) return shown;
  return [...kept, ...fresh.map((row) => ({ row, at: nowMs }))].slice(-NUKE_ALERTS_MAX);
}
