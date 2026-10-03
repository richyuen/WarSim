import { isoDate } from '../shared/history';
import type { Hud } from './hud';

/** Screenshot file label: the in-game date (ISO), e.g. warsim-1938-03-01.png. */
export function screenshotLabel(hud: Hud): string {
  return isoDate(hud.startDay, hud.tick.value);
}
