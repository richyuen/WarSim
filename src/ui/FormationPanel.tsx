import type { FormationDetail } from '../shared/protocol';
import { t, type MessageKey } from './i18n';
import { displayName } from './NationPanel';

const num = (v: number): string => Math.round(v).toLocaleString('en-US');
const hex = (c: number): string => `#${c.toString(16).padStart(6, '0')}`;

/**
 * The formation panel (PLAN 2.14b): what a click on a formation opens, at any zoom that shows
 * formations. Its name and kind, whose it is, its men against a whole one's, its supply, whether
 * it is in contact or on the march, and its elements by unit type. The numbers are the sim's
 * (`FormationDetail`), asked for again as the game goes on. It stands where the nation panel
 * stands; the nation's chip leads back to that one.
 */
export function FormationPanel({
  info,
  name,
  kind,
  nation,
  flagUrl,
  onNation,
  onClose,
}: {
  /** Null while the first answer is on its way. */
  info: FormationDetail | null;
  /** The name as the map's tag has it, and the template's name. */
  name: string;
  kind: string;
  nation: { id: number; name: string; color: number } | null;
  flagUrl: string | null;
  onNation: (id: number) => void;
  onClose: () => void;
}) {
  const row = (label: MessageKey, value: string, testid: string) => (
    <div class="panel-row">
      <span>{t(label)}</span>
      <span data-testid={testid}>{value}</span>
    </div>
  );
  const status: MessageKey = info?.engaged ? 'formation.status.engaged' : info?.moving ? 'formation.status.moving' : 'formation.status.holding';
  return (
    <aside class="nation-panel formation-panel" data-testid="formation-panel" data-formation={info?.id ?? 0}>
      <div class="panel-head">
        {flagUrl ? <img class="panel-flag" data-testid="formation-flag" src={flagUrl} alt="" width={36} height={24} /> : <span class="panel-swatch" style={{ background: hex(nation?.color ?? 0x777777) }} />}
        <span class="panel-name" data-testid="formation-name">
          {name}
        </span>
        <button class="panel-close" data-testid="formation-close" aria-label={t('formation.close')} onClick={onClose}>
          ×
        </button>
      </div>
      <div class="panel-row">
        <span>{t('formation.kind')}</span>
        <span data-testid="formation-kind">{kind}</span>
      </div>
      <div class="panel-row">
        <span>{t('formation.nation')}</span>
        {nation ? (
          <button class="nation-chip" data-testid="formation-nation" onClick={() => onNation(nation.id)}>
            <span class="chip-swatch" style={{ background: hex(nation.color) }} />
            {displayName(nation.name)}
          </button>
        ) : (
          <span>—</span>
        )}
      </div>
      {info ? (
        <>
          {row('formation.strength', info.full > 0 ? t('formation.strengthOf', { n: num(info.strength), full: num(info.full) }) : num(info.strength), 'formation-strength')}
          {row('formation.supply', `${Math.round(info.supply * 100)}%`, 'formation-supply')}
          {row('formation.status', t(status), 'formation-status')}
          <div class="panel-sub">{t('formation.elements')}</div>
          <table class="formation-units" data-testid="formation-units">
            <tbody>
              {info.units.map((u) => (
                <tr key={u.nameKey} data-unit={u.nameKey}>
                  <td class="formation-unit-count">{u.elements}×</td>
                  <td>{t(u.nameKey as MessageKey)}</td>
                  <td class="formation-unit-strength">{t('formation.strengthOf', { n: num(u.strength), full: num(u.size) })}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {info.units.length === 0 ? <div class="panel-row">{t('formation.noElements')}</div> : null}
        </>
      ) : (
        <div class="panel-row">…</div>
      )}
    </aside>
  );
}
