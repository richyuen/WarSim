import { useState } from 'preact/hooks';
import { Refusal, type Command } from '../shared/commands';
import type { NationStat, WarStat } from '../shared/protocol';
import { t, type MessageKey } from './i18n';
import { displayName } from './NationPanel';

export type GodToolId = 'revolt' | 'battle' | 'brush';
const BUFFS = ['attack', 'defense', 'speed', 'income', 'manpower', 'unrest'] as const;
/** A granted buff: +25% (unrest: +2.5 a month) for 30 days. */
const BUFF_MAGNITUDE = 0.25;
const BUFF_HOURS = 24 * 30;
/** Why the sim did not carry out a command, in words (PLAN 2.17a). */
const REFUSAL_KEY: Record<Exclude<Refusal, 0>, MessageKey> = {
  [Refusal.NotANumber]: 'refusal.notANumber',
  [Refusal.NoNation]: 'refusal.noNation',
  [Refusal.DeadNation]: 'refusal.deadNation',
  [Refusal.SameNation]: 'refusal.sameNation',
  [Refusal.AtWar]: 'refusal.atWar',
  [Refusal.Truce]: 'refusal.truce',
  [Refusal.Subject]: 'refusal.subject',
  [Refusal.Allied]: 'refusal.allied',
  [Refusal.InAlliance]: 'refusal.inAlliance',
  [Refusal.NoAlliance]: 'refusal.noAlliance',
  [Refusal.NoSuch]: 'refusal.noSuch',
  [Refusal.NoEffect]: 'refusal.noEffect',
  [Refusal.LastNation]: 'refusal.lastNation',
};

export interface GodTabProps {
  nation: NationStat;
  nations: NationStat[];
  wars: WarStat[];
  dead: { id: number; name: string }[];
  aiEnabled: boolean;
  tool: GodToolId | null;
  /** Why the last command sent was not carried out (`Refusal`; 0 = it was). */
  refusal: number;
  onCommand: (cmd: Command) => void;
  onTool: (tool: GodToolId) => void;
}

/**
 * God Mode tab of the nation panel (PLAN 1.32b): every God command of SPEC §9 on the selected
 * nation, plus map tools (revolt, breakthrough, territory brush) that take the next map clicks.
 * Kill asks for a second click instead of a browser dialog.
 */
export function GodTab({ nation, nations, wars, dead, aiEnabled, tool, refusal, onCommand, onTool }: GodTabProps) {
  const n = nation.id;
  const others = nations.filter((o) => o.id !== n).sort((a, b) => displayName(a.name).localeCompare(displayName(b.name)));
  const [name, setName] = useState('');
  const [target, setTarget] = useState(0);
  const [buff, setBuff] = useState<(typeof BUFFS)[number]>('attack');
  const [revive, setRevive] = useState(0);
  const [armKill, setArmKill] = useState(false);
  const tgt = target !== 0 && others.some((o) => o.id === target) ? target : (others[0]?.id ?? 0);
  const myWars = wars.filter((w) => w.attackers.includes(n) || w.defenders.includes(n));
  const nameOf = (id: number): string => {
    const o = nations.find((x) => x.id === id);
    return o ? displayName(o.name) : `#${id}`;
  };
  const btn = (testid: string, label: string, onClick: () => void, active = false) => (
    <button type="button" class={active ? 'god-btn active' : 'god-btn'} data-testid={testid} onClick={onClick}>
      {label}
    </button>
  );
  return (
    <section class="god-tab" data-testid="panel-god">
      {refusal !== 0 ? (
        <div class="panel-warn" data-testid="god-refusal" role="status">
          {t('refusal.lead')} {t(REFUSAL_KEY[refusal as Exclude<Refusal, 0>] ?? 'refusal.noEffect')}
        </div>
      ) : null}
      <div class="god-row">
        <input data-testid="god-rename-input" value={name} placeholder={displayName(nation.name)} onInput={(e) => setName((e.currentTarget as HTMLInputElement).value)} />
        {btn('god-rename', t('god.rename'), () => onCommand({ kind: 'renameNation', nation: n, name }))}
      </div>
      <div class="god-row">
        <span>{t('panel.incomeBonus')}</span>
        {btn('god-bonus-down', '−10', () => onCommand({ kind: 'setIncomeBonus', nation: n, value: nation.incomeBonus - 10 }))}
        <span data-testid="god-bonus">{nation.incomeBonus}%</span>
        {btn('god-bonus-up', '+10', () => onCommand({ kind: 'setIncomeBonus', nation: n, value: nation.incomeBonus + 10 }))}
      </div>
      <label class="god-row">
        <input type="checkbox" data-testid="god-ai" checked={!nation.aiOff} onChange={(e) => onCommand({ kind: 'setAi', nation: n, enabled: (e.currentTarget as HTMLInputElement).checked })} />
        {t('god.nationAi')}
      </label>
      <label class="god-row">
        <input type="checkbox" data-testid="god-world-ai" checked={aiEnabled} onChange={(e) => onCommand({ kind: 'setSetting', key: 'aiEnabled', value: (e.currentTarget as HTMLInputElement).checked })} />
        {t('god.worldAi')}
      </label>

      <div class="panel-sub">{t('god.diplomacy')}</div>
      <div class="god-row">
        <select data-testid="god-target" value={tgt} onChange={(e) => setTarget(Number((e.currentTarget as HTMLSelectElement).value))}>
          {others.map((o) => (
            <option key={o.id} value={o.id}>
              {displayName(o.name)}
            </option>
          ))}
        </select>
      </div>
      <div class="god-row">
        {btn('god-war', t('god.war'), () => onCommand({ kind: 'declareWar', attacker: n, defender: tgt }))}
        {btn('god-ally', t('god.ally'), () =>
          onCommand(nation.alliance ? { kind: 'joinAlliance', nation: tgt, alliance: nation.alliance.id } : { kind: 'createAlliance', leader: n, members: [tgt], nameKey: 'alliance.defensive' }),
        )}
        {btn('god-puppet', t('god.puppet'), () => onCommand({ kind: 'createPuppet', overlord: n, subject: tgt, autonomy: 50 }))}
        {nation.alliance ? btn('god-leave', t('god.leave'), () => onCommand({ kind: 'leaveAlliance', nation: n })) : null}
      </div>
      {myWars.map((w) => (
        <div class="god-row" key={w.id}>
          <span class="god-war-name">
            {nameOf(w.attackers[0] ?? 0)} {'⚔'} {nameOf(w.defenders[0] ?? 0)}
          </span>
          {btn(`god-peace-${w.id}`, t('god.peace'), () => onCommand({ kind: 'forcePeace', war: w.id }))}
        </div>
      ))}

      <div class="panel-sub">{t('god.buffs')}</div>
      <div class="god-row">
        <select data-testid="god-buff-kind" value={buff} onChange={(e) => setBuff((e.currentTarget as HTMLSelectElement).value as (typeof BUFFS)[number])}>
          {BUFFS.map((b) => (
            <option key={b} value={b}>
              {t(`god.buff.${b}` as MessageKey)}
            </option>
          ))}
        </select>
        {btn('god-buff', t('god.grant'), () => onCommand({ kind: 'grantBuff', targetKind: 'nation', target: n, buff, magnitude: BUFF_MAGNITUDE, hours: BUFF_HOURS, nameKey: 'buff.god' }))}
      </div>

      <div class="panel-sub">{t('god.tools')}</div>
      <div class="god-row">
        {btn('god-tool-revolt', t('god.tool.revolt'), () => onTool('revolt'), tool === 'revolt')}
        {btn('god-tool-battle', t('god.tool.battle'), () => onTool('battle'), tool === 'battle')}
        {btn('god-tool-brush', t('god.tool.brush'), () => onTool('brush'), tool === 'brush')}
      </div>
      {tool ? <div class="panel-note" data-testid="god-tool-hint">{t(`god.hint.${tool}` as MessageKey)}</div> : null}

      {dead.length > 0 ? (
        <div class="god-row">
          <select data-testid="god-revive-target" value={revive || dead[0]!.id} onChange={(e) => setRevive(Number((e.currentTarget as HTMLSelectElement).value))}>
            {dead.map((d) => (
              <option key={d.id} value={d.id}>
                {displayName(d.name)}
              </option>
            ))}
          </select>
          {btn('god-revive', t('god.revive'), () => onCommand({ kind: 'reviveNation', nation: revive || dead[0]!.id }))}
        </div>
      ) : null}
      <div class="god-row">
        {btn('god-kill', armKill ? t('god.killConfirm') : t('god.kill'), () => {
          if (!armKill) return setArmKill(true);
          setArmKill(false);
          onCommand({ kind: 'collapseNation', nation: n });
        }, armKill)}
      </div>
    </section>
  );
}
