import type { FormationDetail } from '../shared/protocol';
import { t, type MessageKey } from './i18n';
import { displayName } from './NationPanel';

const num = (v: number): string => Math.round(v).toLocaleString('en-US');
/** A template's fuel figure: tenths below ten (the motorised division's 4.6), else whole. */
const fuel = (v: number): string => (v < 10 ? String(Math.round(v * 10) / 10) : num(v));
const hex = (c: number): string => `#${c.toString(16).padStart(6, '0')}`;

/**
 * The formation panel (PLAN 2.14b): what a click on a formation opens, at any zoom that shows
 * formations. Its name and kind, whose it is, its men against a whole one's, its supply and its
 * org, the fuel it burns on the march (PLAN 3.2d: it has no fuel level of its own, the supply is
 * what it burns), whether it is in contact or on the march, the way to where it fights (PLAN
 * 3.11b: a block behind its side's front has no enemy in a close view), and its elements by unit type. The
 * numbers are the sim's
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
  onFight,
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
  /** To where it fights (PLAN 3.11b): the button stands by the status of a formation in contact. */
  onFight: () => void;
  onClose: () => void;
}) {
  const row = (label: MessageKey, value: string, testid: string) => (
    <div class="panel-row">
      <span>{t(label)}</span>
      <span data-testid={testid}>{value}</span>
    </div>
  );
  // On the retreat it takes no order (PLAN 3.7m): the status says so, and for how long.
  const status = info && info.retreat > 0 ? t('formation.status.retreat', { n: info.retreat }) : t(info?.engaged ? 'formation.status.engaged' : info?.moving ? 'formation.status.moving' : 'formation.status.holding');
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
          {row('formation.org', `${Math.round(info.org * 100)}%`, 'formation-org')}
          {row('formation.fuel', info.fuel > 0 ? t('formation.fuelPerHour', { n: fuel(info.fuel) }) : t('formation.fuelNone'), 'formation-fuel')}
          <div class="panel-row">
            <span>{t('formation.status')}</span>
            <span>
              <span data-testid="formation-status">{status}</span>
              {info.fight ? (
                <button class="nation-chip formation-fight" data-testid="formation-fight" title={t('formation.toFight.title')} onClick={onFight}>
                  {'⚔'} {t('formation.toFight')}
                </button>
              ) : null}
            </span>
          </div>
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
