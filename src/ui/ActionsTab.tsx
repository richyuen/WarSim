import { useState } from 'preact/hooks';
import type { Command } from '../shared/commands';
import type { NationStat, TemplateInfo, WarStat } from '../shared/protocol';
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
}

const num = (v: number): string => Math.round(v).toLocaleString('en-US');

/**
 * Actions of the nation the player controls (PLAN 1.33b): diplomacy that the other side may
 * refuse (declare war, offer peace per war, propose an alliance) and production (build a template
 * if gold and manpower allow; the training queue with days left).
 */
export function ActionsTab({ nation, nations, wars, templates, day, onCommand }: ActionsTabProps) {
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

      <div class="panel-sub">{t('act.production')}</div>
      {templates.map((tp, i) => {
        // A fleet is not in the list (PLAN 4.2b): the queue takes none yet (PLAN 4.2e). `i` stays the template's index.
        if (tp.domain !== 0) return null;
        const affordable = nation.gold >= tp.gold && nation.manpower >= tp.manpower;
        // The sim refuses a template whose techs the nation does not know (PLAN 3.1a).
        const known = (nation.techs[0] & tp.techs[0]) >>> 0 === tp.techs[0] && (nation.techs[1] & tp.techs[1]) >>> 0 === tp.techs[1];
        return (
          <div class="god-row act-template" key={i}>
            <span class="god-war-name" title={t('act.templateInfo', { men: num(tp.men), gold: num(tp.gold), manpower: num(tp.manpower), days: tp.days })}>
              {t(tp.nameKey as MessageKey)}
              <span class="act-cost"> {known ? t('act.cost', { gold: num(tp.gold), days: tp.days }) : t('act.needsResearch')}</span>
            </span>
            <button type="button" class="god-btn" data-testid={`act-build-${i}`} disabled={!affordable || !known} onClick={() => onCommand({ kind: 'queueFormation', nation: n, template: i })}>
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
