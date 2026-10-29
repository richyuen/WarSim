import { useState } from 'preact/hooks';
import type { NationStat, WarStat } from '../shared/protocol';
import { t } from './i18n';
import { displayName } from './NationPanel';

/**
 * Banners shown, the rest a "+N" (PLAN 7.4f6, the critic's N16): at 8 they stood three rows deep
 * over the map at 1400 px; 6 are two rows there and one or two wider.
 */
export const MAX_BANNERS = 6;
/** Banners on a phone's width (the user's choice of 2026-10-29, ADR-760): one row; "+N" opens the rest, up to MAX_BANNERS. */
export const PHONE_BANNERS = 2;
const hex = (c: number): string => `#${c.toString(16).padStart(6, '0')}`;

/**
 * War banners (PLAN 1.31b): one per active war above the bottom bar, side leaders with their
 * colours, ally counts and a score bar (attackers' share). Clicking selects the attacker leader
 * and brings the war's largest battle into view (`onBattle`, PLAN 2.14e). The swords are lit
 * while the war has a battle to go to and dim while it has none (PLAN 2.14f5b3, ADR-96).
 */
export function WarBanners({ wars, byId, onSelect, onBattle, phone = false }: { wars: WarStat[]; byId: Map<number, NationStat>; onSelect: (id: number) => void; onBattle: (war: number) => void; phone?: boolean }) {
  const [opened, setOpened] = useState(false);
  if (wars.length === 0) return null;
  const shown = phone && !opened ? PHONE_BANNERS : MAX_BANNERS;
  const side = (ids: number[]) => {
    const lead = byId.get(ids[0] ?? 0);
    return (
      <span class="war-side">
        <span class="chip-swatch" style={{ background: hex(lead?.color ?? 0x777777) }} />
        {lead ? displayName(lead.name) : '?'}
        {ids.length > 1 ? <span class="war-allies">+{ids.length - 1}</span> : null}
      </span>
    );
  };
  return (
    <div class={phone && opened ? 'war-banners opened' : 'war-banners'} data-testid="war-banners">
      {wars.slice(0, shown).map((w) => (
        <button key={w.id} class={w.battle ? 'war-banner' : 'war-banner war-quiet'} data-testid="war-banner" data-war={w.id} data-battle={w.battle ? '1' : '0'} title={`${t('wars.score', { n: Math.round(w.score) })}
${t(w.battle ? 'wars.toBattle' : 'wars.noBattle')}`}
          onClick={() => {
            onSelect(w.attackers[0] ?? 0);
            onBattle(w.id);
          }}
        >
          <span class="war-title">
            {side(w.attackers)}
            <span class="war-swords">{'⚔'}</span>
            {side(w.defenders)}
          </span>
          <span class="war-score">
            <span class="war-score-fill" style={{ width: `${Math.max(0, Math.min(100, 50 + w.score / 2))}%` }} />
          </span>
        </button>
      ))}
      {phone && (opened || wars.length > shown) ? (
        <button type="button" class="war-more war-more-btn" data-testid="war-more" aria-expanded={opened} title={t(opened ? 'wars.fewer' : 'wars.more')} onClick={() => setOpened(!opened)}>
          {opened ? '−' : `+${wars.length - shown}`}
        </button>
      ) : wars.length > shown ? (
        <span class="war-more" data-testid="war-more">
          +{wars.length - shown}
        </span>
      ) : null}
    </div>
  );
}
