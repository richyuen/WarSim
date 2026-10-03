import { legendFor, type MapMode } from '../shared/mapModes';
import { t, type MessageKey } from './i18n';

/** Legend for the current map mode (PLAN 1.30): swatches and notes, bottom right. */
export function MapLegend({ mode, selected }: { mode: MapMode; selected: string | null }) {
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
    </aside>
  );
}
