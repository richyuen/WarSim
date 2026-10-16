import type { ReadonlySignal } from '@preact/signals';
import type { MapHover } from './mapHover';
import { displayName } from './NationPanel';
import { t } from './i18n';

/**
 * What is under the mouse (PLAN 7.4f7, the critic's "no tooltip on hover"): the nation's name by
 * the cursor, and who holds the land when another does; over a city's dot (PLAN 7.4f13, the
 * critic's N6, "no city panel") the city first, "capital" when it is one, and its province's
 * unrest. No pointer events: it never takes a click. Given the signal, not its value: a mouse
 * move re-renders this, not the whole HUD.
 */
export function MapTooltip({ hover: signal, nameOf, unrestOf }: { hover: ReadonlySignal<MapHover | null>; nameOf: (id: number) => string | null; unrestOf: (province: number) => number | null }) {
  const hover = signal.value;
  if (!hover) return null;
  const owner = hover.owner !== 0 ? nameOf(hover.owner) : null;
  const holder = hover.holder !== 0 ? nameOf(hover.holder) : null;
  const name = owner ?? holder;
  if (!name && !hover.city) return null;
  const unrest = hover.city && hover.province !== 0 ? unrestOf(hover.province) : null;
  return (
    <div class="map-tooltip" data-testid="map-tooltip" style={{ left: `${hover.x + 14}px`, top: `${hover.y + 16}px` }}>
      {hover.city ? (
        <div class="map-tooltip-name" data-testid="tooltip-city">
          {hover.city.name}
          {hover.city.capital ? <span class="map-tooltip-note"> · {t('tooltip.capital')}</span> : null}
        </div>
      ) : null}
      {name ? <div class={hover.city ? 'map-tooltip-nation' : 'map-tooltip-name'}>{displayName(name)}</div> : null}
      {owner && holder && hover.holder !== hover.owner ? <div class="map-tooltip-note">{t('tooltip.occupiedBy', { name: displayName(holder) })}</div> : null}
      {unrest !== null ? <div class="map-tooltip-nation" data-testid="tooltip-unrest">{t('tooltip.unrest', { n: Math.round(unrest) })}</div> : null}
    </div>
  );
}
