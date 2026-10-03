import { useState } from 'preact/hooks';
import type { NationStat } from '../shared/protocol';
import { GodTab, type GodTabProps } from './GodTab';
import { t, type MessageKey } from './i18n';

/** Display name of an i18n key, or of a '=' + literal name (spawned nations). */
export function displayName(key: string): string {
  return key.startsWith('=') ? key.slice(1) : t(key as MessageKey);
}

const hex = (c: number): string => `#${c.toString(16).padStart(6, '0')}`;
const num = (v: number): string => Math.round(v).toLocaleString('en-US');
const signed = (v: number): string => (v >= 0 ? '+' : '−') + num(Math.abs(v));

type Tab = 'overview' | 'economy' | 'god';

/**
 * Left nation panel (PLAN 1.31a): the selected nation's name and colour, then an Overview tab
 * (land, army, alliance, overlord or puppets, enemies) and an Economy tab (income, expenses,
 * balance, treasury, bonus, manpower). Nation chips select that nation. Actions (bonus −/+,
 * war, peace…) arrive with God Mode and player control (PLAN 1.32/1.33).
 */
export function NationPanel({ nation, byId, onSelect, god }: { nation: NationStat; byId: Map<number, NationStat>; onSelect: (id: number) => void; god?: Omit<GodTabProps, 'nation'> | null }) {
  const [chosen, setTab] = useState<Tab>('overview');
  // The God tab exists only in God Mode (PLAN 1.32b).
  const tab: Tab = !god && chosen === 'god' ? 'overview' : chosen;
  const chip = (id: number) => {
    const n = byId.get(id);
    return (
      <button key={id} class="nation-chip" data-testid="nation-chip" onClick={() => onSelect(id)}>
        <span class="chip-swatch" style={{ background: hex(n?.color ?? 0x777777) }} />
        {n ? displayName(n.name) : `#${id}`}
      </button>
    );
  };
  const row = (label: MessageKey, value: string, testid?: string) => (
    <div class="panel-row">
      <span>{t(label)}</span>
      <span data-testid={testid}>{value}</span>
    </div>
  );
  return (
    <aside class="nation-panel" data-testid="nation-panel" data-nation={nation.id}>
      <header class="panel-head">
        <span class="panel-swatch" style={{ background: hex(nation.color) }} />
        <span class="panel-name" data-testid="nation-name">
          {displayName(nation.name)}
        </span>
        <button class="panel-close" data-testid="nation-close" aria-label={t('panel.close')} onClick={() => onSelect(0)}>
          ×
        </button>
      </header>
      <nav class="panel-tabs">
        {(god ? (['overview', 'economy', 'god'] as const) : (['overview', 'economy'] as const)).map((k) => (
          <button key={k} class={tab === k ? 'tab active' : 'tab'} data-testid={`tab-${k}`} onClick={() => setTab(k)}>
            {t(`panel.${k}` as MessageKey)}
          </button>
        ))}
      </nav>
      {tab === 'god' && god ? (
        <GodTab nation={nation} {...god} />
      ) : tab === 'overview' ? (
        <section data-testid="panel-overview">
          {row('panel.land', num(nation.cells), 'stat-land')}
          {row('panel.army', `${num(nation.men)} (${nation.formations})`, 'stat-army')}
          {row('panel.efficiency', `${Math.round(nation.efficiency * 100)}%`)}
          {nation.alliance ? (
            <div class="panel-block" data-testid="panel-alliance">
              <div class="panel-sub">{displayName(nation.alliance.name)}</div>
              {row('panel.unity', num(nation.alliance.unity))}
              {nation.alliance.leader !== nation.id ? row('panel.allianceLoyalty', num(nation.alliance.loyalty)) : null}
            </div>
          ) : null}
          {nation.overlord !== 0 ? (
            <div class="panel-block" data-testid="panel-overlord">
              <div class="panel-sub">{t('panel.overlord')}</div>
              <div class="chips">{chip(nation.overlord)}</div>
              {row('panel.autonomy', num(nation.autonomy))}
              {row('panel.loyalty', num(nation.loyalty))}
              {row('panel.integration', `${num(nation.integration)}%`)}
            </div>
          ) : null}
          {nation.puppets.length > 0 ? (
            <div class="panel-block" data-testid="panel-puppets">
              <div class="panel-sub">{t('panel.puppets')}</div>
              <div class="chips">{nation.puppets.map(chip)}</div>
            </div>
          ) : null}
          <div class="panel-block" data-testid="panel-wars">
            <div class="panel-sub">{t('panel.atWarWith')}</div>
            {nation.enemies.length > 0 ? <div class="chips">{nation.enemies.map(chip)}</div> : <div class="panel-note">{t('panel.atPeace')}</div>}
          </div>
        </section>
      ) : (
        <section data-testid="panel-economy">
          {row('panel.income', num(nation.income), 'stat-income')}
          {row('panel.expenses', num(nation.expenses), 'stat-expenses')}
          {row('panel.balance', signed(nation.income - nation.expenses), 'stat-balance')}
          {row('panel.gold', num(nation.gold), 'stat-gold')}
          {row('panel.incomeBonus', `${nation.incomeBonus >= 0 ? '+' : ''}${nation.incomeBonus}%`)}
          {row('panel.manpower', num(nation.manpower), 'stat-manpower')}
          {nation.bankrupt ? <div class="panel-warn">{t('panel.bankrupt')}</div> : null}
        </section>
      )}
    </aside>
  );
}
