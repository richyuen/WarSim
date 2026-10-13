import { legendFor, type MapMode } from '../shared/mapModes';
import { t, type MessageKey } from './i18n';

/** The holders the sea-control legend lists at most (PLAN 4.10c). */
const SEA_HOLDERS_SHOWN = 8;

/**
 * Legend for the current map mode (PLAN 1.30): swatches and notes, bottom right. In the
 * sea-control mode (PLAN 4.10c) also who holds the seas, in their colours, with their zones, and
 * the zone under the cursor named with its holder.
 */
export function MapLegend({
  mode,
  selected,
  seaHolders = [],
  seaHover = null,
}: {
  mode: MapMode;
  selected: string | null;
  seaHolders?: { name: string; color: number; zones: number }[];
  seaHover?: { name: string; holder: string | null } | null;
}) {
  const hex = (c: number): string => `#${c.toString(16).padStart(6, '0')}`;
  return (
    <aside class="map-legend" data-testid="map-legend" data-mode={mode}>
      <div class="legend-title">{t(`mapMode.${mode}` as MessageKey)}</div>
      {mode === 'diplomacy' && selected ? <div class="legend-selected">{selected}</div> : null}
      {legendFor(mode).map(([color, key]) => (
        <div class="legend-row" key={key}>
          {color !== null ? <span class="legend-swatch" style={{ background: hex(color) }} /> : null}
          <span>{t(key as MessageKey)}</span>
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
    </aside>
  );
}
