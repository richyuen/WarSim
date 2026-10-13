import type { OrderNews } from '../shared/protocol';
import { t, type MessageKey } from './i18n';

/** The words of what became of a player's order (PLAN 4.9c): `name` is the formation's. */
export function orderNewsText(n: OrderNews, name: string): string {
  if (n.kind === 'repulsed') return t('order.repulsed', { name });
  if (n.kind === 'landedAway') return t('order.landedAway', { name });
  return t('order.refused', { name, why: t(`order.why.${n.reason}` as MessageKey) });
}
