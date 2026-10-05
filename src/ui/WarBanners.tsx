import type { NationStat, WarStat } from '../shared/protocol';
import { t } from './i18n';
import { displayName } from './NationPanel';

const MAX_BANNERS = 8;
const hex = (c: number): string => `#${c.toString(16).padStart(6, '0')}`;

/**
 * War banners (PLAN 1.31b): one per active war above the bottom bar, side leaders with their
 * colours, ally counts and a score bar (attackers' share). Clicking selects the attacker leader
 * and brings the war's largest battle into view (`onBattle`, PLAN 2.14e).
 */
export function WarBanners({ wars, byId, onSelect, onBattle }: { wars: WarStat[]; byId: Map<number, NationStat>; onSelect: (id: number) => void; onBattle: (war: number) => void }) {
  if (wars.length === 0) return null;
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
    <div class="war-banners" data-testid="war-banners">
      {wars.slice(0, MAX_BANNERS).map((w) => (
        <button key={w.id} class="war-banner" data-testid="war-banner" data-war={w.id} title={`${t('wars.score', { n: Math.round(w.score) })}
${t('wars.toBattle')}`}
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
      {wars.length > MAX_BANNERS ? (
        <span class="war-more" data-testid="war-more">
          +{wars.length - MAX_BANNERS}
        </span>
      ) : null}
    </div>
  );
}
