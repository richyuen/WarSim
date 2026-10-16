import { legendFor, type MapMode } from '../shared/mapModes';
import { t, type MessageKey } from './i18n';

/** The holders the sea-control legend lists at most (PLAN 4.10c), and the air superiority's (PLAN 5.10). */
const SEA_HOLDERS_SHOWN = 8;

/**
 * Legend for the current map mode (PLAN 1.30): swatches and notes, bottom right. In the
 * sea-control mode (PLAN 4.10c) also who holds the seas, in their colours, with their zones, and
 * the zone under the cursor named with its holder. In the air-superiority mode (PLAN 5.10) the
 * same of the air: who holds how many zones (the contested as one row), and the zone under the
 * cursor.
 */
export function MapLegend({
  mode,
  groundShown = false,
  selected,
  seaHolders = [],
  seaHover = null,
  airHolders = [],
  airHover = null,
}: {
  mode: MapMode;
  /** The ground of T2 and T3 shown (PLAN 7.4f3): occupied land is a tint in the occupier's colour, not hatched. */
  groundShown?: boolean;
  selected: string | null;
  seaHolders?: { name: string; color: number; zones: number }[];
  seaHover?: { name: string; holder: string | null } | null;
  /** A null name: the contested zones. */
  airHolders?: { name: string | null; color: number; zones: number }[];
  /** 'contested', a nation's name, or null for no one. */
  airHover?: { holder: string | null } | null;
}) {
  const hex = (c: number): string => `#${c.toString(16).padStart(6, '0')}`;
  return (
    <aside class="map-legend" data-testid="map-legend" data-mode={mode}>
      <div class="legend-title">{t(`mapMode.${mode}` as MessageKey)}</div>
      {mode === 'diplomacy' && selected ? <div class="legend-selected">{selected}</div> : null}
      {legendFor(mode).map(([color, key]) => (
        <div class="legend-row" key={key}>
          {color !== null ? <span class="legend-swatch" style={{ background: hex(color) }} /> : null}
          <span>{t((key === 'legend.occupied' && groundShown ? 'legend.occupiedTint' : key) as MessageKey)}</span>
        </div>
      ))}
      {mode === 'seaControl' ? (
        <>
          {seaHolders.slice(0, SEA_HOLDERS_SHOWN).map((h) => (
            <div class="legend-row" key={`sea-${h.name}`} data-testid="sea-holder">
              <span class="legend-swatch" style={{ background: hex(h.color) }} />
              <span>{t('legend.seaHolder', { name: h.name, n: h.zones })}</span>
            </div>
          ))}
          {seaHolders.length > SEA_HOLDERS_SHOWN ? <div class="legend-row">{t('legend.seaMore', { n: seaHolders.length - SEA_HOLDERS_SHOWN })}</div> : null}
          {seaHover ? (
            <div class="legend-selected" data-testid="sea-hover">
              {seaHover.holder ? t('legend.seaHoverHeld', { sea: seaHover.name || t('legend.seaUnnamed'), name: seaHover.holder }) : t('legend.seaHoverOpen', { sea: seaHover.name || t('legend.seaUnnamed') })}
            </div>
          ) : null}
        </>
      ) : null}
      {mode === 'airControl' ? (
        <>
          {airHolders.slice(0, SEA_HOLDERS_SHOWN).map((h) => (
            <div class="legend-row" key={`air-${h.name ?? 'contested'}`} data-testid="air-holder">
              <span class="legend-swatch" style={{ background: hex(h.color) }} />
              <span>{h.name === null ? t('legend.airContestedZones', { n: h.zones }) : t('legend.seaHolder', { name: h.name, n: h.zones })}</span>
            </div>
          ))}
          {airHolders.length > SEA_HOLDERS_SHOWN ? <div class="legend-row">{t('legend.seaMore', { n: airHolders.length - SEA_HOLDERS_SHOWN })}</div> : null}
          {airHolders.length === 0 ? <div class="legend-row" data-testid="air-holder-none">{t('legend.airNone')}</div> : null}
          {airHover ? (
            <div class="legend-selected" data-testid="air-hover">
              {airHover.holder === 'contested' ? t('legend.airHoverContested') : airHover.holder ? t('legend.airHoverHeld', { name: airHover.holder }) : t('legend.airHoverOpen')}
            </div>
          ) : null}
        </>
      ) : null}
    </aside>
  );
}
