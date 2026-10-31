import { useState } from 'preact/hooks';
import type { Command, Refusal } from '../shared/commands';
import type { NationStat, PlayerWing, TemplateInfo, WarStat } from '../shared/protocol';
import { REFUSAL_KEY } from './GodTab';
import { t, type MessageKey } from './i18n';
import { displayName } from './NationPanel';
import { UnitIcon } from './UnitIcon';

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
  /** The wing selected by its name, which the camera follows (ADR-766), and the selecting of one. */
  followedWing?: number | null;
  onFollowWing?: (wing: number) => void;
  /** The formations selected (PLAN 5.8v2), whether their paradrop is armed, and the arming of it. */
  selected: number;
  dropArmed: boolean;
  onArmDrop: () => void;
  /**
   * God Mode's placing (on only with God Mode): the template armed, the arming of one, and why
   * the sim did not carry out the last command (`Refusal`, 0 = it did). Null: God Mode is off.
   */
  place?: { armed: number | null; onArm: (template: number) => void; refusal: number } | null;
  /** The AI assist (ADR-759): the mask of the AI's layers that act for this nation, and its change. */
  assist?: { layers: number; onChange: (layers: number) => void } | null;
}

/** The AI assist's boxes (ADR-759), in the order shown, with their bits (`AiLayer` of the sim). */
const ASSIST: readonly { key: 'army' | 'navy' | 'air' | 'diplomacy' | 'economy' | 'nukes'; bit: number }[] = [
  { key: 'army', bit: 1 },
  { key: 'navy', bit: 2 },
  { key: 'air', bit: 4 },
  { key: 'diplomacy', bit: 8 },
  { key: 'economy', bit: 16 },
  { key: 'nukes', bit: 32 },
];

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
/** Where a wing is (PLAN 7.170): at sea on its way to a new base, at its airbase, or on its carrier's fleet. */
function wingWhere(wg: PlayerWing, templates: readonly { nameKey: string }[]): string {
  if (wg.ferryDays > 0) return t('act.wingFerry', { n: wg.ferryDays });
  if (wg.carrier) return wg.fleet !== 0 ? t('act.wingOn', { fleet: t('formation.name', { kind: t((templates[wg.fleetTemplate]?.nameKey ?? 'template.carrier_group') as MessageKey), n: wg.fleet }) }) : t('act.wingCarrier');
  return wg.base !== '' ? t('act.wingAt', { base: wg.base }) : t('act.wingAirbase');
}

export function ActionsTab({ nation, nations, wars, templates, day, onCommand, wings, wingOrder, onArmWing, followedWing, onFollowWing, selected, dropArmed, onArmDrop, place, assist }: ActionsTabProps) {
  const n = nation.id;
  const others = nations.filter((o) => o.id !== n).sort((a, b) => displayName(a.name).localeCompare(displayName(b.name)));
  const [target, setTarget] = useState(0);
  // No nation until one is chosen (PLAN 7.164): the list opened on the first by name, one click from war.
  const tgt = target !== 0 && others.some((o) => o.id === target) ? target : 0;
  const myWars = wars.filter((w) => w.attackers.includes(n) || w.defenders.includes(n));
  const nameOf = (id: number): string => {
    const o = nations.find((x) => x.id === id);
    return o ? displayName(o.name) : `#${id}`;
  };
  return (
    <section class="god-tab" data-testid="panel-actions">
      {assist ? (
        <>
          <div class="panel-sub" title={t('act.assistHint')}>
            {t('act.assist')}
          </div>
          <div class="act-assist" data-testid="act-assist" title={t('act.assistHint')}>
            {ASSIST.map(({ key, bit }) => (
              <label key={key} class="act-assist-box">
                <input type="checkbox" data-testid={`act-assist-${key}`} checked={(assist.layers & bit) !== 0} onChange={(e) => assist.onChange((e.currentTarget as HTMLInputElement).checked ? assist.layers | bit : assist.layers & ~bit)} />
                {t(`act.assist.${key}` as MessageKey)}
              </label>
            ))}
          </div>
        </>
      ) : null}
      <div class="panel-sub">{t('god.diplomacy')}</div>
      <div class="god-row">
        <select data-testid="act-target" value={tgt} onChange={(e) => setTarget(Number((e.currentTarget as HTMLSelectElement).value))}>
          <option value={0} disabled>
            {t('act.chooseNation')}
          </option>
          {others.map((o) => (
            <option key={o.id} value={o.id}>
              {displayName(o.name)}
            </option>
          ))}
        </select>
      </div>
      <div class="god-row">
        <button type="button" class="god-btn" data-testid="act-war" disabled={tgt === 0} onClick={() => onCommand({ kind: 'declareWar', attacker: n, defender: tgt })}>
          {t('god.war')}
        </button>
        <button type="button" class="god-btn" data-testid="act-ally" disabled={tgt === 0} onClick={() => onCommand({ kind: 'proposeAlliance', from: n, to: tgt })}>
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

      {place ? (
        <>
          <div class="panel-sub" title={t('act.placeHint')}>
            {t('act.place')}
          </div>
          <div class="panel-note">{t('act.placeHint')}</div>
          {place.armed !== null ? (
            <div class="panel-note" data-testid="act-place-armed">
              {t('act.placeArmed', { name: t((templates[place.armed]?.nameKey ?? 'template.infantry_div') as MessageKey) })}
            </div>
          ) : null}
          {place.armed !== null && place.refusal !== 0 && REFUSAL_KEY[place.refusal as Exclude<Refusal, 0>] ? (
            <div class="panel-warn" data-testid="act-place-refusal" role="status">
              {t(REFUSAL_KEY[place.refusal as Exclude<Refusal, 0>])}
            </div>
          ) : null}
          {templates.map((tp, i) => (
            <div class="god-row act-template" key={i}>
              <UnitIcon template={tp} onClick={() => place.onArm(i)} pressed={place.armed === i} label={`${t('act.placeButton')}: ${t(tp.nameKey as MessageKey)}`} testId={`act-place-${i}-icon`} />
              <span class="god-war-name">{t(tp.nameKey as MessageKey)}</span>
              <button type="button" class={place.armed === i ? 'god-btn active' : 'god-btn'} data-testid={`act-place-${i}`} onClick={() => place.onArm(i)}>
                {t('act.placeButton')}
              </button>
            </div>
          ))}
        </>
      ) : null}

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
            <div class={followedWing === wg.id ? 'god-row act-wing followed' : 'god-row act-wing'} key={wg.id} data-testid={`act-wing-${wg.id}`}>
              <UnitIcon
                template={templates[wg.template]}
                onClick={() => onFollowWing?.(wg.id)}
                pressed={followedWing === wg.id}
                label={t('act.wingFollowHint')}
                testId={`act-wing-${wg.id}-icon`}
              />
              {/* Two lines (PLAN 7.170): its name, as a division's ("Fighter group 412"), and where it is;
                  then its mission beside its orders. */}
              <div class="act-wing-body">
                <span
                  class="act-wing-name"
                  role="button"
                  tabIndex={0}
                  aria-pressed={followedWing === wg.id}
                  data-testid={`act-wing-${wg.id}-name`}
                  title={t('act.wingFollowHint')}
                  onClick={() => onFollowWing?.(wg.id)}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter' && e.key !== ' ') return;
                    e.preventDefault();
                    onFollowWing?.(wg.id);
                  }}
                >
                  {/* Short of room, the kind gives way ("Tactical bomber gr…"; its icon shows it): the number
                      and the place tell the rows apart. */}
                  <span class="act-wing-kind">{t((templates[wg.template]?.nameKey ?? 'template.fighter_group') as MessageKey)}</span>
                  <span class="act-wing-tail" data-testid={`act-wing-${wg.id}-tail`}>
                    {`\u00a0${wg.id}`}
                    <span class="act-cost" data-testid={`act-wing-${wg.id}-where`}>
                      {' · '}
                      {wingWhere(wg, templates)}
                    </span>
                  </span>
                </span>
                <div class="act-wing-orders">
                  <span class="act-cost act-wing-mission">
                    {t(`act.mission.${wg.mission ?? 'none'}` as MessageKey)}
                    {wg.flying ? ` · ${t('act.wingFlying')}` : ''}
                  </span>
                  {(['patrol', 'strike', 'supply', 'rebase'] as const)
                    .filter((k) => k === 'rebase' || (wg.transport ? k === 'supply' : k !== 'supply'))
                    .map((k) => (
                      <button
                        type="button"
                        key={k}
                        class={wingOrder && wingOrder.wing === wg.id && wingOrder.kind === k ? 'god-btn active' : 'god-btn'}
                        data-testid={`act-wing-${wg.id}-${k}`}
                        // At sea it takes no order until it is at its new base (PLAN 7.142, `orderFerry`).
                        disabled={wg.ferryDays > 0}
                        title={t(`act.wingOrder.${k}` as MessageKey)}
                        onClick={() => onArmWing(wg.id, k)}
                      >
                        {t(`act.wingButton.${k}` as MessageKey)}
                      </button>
                    ))}
                </div>
              </div>
            </div>
          ))}
        </>
      ) : null}

      <div class="panel-sub">{t('act.production')}</div>
      {templates.map((tp, i) => {
        // Every template, the land's, the sea's and the air's (PLAN 5.8v4). `i` stays the template's index.
        const affordable = nation.gold >= tp.gold && nation.manpower >= tp.manpower;
        // The sim refuses a template whose techs the nation does not know (PLAN 3.1a), a fleet of a
        // nation with no port (PLAN 4.2e), and a wing of one with no airbase with room for it (PLAN 5.8s1).
        const known = (nation.techs[0] & tp.techs[0]) >>> 0 === tp.techs[0] && (nation.techs[1] & tp.techs[1]) >>> 0 === tp.techs[1];
        const port = tp.domain === 0 || (tp.domain === 1 ? nation.shipyard : nation.airRoom >= tp.aircraft);
        return (
          <div class="god-row act-template" key={i}>
            <UnitIcon template={tp} />
            <span class="god-war-name" title={t('act.templateInfo', { men: num(tp.men), gold: num(tp.gold), manpower: num(tp.manpower), days: tp.days })}>
              {t(tp.nameKey as MessageKey)}
              <span class="act-cost"> {!known ? t('act.needsResearch') : !port ? t(tp.domain === 1 ? 'act.needsPort' : 'act.needsAirfield') : t('act.cost', { gold: num(tp.gold), days: tp.days })}</span>
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
              <UnitIcon template={templates[q.template]} />
              {t((templates[q.template]?.nameKey ?? 'template.infantry_div') as MessageKey)} · {t('act.readyIn', { n: Math.max(0, q.readyDay - day) })}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
