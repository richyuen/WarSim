import { useState } from 'preact/hooks';
import type { Command } from '../shared/commands';
import type { NationStat, PlayerWing, TemplateInfo, WarStat } from '../shared/protocol';
import { t, type MessageKey } from './i18n';
import { displayName } from './NationPanel';

export interface ActionsTabProps {
  nation: NationStat;
  nations: NationStat[];
  wars: WarStat[];
  templates: TemplateInfo[];
  /** Current day (ticks / 24), for "ready in N days". */
  day: number;
  onCommand: (cmd: Command) => void;
  /** Its air wings (PLAN 5.8v1), the order armed for the next map click, and the arming of one. */
  wings: PlayerWing[];
  wingOrder: { wing: number; kind: WingOrderKind } | null;
  onArmWing: (wing: number, kind: WingOrderKind) => void;
  /** The formations selected (PLAN 5.8v2), whether their paradrop is armed, and the arming of it. */
  selected: number;
  dropArmed: boolean;
  onArmDrop: () => void;
}

/** A wing's order at a place (PLAN 5.8v1); `WingOrder` of the page's player control. */
export type WingOrderKind = 'patrol' | 'strike' | 'supply' | 'rebase';

const num = (v: number): string => Math.round(v).toLocaleString('en-US');

/**
 * Actions of the nation the player controls (PLAN 1.33b): diplomacy that the other side may
 * refuse (declare war, offer peace per war, propose an alliance) and production (build a template
 * if gold and manpower allow; the training queue with days left). Its air wings (PLAN 5.8v1):
 * each with its base and mission, and its orders, armed by a button and given by the next click
 * on the map (patrol, strike, supply for a transport, rebase); and a paradrop of the formations
 * selected, the same way (PLAN 5.8v2).
 */
export function ActionsTab({ nation, nations, wars, templates, day, onCommand, wings, wingOrder, onArmWing, selected, dropArmed, onArmDrop }: ActionsTabProps) {
  const n = nation.id;
  const others = nations.filter((o) => o.id !== n).sort((a, b) => displayName(a.name).localeCompare(displayName(b.name)));
  const [target, setTarget] = useState(0);
  const tgt = target !== 0 && others.some((o) => o.id === target) ? target : (others[0]?.id ?? 0);
  const myWars = wars.filter((w) => w.attackers.includes(n) || w.defenders.includes(n));
  const nameOf = (id: number): string => {
    const o = nations.find((x) => x.id === id);
    return o ? displayName(o.name) : `#${id}`;
  };
  return (
    <section class="god-tab" data-testid="panel-actions">
      <div class="panel-sub">{t('god.diplomacy')}</div>
      <div class="god-row">
        <select data-testid="act-target" value={tgt} onChange={(e) => setTarget(Number((e.currentTarget as HTMLSelectElement).value))}>
          {others.map((o) => (
            <option key={o.id} value={o.id}>
              {displayName(o.name)}
            </option>
          ))}
        </select>
      </div>
      <div class="god-row">
        <button type="button" class="god-btn" data-testid="act-war" onClick={() => onCommand({ kind: 'declareWar', attacker: n, defender: tgt })}>
          {t('god.war')}
        </button>
        <button type="button" class="god-btn" data-testid="act-ally" onClick={() => onCommand({ kind: 'proposeAlliance', from: n, to: tgt })}>
          {t('act.proposeAlliance')}
        </button>
      </div>
      {myWars.map((w) => {
        const mine = w.attackers.includes(n) ? w.score : -w.score;
        return (
          <div class="god-row" key={w.id}>
            <span class="god-war-name">
              {nameOf(w.attackers[0] ?? 0)} {'⚔'} {nameOf(w.defenders[0] ?? 0)} ({mine >= 0 ? '+' : ''}
              {Math.round(mine)})
            </span>
            <button type="button" class="god-btn" data-testid={`act-peace-${w.id}`} onClick={() => onCommand({ kind: 'offerPeace', war: w.id, from: n })}>
              {t('act.offerPeace')}
            </button>
          </div>
        );
      })}

      {wings.length > 0 ? (
        <>
          <div class="panel-sub">{t('act.air')}</div>
          {wingOrder || dropArmed ? (
            <div class="panel-note" data-testid="act-wing-armed">
              {t('act.wingArmed', { order: wingOrder ? t(`act.wingOrder.${wingOrder.kind}` as MessageKey) : t('act.dropOrder', { n: selected }) })}
            </div>
          ) : null}
          {wings.some((wg) => wg.transport) ? (
            <div class="god-row">
              <span class="god-war-name">{t('act.drop', { n: selected })}</span>
              <button type="button" class={dropArmed ? 'god-btn active' : 'god-btn'} data-testid="act-drop" disabled={selected === 0} title={t('act.dropHint')} onClick={onArmDrop}>
                {t('act.dropButton')}
              </button>
            </div>
          ) : null}
          {wings.map((wg) => (
            <div class="god-row act-wing" key={wg.id} data-testid={`act-wing-${wg.id}`}>
              <span class="god-war-name">
                {t((templates[wg.template]?.nameKey ?? 'template.fighter_group') as MessageKey)}
                <span class="act-cost">
                  {' '}
                  {t(wg.carrier ? 'act.wingCarrier' : 'act.wingAirbase')} · {t(`act.mission.${wg.mission ?? 'none'}` as MessageKey)}
                  {wg.flying ? ` · ${t('act.wingFlying')}` : ''}
                </span>
              </span>
              {(['patrol', 'strike', 'supply', 'rebase'] as const)
                .filter((k) => k === 'rebase' || (wg.transport ? k === 'supply' : k !== 'supply'))
                .map((k) => (
                  <button
                    type="button"
                    key={k}
                    class={wingOrder && wingOrder.wing === wg.id && wingOrder.kind === k ? 'god-btn active' : 'god-btn'}
                    data-testid={`act-wing-${wg.id}-${k}`}
                    title={t(`act.wingOrder.${k}` as MessageKey)}
                    onClick={() => onArmWing(wg.id, k)}
                  >
                    {t(`act.wingButton.${k}` as MessageKey)}
                  </button>
                ))}
            </div>
          ))}
        </>
      ) : null}

      <div class="panel-sub">{t('act.production')}</div>
      {templates.map((tp, i) => {
        // Land and sea templates; no air formation is built (PLAN 5). `i` stays the template's index.
        if (tp.domain > 1) return null;
        const affordable = nation.gold >= tp.gold && nation.manpower >= tp.manpower;
        // The sim refuses a template whose techs the nation does not know (PLAN 3.1a), and a fleet of a nation with no port (PLAN 4.2e).
        const known = (nation.techs[0] & tp.techs[0]) >>> 0 === tp.techs[0] && (nation.techs[1] & tp.techs[1]) >>> 0 === tp.techs[1];
        const port = tp.domain === 0 || nation.shipyard;
        return (
          <div class="god-row act-template" key={i}>
            <span class="god-war-name" title={t('act.templateInfo', { men: num(tp.men), gold: num(tp.gold), manpower: num(tp.manpower), days: tp.days })}>
              {t(tp.nameKey as MessageKey)}
              <span class="act-cost"> {!known ? t('act.needsResearch') : !port ? t('act.needsPort') : t('act.cost', { gold: num(tp.gold), days: tp.days })}</span>
            </span>
            <button type="button" class="god-btn" data-testid={`act-build-${i}`} disabled={!affordable || !known || !port} onClick={() => onCommand({ kind: 'queueFormation', nation: n, template: i })}>
              {t('act.build')}
            </button>
          </div>
        );
      })}
      <div class="panel-sub">{t('act.queue')}</div>
      {nation.queue.length === 0 ? (
        <div class="panel-note">{t('act.queueEmpty')}</div>
      ) : (
        <ul class="act-queue" data-testid="act-queue">
          {nation.queue.map((q, i) => (
            <li key={i} data-testid="act-queue-row">
              {t((templates[q.template]?.nameKey ?? 'template.infantry_div') as MessageKey)} · {t('act.readyIn', { n: Math.max(0, q.readyDay - day) })}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
