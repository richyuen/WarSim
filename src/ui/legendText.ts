import { t } from './i18n';

/** A holder's row in the sea and air legends: its name (null: contested) and its zones, "1 zone" for one (PLAN 7.8: "Germany: 1 zones"). */
export function zonesOf(name: string | null, n: number): string {
  if (name === null) return n === 1 ? t('legend.airContestedZonesOne') : t('legend.airContestedZones', { n });
  return n === 1 ? t('legend.seaHolderOne', { name }) : t('legend.seaHolder', { name, n });
}
