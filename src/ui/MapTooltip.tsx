import type { ReadonlySignal } from '@preact/signals';
import { displayName } from './NationPanel';
import { t } from './i18n';

/**
 * The nation under the mouse (PLAN 7.4f7, the critic's "no tooltip on hover"): its name by the
 * cursor, and who holds the land when another does. No pointer events: it never takes a click.
 * Given the signal, not its value: a mouse move re-renders this, not the whole HUD.
 */
export function MapTooltip({ hover: signal, nameOf }: { hover: ReadonlySignal<{ owner: number; holder: number; x: number; y: number } | null>; nameOf: (id: number) => string | null }) {
  const hover = signal.value;
  if (!hover) return null;
  const owner = hover.owner !== 0 ? nameOf(hover.owner) : null;
  const holder = hover.holder !== 0 ? nameOf(hover.holder) : null;
  const name = owner ?? holder;
  if (!name) return null;
  return (
    <div class="map-tooltip" data-testid="map-tooltip" style={{ left: `${hover.x + 14}px`, top: `${hover.y + 16}px` }}>
      <div class="map-tooltip-name">{displayName(name)}</div>
      {owner && holder && hover.holder !== hover.owner ? <div class="map-tooltip-note">{t('tooltip.occupiedBy', { name: displayName(holder) })}</div> : null}
    </div>
  );
}
